"""File cleanup operations with dry-run safety."""
from __future__ import annotations
import os
import shutil
from pathlib import Path
from typing import Generator
from dataclasses import dataclass


@dataclass
class CleanupPlan:
    """Plan for cleanup operation."""
    files: list[str]
    total_size: int
    description: str


@dataclass
class CleanupResult:
    """Result of a single cleanup action."""
    path: str
    size_bytes: int
    success: bool
    error: str | None = None


# Patterns that indicate temp/cache files
CLEANUP_PATTERNS = [
    "**/__pycache__",
    "**/*.pyc",
    "**/*.pyo",
    "**/.pytest_cache",
    "**/.mypy_cache",
    "**/.ruff_cache",
    "**/.npm",
    "**/.yarn",
    "**/.cache",
    "**/*.log",
    "**/*.log.*",
    "**/logs/*.log",
    "**/tmp/*",
    "**/temp/*",
    "**/.DS_Store",
    "**/Thumbs.db",
    "**/*.swp",
    "**/*.swo",
    "**/*~",
]

# Patterns to always skip (protected paths)
SKIP_PATTERNS = [
    ".jarvis",  # never clean our own logs / memory.db / config
    ".ssh",
    ".config",
    ".local",
    ".kube",
    ".docker",
    "Library/Application Support",
    "Library/Caches",
]


def should_skip(path: str) -> bool:
    """Check if path should be skipped (protected)."""
    path_lower = path.lower()
    for skip in SKIP_PATTERNS:
        if skip.lower() in path_lower:
            return True
    return False


def get_directory_size(path: str) -> int:
    """Get total size of directory recursively."""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            if should_skip(dirpath):
                dirnames.clear()  # Don't recurse into skipped dirs
                continue
            for f in filenames:
                try:
                    fp = os.path.join(dirpath, f)
                    total += os.path.getsize(fp)
                except (OSError, FileNotFoundError):
                    pass
    except (OSError, PermissionError):
        pass
    return total


def find_cleanup_targets(
    base_path: str,
    patterns: list[str] | None = None,
    max_depth: int = 10
) -> Generator[tuple[str, int], None, None]:
    """Find files/directories matching cleanup patterns.

    Yields (path, size_bytes) tuples.
    Uses pathlib rglob for proper recursive glob matching.
    """
    if patterns is None:
        patterns = CLEANUP_PATTERNS

    base = Path(base_path).expanduser().resolve()
    seen: set[str] = set()

    for pattern in patterns:
        try:
            # Remove "**/" prefix safely (avoid lstrip which corrupts glob chars)
            clean = pattern.removeprefix("**/")
            for match in base.rglob(clean):
                try:
                    match_str = str(match)
                    if match_str in seen:
                        continue
                    if not match.exists():
                        continue
                    if should_skip(match_str):
                        continue

                    # Skip symlinks to avoid following into system dirs
                    if match.is_symlink():
                        continue

                    size = get_directory_size(match_str) if match.is_dir() else match.stat().st_size
                    seen.add(match_str)
                    yield match_str, size
                except (OSError, PermissionError, FileNotFoundError):
                    pass
        except (OSError, PermissionError):
            pass


def create_cleanup_plan(
    machine: str,
    paths: list[str],
    description: str
) -> CleanupPlan:
    """Create cleanup plan from paths."""
    total_size = 0
    valid_files = []

    for path in paths:
        if os.path.exists(path):
            size = get_directory_size(path) if os.path.isdir(path) else os.path.getsize(path)
            total_size += size
            valid_files.append(path)

    return CleanupPlan(
        files=valid_files,
        total_size=total_size,
        description=description
    )


def execute_cleanup(
    plan: CleanupPlan,
    dry_run: bool = True
) -> list[CleanupResult]:
    """Execute cleanup plan, returning results."""
    results = []

    for file_path in plan.files:
        try:
            if dry_run:
                size = get_directory_size(file_path) if os.path.isdir(file_path) else os.path.getsize(file_path)
                results.append(CleanupResult(
                    path=file_path,
                    size_bytes=size,
                    success=True
                ))
            else:
                size = get_directory_size(file_path) if os.path.isdir(file_path) else os.path.getsize(file_path)

                if os.path.isdir(file_path):
                    shutil.rmtree(file_path, ignore_errors=True)
                else:
                    os.remove(file_path)

                results.append(CleanupResult(
                    path=file_path,
                    size_bytes=size,
                    success=True
                ))
        except Exception as e:
            results.append(CleanupResult(
                path=file_path,
                size_bytes=0,
                success=False,
                error=str(e)
            ))

    return results


def format_size(bytes_val: int | None) -> str:
    """Format bytes as human-readable string."""
    if bytes_val is None or bytes_val <= 0:
        return "0B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f}{unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f}PB"
