"""Docker container and image management."""
from __future__ import annotations
import subprocess
from dataclasses import dataclass


@dataclass
class DockerContainer:
    """Represents a Docker container."""
    id: str
    name: str
    image: str
    status: str
    state: str


@dataclass
class CleanupResult:
    """Result of Docker cleanup."""
    action: str
    removed: int
    space_freed: str


def run_docker(cmd: str, timeout: int = 120) -> tuple[str, str, int]:
    """Run docker command, return (stdout, stderr, returncode)."""
    result = subprocess.run(
        f"docker {cmd}",
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    return result.stdout, result.stderr, result.returncode


def get_containers() -> list[DockerContainer]:
    """Get list of Docker containers."""
    fmt = '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}'
    stdout, _, rc = run_docker(f"ps -a --format '{fmt}'")
    
    if rc != 0:
        return []
    
    containers = []
    for line in stdout.strip().split('\n'):
        if line:
            parts = line.split('\t')
            if len(parts) >= 5:
                containers.append(DockerContainer(
                    id=parts[0],
                    name=parts[1],
                    image=parts[2],
                    status=parts[3],
                    state=parts[4]
                ))
    
    return containers


def is_docker_running() -> bool:
    """Check if Docker daemon is running."""
    stdout, stderr, rc = run_docker("info")
    return rc == 0


def _parse_prune_output(stdout: str) -> tuple[int, str]:
    """Parse `docker ... prune -f` output into (entries_removed, space_freed).

    Docker lists each removed item under a ``Deleted ...:`` header and ends
    with ``Total reclaimed space: <size>`` — which it prints even when nothing
    was removed. Count the listed entries rather than assuming a fixed number.
    """
    count = 0
    space = "0B"
    in_deleted_section = False

    for raw in stdout.split('\n'):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Deleted") and line.endswith(":"):
            in_deleted_section = True
            continue
        if line.startswith("Total reclaimed space"):
            space = line.split(':', 1)[1].strip() if ':' in line else "0B"
            in_deleted_section = False
            continue
        if in_deleted_section:
            count += 1

    return count, space


def prune_containers(dry_run: bool = True) -> CleanupResult:
    """Remove stopped containers."""
    if dry_run:
        stdout, _, _ = run_docker("ps -a --filter 'status=exited' --format '{{.Names}}'")
        count = len(stdout.strip().split('\n')) if stdout.strip() else 0
        return CleanupResult(
            action="prune_containers",
            removed=count,
            space_freed="(dry-run) would remove stopped containers"
        )

    stdout, _, _ = run_docker("container prune -f")
    removed, space = _parse_prune_output(stdout)
    return CleanupResult(action="prune_containers", removed=removed, space_freed=space)


def prune_images(dry_run: bool = True) -> CleanupResult:
    """Remove dangling images."""
    if dry_run:
        stdout, _, _ = run_docker("images -f 'dangling=true' --format '{{.Repository}}:{{.Tag}}'")
        dangling = len(stdout.strip().split('\n')) if stdout.strip() else 0

        return CleanupResult(
            action="prune_images",
            removed=dangling,
            space_freed="(dry-run) would remove dangling images"
        )

    stdout, _, _ = run_docker("image prune -f")
    removed, space = _parse_prune_output(stdout)
    return CleanupResult(action="prune_images", removed=removed, space_freed=space)


def system_prune(dry_run: bool = True) -> list[CleanupResult]:
    """Run full system prune."""
    results = []
    
    results.append(prune_containers(dry_run))
    results.append(prune_images(dry_run))
    
    return results


def restart_container(name_or_id: str, max_retries: int = 3) -> bool:
    """Restart a container, returning success."""
    for attempt in range(max_retries):
        stdout, stderr, rc = run_docker(f"restart {name_or_id}")
        if rc == 0:
            return True
    
    return False


def get_container_status(name: str) -> str | None:
    """Get current status of a container."""
    stdout, _, rc = run_docker(f"ps -a --filter 'name=^{name}$' --format '{{.State}}'")
    
    if rc == 0 and stdout.strip():
        return stdout.strip()
    
    return None