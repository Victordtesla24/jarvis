#!/usr/bin/env python3
"""JARVIS CLI - Chat interface and command execution."""
import sys
import argparse
from pathlib import Path

# Add jarvis dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from lib.config import get_config
from lib.database import get_recent_logs
from lib.machine import get_system_info
from lib.cleanup import format_size
from lib.docker_ops import is_docker_running, get_containers
from lib.llm_brain import get_llm_brain


console = Console()


def status_command(args):
    """Show status of all machines."""
    console.print(Panel("[bold cyan]JARVIS Status[/bold cyan]", border_style="cyan"))
    
    # Mac status
    try:
        info = get_system_info()
        
        console.print("\n[bold green]Mac (Local)[/bold green]")
        console.print(f"  Disk: {info.disk.free_gb:.1f}GB free / {info.disk.total_gb:.1f}GB ({info.disk.used_pct:.1f}% used)")
        console.print(f"  RAM: {info.ram_used_gb:.1f}GB / {info.ram_total_gb:.1f}GB ({info.ram_used_pct:.1f}% used)")
        console.print(f"  CPU Idle: {info.cpu_idle_pct:.1f}%")
        
        if is_docker_running():
            containers = get_containers()
            running = [c for c in containers if c.state == "running"]
            console.print(f"  Docker: Running ({len(running)} containers)")
        else:
            console.print("  Docker: Not running")
            
    except Exception as e:
        console.print(f"[red]Mac: Error - {e}[/red]")
    
    # VPS status - create fresh SSH manager
    import lib.ssh_manager as sm
    sm._manager = None
    ssh = sm.get_ssh_manager()
    
    for machine_name, display_name in [("vps_main", "VPS (187.77.12.13)"), ("vps_hostinger", "VPS (Hostinger)")]:
        try:
            # Check if machine is enabled
            config = get_config()
            if not config.machines.get(machine_name, {}).get("enabled", False):
                console.print(f"\n[yellow]{display_name}[/yellow]")
                console.print("  [yellow]Disabled (SSH key issue)[/yellow]")
                continue
                
            # Use ssh manager's exec_command method
            stdout, stderr, exit_code = ssh.exec_command(machine_name, "df -h /", timeout=10)
            
            # Parse disk usage
            lines = stdout.strip().split('\n')
            disk_line = lines[-1] if lines else ""
            parts = disk_line.split()
            disk_usage = parts[4] if len(parts) > 4 else "unknown"
            
            console.print(f"\n[bold green]{display_name}[/bold green]")
            console.print("  SSH: Connected")
            console.print(f"  Disk: {disk_usage} used")
            
        except Exception as e:
            console.print(f"\n[red]{display_name}[/red]")
            console.print(f"  [red]Offline: {type(e).__name__}: {str(e)[:40]}[/red]")

    # AI brain status
    brain = get_llm_brain()
    if brain.available:
        console.print("\n[bold green]AI Brain[/bold green]")
        console.print(f"  Online (MiniMax · {brain.model})")
    else:
        console.print("\n[yellow]AI Brain[/yellow]")
        console.print("  [yellow]Offline — set MINIMAX_API_KEY in ~/.jarvis/.env[/yellow]")

    console.print()


def ask_command(args):
    """Ask the JARVIS AI brain a question."""
    question = " ".join(args.question).strip()
    if not question:
        console.print("[yellow]Usage: jarvis ask \"your question\"[/yellow]")
        return

    brain = get_llm_brain()
    if not brain.available:
        console.print(
            "[red]AI brain unavailable.[/red] "
            "Set [cyan]MINIMAX_API_KEY[/cyan] in [cyan]~/.jarvis/.env[/cyan]."
        )
        return

    # Give the brain live system context when available.
    state = None
    try:
        info = get_system_info()
        state = {
            "machine": "mac",
            "disk_used_pct": round(info.disk.used_pct, 1),
            "free_gb": round(info.disk.free_gb, 1),
            "ram_used_pct": round(info.ram_used_pct, 1),
        }
    except Exception:
        pass

    with console.status("[cyan]JARVIS is thinking...[/cyan]"):
        try:
            answer = brain.chat(question, system_state=state)
        except Exception as e:
            console.print(f"[red]AI request failed: {e}[/red]")
            return

    console.print(Panel(answer, title="[bold cyan]JARVIS[/bold cyan]", border_style="cyan"))


def log_command(args):
    """Show audit log."""
    limit = args.limit or 20
    
    logs = get_recent_logs(limit=limit)
    
    if not logs:
        console.print("[yellow]No log entries yet[/yellow]")
        return
    
    table = Table(title=f"Recent Activity (last {limit})")
    table.add_column("Time", style="dim")
    table.add_column("Machine", style="cyan")
    table.add_column("Action", style="yellow")
    table.add_column("Size", style="magenta")
    
    for log in logs:
        timestamp = log['timestamp'][:16].replace('T', ' ')
        machine = log['machine']
        action = log['action_type']
        size = format_size(log['bytes_freed'] or 0) if log['bytes_freed'] else "-"
        
        table.add_row(timestamp, machine, action, size)
    
    console.print(table)


def tidy_now(args):
    """Run cleanup now."""
    from lib.cleanup import find_cleanup_targets, create_cleanup_plan, execute_cleanup
    
    console.print("[cyan]JARVIS: Scanning for cleanup targets...[/cyan]")
    
    home = str(Path.home())
    targets = list(find_cleanup_targets(home))[:50]
    
    if not targets:
        console.print("[green]Nothing to clean![/green]")
        return
    
    total_size = sum(p[1] for p in targets)
    console.print(f"\n[yellow]Found {len(targets)} items ({format_size(total_size)})[/yellow]")
    
    paths = [p[0] for p in targets]
    plan = create_cleanup_plan("mac", paths, "Manual cleanup")
    
    dry_run = args.dry_run or args.preview
    
    if dry_run:
        console.print("[yellow]Dry-run mode - showing what would be cleaned:[/yellow]")
        for path in paths[:10]:
            console.print(f"  - {path}")
        if len(paths) > 10:
            console.print(f"  ... and {len(paths) - 10} more")
    else:
        results = execute_cleanup(plan, dry_run=False)
        success = sum(1 for r in results if r.success)
        # Report bytes actually freed (successful deletions only), not the
        # pre-scan total — some deletions may fail.
        freed = sum(r.size_bytes for r in results if r.success)
        failed = len(results) - success
        msg = f"Cleaned {success} items, freed {format_size(freed)}"
        if failed:
            msg += f" ({failed} failed)"
        console.print(f"[green]{msg}[/green]")

        # Record manual cleanups in the audit trail so they show up in
        # `jarvis log` / `jarvis stats`, matching the scheduled tidy job.
        from lib.database import log_action
        log_action(
            machine="mac",
            action_type="tidy",
            description=f"Manual cleanup: {success} items",
            files_affected=paths[:20],
            bytes_freed=freed,
            outcome="success" if not failed else "partial",
            llm_reasoning="Manual `jarvis tidy` invocation",
        )

    log_command(argparse.Namespace(limit=5, machine=None))


def stats(args):
    """Show JARVIS stats."""
    from contextlib import closing
    from lib.database import get_connection

    with closing(get_connection()) as conn:
        # Count logs
        total_actions = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]

        # Recent activity
        actions_24h = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE timestamp > datetime('now', '-24 hours')"
        ).fetchone()[0]

        # By machine
        machine_counts = conn.execute(
            "SELECT machine, COUNT(*) FROM audit_log GROUP BY machine"
        ).fetchall()

        # Total freed
        total_freed = conn.execute("SELECT SUM(bytes_freed) FROM audit_log").fetchone()[0] or 0

    console.print(Panel("[bold cyan]JARVIS Statistics[/bold cyan]", border_style="cyan"))
    console.print(f"\n[green]Total Actions:[/green] {total_actions}")
    console.print(f"[green]Actions (24h):[/green] {actions_24h}")
    console.print(f"[green]Space Freed:[/green] {format_size(total_freed)}")
    
    console.print("\n[green]By Machine:[/green]")
    for machine, count in machine_counts:
        console.print(f"  - {machine}: {count} actions")


def dashboard_command(args):
    """Launch the JARVIS holographic dashboard & command centre."""
    from lib.dashboard import DEFAULT_HOST, DEFAULT_PORT, serve

    host = args.host or DEFAULT_HOST
    port = args.port or DEFAULT_PORT
    console.print(
        Panel(
            f"[bold cyan]JARVIS Command Centre[/bold cyan]\n"
            f"Opening holographic HUD at [cyan]http://{host}:{port}[/cyan]",
            border_style="cyan",
        )
    )
    try:
        serve(host=host, port=port, open_browser=not args.no_browser)
    except OSError as e:
        console.print(f"[red]Could not start dashboard: {e}[/red]")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="JARVIS - Autonomous Machine Agent", prog="jarvis")

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    subparsers.add_parser("status", help="Show system status").add_argument("-v", "--verbose", action="store_true")

    log_parser = subparsers.add_parser("log", help="View audit log")
    log_parser.add_argument("-n", "--limit", type=int, default=20)

    tidy_parser = subparsers.add_parser("tidy", help="Run cleanup now")
    tidy_parser.add_argument("-n", "--dry-run", action="store_true")
    tidy_parser.add_argument("-p", "--preview", action="store_true")

    subparsers.add_parser("stats", help="Show JARVIS statistics")

    ask_parser = subparsers.add_parser("ask", help="Ask the JARVIS AI brain a question")
    ask_parser.add_argument("question", nargs="+", help="Your question")

    dash_parser = subparsers.add_parser("dashboard", help="Launch the holographic dashboard & command centre")
    dash_parser.add_argument("--host", default=None, help="Bind host (default 127.0.0.1, loopback only)")
    dash_parser.add_argument("--port", type=int, default=None, help="Bind port (default 7327)")
    dash_parser.add_argument("--no-browser", action="store_true", help="Don't auto-open a browser")

    args = parser.parse_args()

    if args.command == "status":
        status_command(args)
    elif args.command == "log":
        log_command(args)
    elif args.command == "tidy":
        tidy_now(args)
    elif args.command == "stats":
        stats(args)
    elif args.command == "ask":
        ask_command(args)
    elif args.command == "dashboard":
        dashboard_command(args)
    else:
        # Default: show status
        status_command(argparse.Namespace(verbose=False))


if __name__ == "__main__":
    main()