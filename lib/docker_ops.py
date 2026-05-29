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
    
    stdout, stderr, rc = run_docker("container prune -f")
    
    for line in stdout.split('\n'):
        if 'Total reclaimed space' in line:
            return CleanupResult(
                action="prune_containers",
                removed=1,
                space_freed=line.split(':')[1].strip() if ':' in line else "unknown"
            )
    
    return CleanupResult(action="prune_containers", removed=0, space_freed="0B")


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
    
    stdout, stderr, rc = run_docker("image prune -f")
    
    for line in stdout.split('\n'):
        if 'Total reclaimed space' in line:
            space = line.split(':')[1].strip() if ':' in line else "0B"
            return CleanupResult(
                action="prune_images",
                removed=1,
                space_freed=space
            )
    
    return CleanupResult(action="prune_images", removed=0, space_freed="0B")


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