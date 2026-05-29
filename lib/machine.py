"""Local Mac system operations."""
import subprocess
import re
from dataclasses import dataclass


@dataclass
class DiskInfo:
    """Disk usage information."""
    total_gb: float
    used_gb: float
    free_gb: float
    used_pct: float


@dataclass
class SystemInfo:
    """System resource information."""
    disk: DiskInfo
    ram_total_gb: float
    ram_used_gb: float
    ram_used_pct: float
    cpu_idle_pct: float


def run_command(cmd: str, timeout: int = 60) -> tuple[str, str, int]:
    """Run command without sudo. Returns (stdout, stderr, exit_code)."""
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    return result.stdout, result.stderr, result.returncode


def _parse_capacity(field: str) -> float | None:
    """Parse a df 'Capacity' column like '6%' into a float percentage."""
    match = re.search(r'(\d+(?:\.\d+)?)', field)
    return float(match.group(1)) if match else None


def get_disk_info() -> DiskInfo:
    """Get disk usage using df command (no sudo needed)."""
    stdout, stderr, rc = run_command("df -H /")
    lines = stdout.strip().split('\n')

    if rc == 0 and len(lines) >= 2:
        parts = lines[1].split()

        def parse_size(s: str) -> float:
            s = s.upper()
            if 'T' in s:
                return float(re.sub(r'[^0-9.]', '', s)) * 1000
            if 'G' in s:
                return float(re.sub(r'[^0-9.]', '', s))
            if 'M' in s:
                return float(re.sub(r'[^0-9.]', '', s)) / 1000
            if 'K' in s:
                return float(re.sub(r'[^0-9.]', '', s)) / 1_000_000
            try:
                return float(s)
            except ValueError:
                return 0

        total = parse_size(parts[1]) if len(parts) > 1 else 0
        used = parse_size(parts[2]) if len(parts) > 2 else 0
        free = parse_size(parts[3]) if len(parts) > 3 else 0

        if total > 0:
            # Prefer df's own Capacity column (e.g. "6%"). On APFS the data and
            # system volumes share a container, so used + avail != total and
            # used/total badly understates real usage. The Capacity column is
            # the authoritative figure; fall back to used/total only if it is
            # missing or unparseable.
            used_pct = _parse_capacity(parts[4]) if len(parts) > 4 else None
            if used_pct is None:
                used_pct = (used / total) * 100
            return DiskInfo(total_gb=round(total,1), used_gb=round(used,1),
                           free_gb=round(free,1), used_pct=round(used_pct,1))

    # Fallback to -k (KB blocks)
    stdout, _, rc = run_command("df -k /")
    if rc == 0:
        lines = stdout.strip().split('\n')
        if len(lines) >= 2:
            parts = lines[1].split()
            try:
                total = int(parts[1]) / (1024 * 1024)
                used = int(parts[2]) / (1024 * 1024)
                free = int(parts[3]) / (1024 * 1024)
                used_pct = _parse_capacity(parts[4]) if len(parts) > 4 else None
                if used_pct is None:
                    used_pct = (used / total) * 100 if total > 0 else 0
                return DiskInfo(total_gb=round(total,1), used_gb=round(used,1),
                               free_gb=round(free,1), used_pct=round(used_pct,1))
            except (ValueError, IndexError):
                pass

    return DiskInfo(total_gb=0, used_gb=0, free_gb=0, used_pct=0)


def get_ram_info() -> tuple[float, float, float]:
    """Get RAM info using vm_stat (no sudo needed on macOS).
    Returns (total_gb, used_gb, used_pct).
    """
    # Get total RAM
    try:
        stdout, _, rc = run_command("sysctl -n hw.memsize")
        if rc == 0 and stdout.strip():
            total_bytes = int(stdout.strip())
        else:
            total_bytes = 16 * (1024 ** 3)  # Fallback
    except Exception:
        total_bytes = 16 * (1024 ** 3)
    total_gb = total_bytes / (1024 ** 3)

    # Get memory pressure / usage via vm_stat (no sudo needed on macOS)
    try:
        stdout, _, _ = run_command("vm_stat")

        page_size = 4096  # Default macOS page size
        active_pages = 0
        wired_pages = 0
        compressed_pages = 0

        for line in stdout.split('\n'):
            if 'page size of' in line:
                match = re.search(r'(\d+)', line)
                if match:
                    page_size = int(match.group(1))
            elif 'Pages active:' in line:
                match = re.search(r'(\d+)', line)
                if match:
                    active_pages = int(match.group(1))
            elif 'Pages wired down:' in line:
                match = re.search(r'(\d+)', line)
                if match:
                    wired_pages = int(match.group(1))
            elif 'Pages occupied by compressor:' in line:
                match = re.search(r'(\d+)', line)
                if match:
                    compressed_pages = int(match.group(1))

        # macOS "used" = active + wired + compressed (inactive is cache, readily freed)
        # This is a reasonable approximation
        used_pages = active_pages + wired_pages + compressed_pages
        used_gb = (used_pages * page_size) / (1024 ** 3)
        used_pct = (used_gb / total_gb) * 100 if total_gb > 0 else 0

    except Exception:
        # Fallback: try sysctl vm.swapusage
        try:
            stdout, _, _ = run_command("sysctl vm.swapusage")
            used_gb = total_gb * 0.5  # Rough estimate
            used_pct = 50.0
        except Exception:
            used_gb = 0
            used_pct = 0

    return round(total_gb, 1), round(used_gb, 1), round(used_pct, 1)


def get_cpu_idle() -> float:
    """Get CPU idle percentage using top (no sudo needed)."""
    try:
        stdout, _, _ = run_command("top -l 1 -n 0 2>/dev/null | grep 'CPU usage'")
        # Parse: CPU usage: 6.33% user, 10.91% sys, 82.74% idle
        match = re.search(r'([\d.]+)% idle', stdout)
        if match:
            return float(match.group(1))
    except Exception:
        pass

    # Fallback: use iostat (also no sudo needed)
    try:
        stdout, _, _ = run_command("iostat -c 2 -w 1 2>/dev/null | tail -2 | head -1")
        parts = stdout.split()
        if len(parts) >= 6:
            # iostat's CPU columns are `us sy id` followed by three load
            # averages (`1m 5m 15m`), so idle is the 4th-from-last field —
            # regardless of how many disk columns precede it.
            return float(parts[-4])
    except Exception:
        pass

    return 50.0  # Conservative default


def get_system_info() -> SystemInfo:
    """Get complete system information."""
    disk = get_disk_info()
    total_ram, used_ram, ram_pct = get_ram_info()
    cpu_idle = get_cpu_idle()

    return SystemInfo(
        disk=disk,
        ram_total_gb=total_ram,
        ram_used_gb=used_ram,
        ram_used_pct=ram_pct,
        cpu_idle_pct=cpu_idle
    )
