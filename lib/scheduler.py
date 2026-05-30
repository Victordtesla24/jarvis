"""APScheduler job definitions for JARVIS."""
import logging
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from lib.config import get_config
from lib.database import log_action, update_machine_state, start_task, complete_task
from lib.ssh_manager import get_ssh_manager
from lib.machine import get_system_info
from lib.cleanup import find_cleanup_targets, create_cleanup_plan, execute_cleanup, format_size
from lib.package_managers import update_all_packages
from lib.docker_ops import system_prune, is_docker_running
from lib.notifier import get_notifier
from lib.autopilot import find_bloat, plan_reclamation, IDLE_CPU_THRESHOLD


logger = logging.getLogger(__name__)

def get_config_safe():
    """Return the shared Config singleton.

    Note: this is the cached singleton, not a fresh read from disk. Config
    changes on disk take effect on daemon restart (or an explicit
    ``get_config().reload()``), which is the intended behavior for a
    long-running daemon.
    """
    return get_config()


def _machine_hostname(machine_name: str) -> str:
    """Resolve a machine's configured hostname, falling back to its key."""
    machine_cfg = get_config_safe().machines.get(machine_name, {})
    return machine_cfg.get("hostname") or machine_name


def _get_cleanup_thresholds() -> tuple[float, float]:
    """Return (disk_pct_threshold, free_gb_threshold) from config or defaults."""
    config = get_config_safe()
    safety = config.safety
    return (
        safety.get("disk_pct_threshold", 70.0),
        safety.get("free_gb_threshold", 50.0),
    )


def _should_cleanup(disk_pct: float, free_gb: float) -> bool:
    """Heuristic decision: should we run cleanup?

    No LLM API call needed — pure local logic.
    Thresholds are configurable via safety.disk_pct_threshold / safety.free_gb_threshold.
    """
    disk_thresh, free_thresh = _get_cleanup_thresholds()
    if disk_pct > disk_thresh:
        return True
    if free_gb < free_thresh:
        return True
    return False


def tidy_job():
    """Run every N minutes: scan for and clean temp files."""
    logger.info("JARVIS: Running tidy job")

    config = get_config_safe()

    try:
        # Get current system state for Mac
        info = get_system_info()

        # Update machine state in DB
        update_machine_state(
            machine="mac",
            hostname="vics-macbook-pro",
            disk_used_pct=info.disk.used_pct,
            ram_used_pct=info.ram_used_pct,
            cpu_avg=100 - info.cpu_idle_pct
        )

        # Use local heuristic (no LLM API cost) to decide if cleanup needed
        if _should_cleanup(info.disk.used_pct, info.disk.free_gb):
            home = str(Path.home())
            targets = list(find_cleanup_targets(home))
            # Limit to 100 targets max for performance
            targets = targets[:100]

            if targets:
                paths = [p[0] for p in targets]

                dry_run = config.safety.get("dry_run", False)

                plan = create_cleanup_plan(
                    "mac", paths,
                    f"Scheduled tidy: {len(paths)} files"
                )
                results = execute_cleanup(plan, dry_run=dry_run)

                success_count = sum(1 for r in results if r.success)
                freed = sum(r.size_bytes for r in results if r.success)

                # In a dry run nothing was actually deleted, so the byte total
                # is only an estimate — label it as such and don't fire the
                # "cleanup complete" notification for work that didn't happen.
                verb = "Would clean" if dry_run else "Cleaned"
                log_action(
                    machine="mac",
                    action_type="tidy",
                    description=f"{verb} {success_count} items",
                    files_affected=paths[:20],
                    bytes_freed=freed,
                    outcome="dry_run" if dry_run else "success",
                    llm_reasoning=f"Disk at {info.disk.used_pct}%, {info.disk.free_gb:.0f}GB free"
                )

                if not dry_run:
                    freed_mb = freed / (1024 * 1024)
                    notifier = get_notifier()
                    notifier.notify_significant(
                        title="JARVIS: Cleanup Complete",
                        message=f"Mac: {success_count} items, {format_size(freed)} freed",
                        size_freed_mb=freed_mb
                    )
            else:
                logger.info("JARVIS: No cleanup targets found")
        else:
            logger.info(
                "JARVIS: Mac healthy — "
                f"disk {info.disk.used_pct}%, {info.disk.free_gb:.0f}GB free"
            )
            log_action(
                machine="mac",
                action_type="monitor",
                description="Health check passed, no cleanup needed",
                outcome="success",
                llm_reasoning=f"Disk at {info.disk.used_pct}%, {info.disk.free_gb:.0f}GB free"
            )

        # VPS tidy — only for enabled machines
        ssh = get_ssh_manager()

        for machine_name in ["vps_main", "vps_hostinger"]:
            # Skip disabled or unconfigured machines
            if machine_name not in ssh.connections:
                continue

            try:
                # Check disk usage (safe)
                stdout, _, _ = ssh.exec_command(
                    machine_name,
                    "df -H / | tail -1 | awk '{print $5}' | sed 's/%//'",
                    timeout=10
                )

                if stdout.strip():
                    disk_pct = float(stdout.strip())
                    update_machine_state(
                        machine=machine_name,
                        hostname=_machine_hostname(machine_name),
                        disk_used_pct=disk_pct,
                        ram_used_pct=0,
                        cpu_avg=0
                    )

                    disk_thresh, _ = _get_cleanup_thresholds()
                    vps_disk_thresh = disk_thresh + 10  # VPS uses threshold + 10%

                    if disk_pct > vps_disk_thresh:
                        notifier = get_notifier()
                        notifier.notify_alert(
                            machine_name,
                            f"Disk at {disk_pct}%"
                        )

                        dry_run = config.safety.get("dry_run", False)
                        if not dry_run:
                            # Safe VPS cleanup — only targeted directories
                            cleanup_dirs = [
                                "/tmp/*.log",
                                "/root/.cache/pip",
                                "/var/cache/apt/archives/*.deb",
                            ]
                            for d in cleanup_dirs:
                                ssh.exec_command(
                                    machine_name,
                                    f"rm -rf {d} 2>/dev/null || true",
                                    timeout=10
                                )
                            # Docker prune if available
                            ssh.exec_command(
                                machine_name,
                                "docker system prune -f 2>/dev/null || true",
                                timeout=30
                            )
                            log_action(
                                machine=machine_name,
                                action_type="vps_tidy",
                                description=f"VPS cleanup triggered at {disk_pct}% disk",
                                outcome="success"
                            )
                        else:
                            logger.info(f"JARVIS: VPS {machine_name} cleanup skipped (dry_run=true)")

            except Exception as e:
                logger.error(f"VPS tidy failed for {machine_name}: {e}")

        logger.info("JARVIS: Tidy job completed")

    except Exception as e:
        logger.error(f"JARVIS tidy job failed: {e}", exc_info=True)


def autopilot_job():
    """Idle-aware autonomous self-healing for the Mac.

    JARVIS's proactive sweep: find regenerable space-eaters (``node_modules``,
    build output, framework/tool caches) that have gone dormant and reclaim
    them WITHOUT asking — but only while the machine is idle, so a reclamation
    never competes with the user's running build ("IDLE TIME=SLEEP").

    Detection always runs; reclamation is deferred when the system is busy or
    when ``safety.dry_run`` is set. Every run is recorded in the audit trail.
    """
    logger.info("JARVIS: Running autopilot (idle-aware self-healing)")

    config = get_config_safe()
    safety = config.safety

    try:
        if not safety.get("autopilot_armed", True):
            logger.info("JARVIS: Autopilot DISARMED from cockpit — reclamation held")
            log_action(
                machine="mac",
                action_type="autopilot",
                outcome="deferred",
                description="Autopilot disarmed from cockpit — reclamation held",
            )
            return

        info = get_system_info()
        home = str(Path.home())

        targets = find_bloat(
            home,
            min_age_days=safety.get("bloat_min_age_days", 7),
        )
        plan = plan_reclamation(
            info.cpu_idle_pct,
            targets,
            idle_threshold=safety.get("idle_cpu_threshold", IDLE_CPU_THRESHOLD),
            max_targets=safety.get("max_bloat_targets", 50),
        )

        if not plan.should_run:
            logger.info("JARVIS: Autopilot — %s", plan.reason)
            log_action(
                machine="mac",
                action_type="autopilot",
                # "deferred" when dormant bloat exists but we held off (busy);
                # plain "success" when there was simply nothing to reclaim.
                outcome="deferred" if any(t.reclaimable for t in targets) else "success",
                description=plan.reason,
                llm_reasoning=(
                    f"CPU idle {info.cpu_idle_pct:.0f}%, "
                    f"{len(targets)} bloat dir(s) seen"
                ),
            )
            return

        dry_run = safety.get("dry_run", False)
        cleanup_plan = create_cleanup_plan(
            "mac", [t.path for t in plan.targets], plan.reason
        )
        results = execute_cleanup(cleanup_plan, dry_run=dry_run)

        success = sum(1 for r in results if r.success)
        freed = sum(r.size_bytes for r in results if r.success)
        verb = "Would reclaim" if dry_run else "Reclaimed"

        log_action(
            machine="mac",
            action_type="autopilot",
            description=f"{verb} {success} dormant bloat dir(s)",
            files_affected=[t.path for t in plan.targets][:20],
            bytes_freed=freed,
            outcome="dry_run" if dry_run else "success",
            llm_reasoning=plan.reason,
        )

        if not dry_run and freed > 0:
            notifier = get_notifier()
            notifier.notify_significant(
                title="JARVIS: Autopilot reclaimed space",
                message=f"Mac: {success} dir(s), {format_size(freed)} freed",
                size_freed_mb=freed / (1024 * 1024),
            )

        logger.info("JARVIS: Autopilot completed — %s", plan.reason)

    except Exception as e:
        logger.error(f"JARVIS autopilot failed: {e}", exc_info=True)


def health_check_job():
    """Run hourly: check disk, RAM, CPU on all machines."""
    logger.info("JARVIS: Running health check")

    try:
        # Check Mac
        info = get_system_info()

        # Update state
        update_machine_state(
            machine="mac",
            hostname="vics-macbook-pro",
            disk_used_pct=info.disk.used_pct,
            ram_used_pct=info.ram_used_pct,
            cpu_avg=100 - info.cpu_idle_pct
        )

        # Alert if disk critically low
        if info.disk.free_gb < 10:
            notifier = get_notifier()
            notifier.notify_alert(
                machine="Mac",
                message=f"Low disk: only {info.disk.free_gb:.1f}GB free"
            )

        # Alert if RAM pressure high (>85%)
        if info.ram_used_pct > 85:
            notifier = get_notifier()
            notifier.notify_alert(
                machine="Mac",
                message=f"High RAM usage: {info.ram_used_pct:.1f}%"
            )

        # VPS health check
        ssh = get_ssh_manager()

        for machine_name in list(ssh.connections.keys()):
            try:
                stdout, stderr, exit_code = ssh.exec_with_retry(
                    machine_name,
                    "echo 'ok' && uptime",
                    timeout=10,
                    retries=2
                )
                if "ok" in stdout:
                    # The last line of output is `uptime` (load averages etc.).
                    logger.info(
                        f"VPS {machine_name}: healthy — "
                        f"{stdout.strip().split(chr(10))[-1] if stdout else 'no data'}"
                    )

                    # Update disk
                    disk_stdout, _, _ = ssh.exec_command(
                        machine_name,
                        "df -H / | tail -1 | awk '{print $5}' | sed 's/%//'",
                        timeout=10
                    )
                    if disk_stdout.strip():
                        disk_pct = float(disk_stdout.strip())
                        update_machine_state(
                            machine=machine_name,
                            hostname=_machine_hostname(machine_name),
                            disk_used_pct=disk_pct,
                            ram_used_pct=0,
                            cpu_avg=0
                        )
                else:
                    logger.warning(f"VPS {machine_name} response unexpected: {stdout[:100]}")
            except Exception as e:
                logger.error(f"VPS health check failed for {machine_name}: {e}")
                notifier = get_notifier()
                notifier.notify_alert(
                    machine=machine_name,
                    message=f"Connection failed: {type(e).__name__}"
                )

        logger.info("JARVIS: Health check completed")

    except Exception as e:
        logger.error(f"JARVIS health check failed: {e}", exc_info=True)


def deep_clean_job():
    """Run daily at midnight: full cleanup and updates."""
    logger.info("JARVIS: Running deep clean")

    task_id = start_task("deep_clean", "all")
    notifier = get_notifier()
    results_summary = []

    try:
        # Docker prune on Mac
        if is_docker_running():
            try:
                results = system_prune(dry_run=False)
                for result in results:
                    log_action(
                        machine="mac",
                        action_type=result.action,
                        description=f"{result.action}: {result.removed} removed",
                        outcome="success"
                    )
                    results_summary.append(
                        f"Docker {result.action}: {result.removed} removed"
                    )
            except Exception as e:
                logger.error(f"Docker prune failed: {e}")

        # Package updates on Mac
        try:
            update_results = update_all_packages("mac")
            for result in update_results:
                if result.success and result.packages_updated > 0:
                    notifier.notify_update("Mac", result.packages_updated)
                    log_action(
                        machine="mac",
                        action_type="package_update",
                        description=result.output,
                        outcome="success"
                    )
                results_summary.append(
                    f"Packages (Mac): {result.packages_updated} updated"
                )
        except Exception as e:
            logger.error(f"Mac package update failed: {e}")

        # VPS deep clean via SSH
        ssh = get_ssh_manager()

        for machine_name in list(ssh.connections.keys()):
            try:
                # apt update && upgrade on VPS. Run under `bash -o pipefail` so
                # the exit code reflects apt-get's status rather than `tail`'s
                # (a plain pipe would always report success).
                stdout, stderr, rc = ssh.exec_command(
                    machine_name,
                    "bash -o pipefail -c 'apt-get update -qq 2>&1 && "
                    "DEBIAN_FRONTEND=noninteractive apt-get upgrade -yqq 2>&1 | tail -5'",
                    timeout=120
                )
                if rc == 0:
                    log_action(
                        machine=machine_name,
                        action_type="apt_upgrade",
                        description=stdout[:200] if stdout else "Upgrade completed",
                        outcome="success"
                    )
                    results_summary.append(
                        f"VPS {machine_name}: apt upgraded"
                    )
                else:
                    logger.warning(f"VPS {machine_name} apt upgrade failed: {stderr[:200]}")

                # Docker cleanup on VPS
                ssh.exec_command(
                    machine_name,
                    "docker system prune -af 2>/dev/null || true",
                    timeout=60
                )

                # Clear old journals
                ssh.exec_command(
                    machine_name,
                    "journalctl --vacuum-time=7d 2>/dev/null || true",
                    timeout=30
                )

            except Exception as e:
                logger.error(f"VPS deep clean failed for {machine_name}: {e}")

        complete_task(task_id, "success")
        logger.info(f"JARVIS: Deep clean completed — {'; '.join(results_summary) if results_summary else 'no actions taken'}")

    except Exception as e:
        logger.error(f"JARVIS deep clean failed: {e}", exc_info=True)
        complete_task(task_id, "failed", str(e))


def setup_scheduler() -> BackgroundScheduler:
    """Create and configure APScheduler."""
    scheduler = BackgroundScheduler()

    config = get_config_safe()
    schedule = config.schedule

    # Tidy job — fire immediately on startup, then every N minutes
    scheduler.add_job(
        tidy_job,
        trigger=IntervalTrigger(minutes=schedule.get("tidy_every", 15)),
        id="tidy",
        name="Tidy Cleanup",
        replace_existing=True,
        misfire_grace_time=300,  # 5 min grace for missed runs
        next_run_time=datetime.now(),
    )

    # Autopilot — idle-aware autonomous reclamation of dormant bloat.
    # Fires shortly after startup, then on its own cadence; it self-defers
    # whenever the machine is busy, so a frequent interval is harmless.
    scheduler.add_job(
        autopilot_job,
        trigger=IntervalTrigger(minutes=schedule.get("autopilot_every", 30)),
        id="autopilot",
        name="Autopilot Self-Healing",
        replace_existing=True,
        misfire_grace_time=600,
        next_run_time=datetime.now(),
    )

    # Health check — fire immediately on startup, then every N minutes
    scheduler.add_job(
        health_check_job,
        trigger=IntervalTrigger(minutes=schedule.get("health_check", 60)),
        id="health_check",
        name="Health Check",
        replace_existing=True,
        misfire_grace_time=600,
        next_run_time=datetime.now(),
    )

    # Deep clean - daily at midnight
    scheduler.add_job(
        deep_clean_job,
        trigger=CronTrigger(hour=0, minute=0),
        id="deep_clean",
        name="Daily Deep Clean",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace
    )

    # Log DB cleanup every 30 days
    scheduler.add_job(
        cleanup_db_job,
        trigger=IntervalTrigger(days=30),
        id="db_cleanup",
        name="DB Log Rotation",
        replace_existing=True,
    )

    return scheduler


def cleanup_db_job():
    """Rotate old database logs (keeps 90 days)."""
    from lib.database import cleanup_old_logs
    try:
        deleted = cleanup_old_logs(days=90)
        logger.info(f"JARVIS: DB cleanup removed {deleted} old log entries")
    except Exception as e:
        logger.error(f"JARVIS: DB cleanup failed: {e}")
