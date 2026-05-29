"""Desktop notification system for JARVIS."""
from __future__ import annotations
import logging
import subprocess
import sys

from lib.config import get_config

logger = logging.getLogger(__name__)


class Notifier:
    """Desktop notification manager for macOS."""
    
    def __init__(self):
        self.config = get_config()
        self.enabled = self.config.notifications.get("enabled", True)
        self.min_significance_mb = self.config.notifications.get("min_significance_mb", 100)
    
    def notify(
        self,
        title: str,
        message: str,
        urgency: str = "medium",
        sound: bool = True
    ) -> bool:
        """Send desktop notification using macOS osascript.
        Returns True if notification was sent successfully.
        """
        if not self.enabled:
            return False

        if sys.platform != "darwin":
            return False

        # Escape backslashes first, then double quotes, so the values are
        # safe to embed inside the AppleScript string literals.
        title = title.replace("\\", "\\\\").replace('"', '\\"')
        message = message.replace("\\", "\\\\").replace('"', '\\"')

        # The whole `display notification` command must be a single statement —
        # `sound name "..."` is a clause of it, not its own line. Splitting it
        # across lines raises an AppleScript syntax error (-10002).
        script = f'display notification "{message}" with title "{title}"'
        if sound:
            script += ' sound name "Glass"'

        try:
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                timeout=10,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            logger.warning("Notification failed: %s", exc)
            return False

        if result.returncode != 0:
            logger.warning(
                "Notification failed: %s", result.stderr.decode(errors="replace")[:100]
            )
            return False
        return True
    
    def notify_significant(
        self,
        title: str,
        message: str,
        size_freed_mb: float | None = None
    ):
        """Send notification only if action is significant."""
        if size_freed_mb is not None and size_freed_mb < self.min_significance_mb:
            return
        
        self.notify(title, message)
    
    def notify_cleanup(self, machine: str, files_removed: int, size_freed: str):
        """Notify about completed cleanup."""
        self.notify(
            f"Cleanup on {machine}",
            f"Removed {files_removed} files, freed {size_freed}",
        )
    
    def notify_update(self, machine: str, packages_updated: int):
        """Notify about package updates."""
        self.notify(
            f"Updates on {machine}",
            f"{packages_updated} packages updated",
        )
    
    def notify_alert(self, machine: str, message: str):
        """Send alert notification."""
        self.notify(
            f"Alert: {machine}",
            message,
        )
    
    def notify_vps_connection_lost(self, machine: str):
        """Notify about VPS connection failure."""
        self.notify(
            f"VPS Connection Lost: {machine}",
            "Will retry automatically.",
        )


# Singleton
_notifier = None


def get_notifier() -> Notifier:
    """Get singleton notifier instance."""
    global _notifier
    if _notifier is None:
        _notifier = Notifier()
    return _notifier