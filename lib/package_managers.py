"""Package manager operations for Mac and VPS.

Mac: Homebrew, pip/uv, npm
VPS: apt (via SSH), pip/uv (via SSH)

IMPORTANT: VPS package operations are now invoked via SSH from
scheduler.py, not run locally. The local-only functions here are
for the Mac machine; VPS execs its own commands over SSH.
"""
from __future__ import annotations
import subprocess
import json
from dataclasses import dataclass


@dataclass
class PackageUpdate:
    """Represents an available package update."""
    name: str
    current_version: str
    latest_version: str
    size: str | None = None


@dataclass
class UpdateResult:
    """Result of update operation."""
    success: bool
    packages_updated: int
    packages_failed: int
    output: str
    error: str | None = None


def run_command(cmd: str, timeout: int = 300) -> tuple[str, str, int]:
    """Run shell command, return (stdout, stderr, returncode)."""
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    return result.stdout, result.stderr, result.returncode


def update_homebrew() -> UpdateResult:
    """Update Mac packages via Homebrew."""
    # Quick pre-flight: is brew available?
    _, _, rc = run_command("which brew", timeout=10)
    if rc != 0:
        return UpdateResult(
            success=False,
            packages_updated=0,
            packages_failed=0,
            output="Homebrew not installed",
            error="brew not found"
        )

    # Update brew itself (non-fatal if it fails)
    run_command("brew update 2>/dev/null", timeout=120)

    # List outdated
    stdout2, _, _ = run_command("brew outdated --json 2>/dev/null", timeout=60)

    try:
        data = json.loads(stdout2) if stdout2.strip() else {}
        outdated = len(data.get("formulae", []) + data.get("casks", []))
    except (json.JSONDecodeError, TypeError):
        outdated = 0

    if outdated == 0:
        return UpdateResult(
            success=True,
            packages_updated=0,
            packages_failed=0,
            output="Brew: all packages up to date",
        )

    # Upgrade all
    stdout3, stderr3, rc3 = run_command("brew upgrade 2>/dev/null", timeout=600)

    # Cleanup
    run_command("brew cleanup 2>/dev/null", timeout=120)

    return UpdateResult(
        success=rc3 == 0,
        packages_updated=outdated,
        packages_failed=0,
        output=f"Brew: {outdated} packages outdated, upgrade attempted",
        error=stderr3 if rc3 != 0 else None
    )


def update_pip() -> UpdateResult:
    """Update Python packages via uv (preferred) or pip."""
    # Check for uv first
    stdout, _, rc = run_command("which uv", timeout=10)
    use_uv = rc == 0

    if use_uv:
        # Check outdated
        stdout, _, _ = run_command(
            "uv pip list --outdated --format json 2>/dev/null || echo '[]'",
            timeout=60
        )
        try:
            outdated = json.loads(stdout) if stdout.strip() else []
            count = len(outdated)
        except (json.JSONDecodeError, TypeError):
            count = 0

        if count == 0:
            return UpdateResult(
                success=True,
                packages_updated=0,
                packages_failed=0,
                output="uv pip: all packages up to date",
            )

        # uv has no bulk "upgrade all" for a non-project environment; refresh
        # pip itself but report the outdated set honestly — the outdated
        # packages themselves are NOT upgraded here.
        _, stderr2, rc2 = run_command(
            "uv pip install --upgrade pip 2>/dev/null",
            timeout=300
        )

        return UpdateResult(
            success=rc2 == 0,
            packages_updated=0,
            packages_failed=0,
            output=f"uv pip: {count} packages outdated (upgrade manually)",
            error=stderr2 if rc2 != 0 else None
        )
    else:
        # Fallback to pip
        stdout, _, _ = run_command(
            "pip list --outdated --format json 2>/dev/null || echo '[]'",
            timeout=60
        )
        try:
            outdated = json.loads(stdout) if stdout.strip() else []
            count = len(outdated)
        except (json.JSONDecodeError, TypeError):
            count = 0

        if count == 0:
            return UpdateResult(
                success=True,
                packages_updated=0,
                packages_failed=0,
                output="pip: all packages up to date",
            )

        return UpdateResult(
            success=True,
            packages_updated=0,
            packages_failed=0,
            output=f"pip: {count} packages outdated (upgrade manually)",
        )


def update_npm() -> UpdateResult:
    """Update npm global packages."""
    _, _, rc = run_command("which npm", timeout=10)
    if rc != 0:
        return UpdateResult(
            success=True,
            packages_updated=0,
            packages_failed=0,
            output="npm: not installed",
        )

    # Check outdated
    stdout, _, _ = run_command(
        "npm outdated -g --json 2>/dev/null || echo '{}'",
        timeout=60
    )

    try:
        data = json.loads(stdout) if stdout.strip() else {}
        count = len(data)
    except (json.JSONDecodeError, TypeError):
        count = 0

    if count == 0:
        return UpdateResult(
            success=True,
            packages_updated=0,
            packages_failed=0,
            output="npm: all global packages up to date",
        )

    # Update
    stdout2, stderr2, rc2 = run_command("npm update -g 2>/dev/null", timeout=300)

    return UpdateResult(
        success=rc2 == 0,
        packages_updated=count,
        packages_failed=0,
        output=f"npm: {count} global packages outdated, update attempted",
        error=stderr2 if rc2 != 0 else None
    )


def update_all_packages(machine: str) -> list[UpdateResult]:
    """Run all appropriate LOCAL package updates for a machine.

    Note: For VPS machines, package updates are handled by scheduler.py
    via SSH directly (apt-get). This function only runs LOCAL package
    managers. The 'vps' machine type returns empty — VPS updates are
    now fully SSH-driven from the scheduler.
    """
    if machine == "mac":
        results = []
        for updater in [update_homebrew, update_pip, update_npm]:
            try:
                results.append(updater())
            except Exception as e:
                results.append(UpdateResult(
                    success=False,
                    packages_updated=0,
                    packages_failed=0,
                    output=f"Failed: {e}",
                    error=str(e)
                ))
        return results
    else:
        # VPS: updates run via SSH in scheduler.py
        return [UpdateResult(
            success=True,
            packages_updated=0,
            packages_failed=0,
            output="VPS: package updates handled via SSH",
        )]
