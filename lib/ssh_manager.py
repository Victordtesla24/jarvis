"""SSH manager for connecting to VPS machines."""
from __future__ import annotations
import time
from pathlib import Path
from dataclasses import dataclass

import paramiko
from paramiko.ssh_exception import SSHException

from lib.config import get_config


@dataclass
class SSHConnection:
    """Represents an SSH connection to a machine."""
    name: str
    hostname: str
    ssh_user: str
    ssh_key: str
    ssh_port: int = 22
    client: paramiko.SSHClient | None = None
    last_connected: float = 0


class SSHManager:
    """Manages SSH connections to remote machines."""

    def __init__(self):
        self.config = get_config()
        self.connections: dict[str, SSHConnection] = {}
        self._init_connections()

    def _init_connections(self):
        """Initialize connection configs from config."""
        machines = self.config.machines

        for machine_name, machine_config in machines.items():
            if not machine_config.get("enabled", False):
                continue

            key_path = machine_config.get("ssh_key", "")
            if not key_path:
                # Skip machines without SSH keys (local machines)
                continue

            key_path = str(Path(key_path).expanduser())

            self.connections[machine_name] = SSHConnection(
                name=machine_name,
                hostname=machine_config.get("hostname", ""),
                ssh_user=machine_config.get("ssh_user", "root"),
                ssh_key=key_path,
                ssh_port=machine_config.get("ssh_port", 22)
            )

    def _load_private_key(self, key_path: str) -> paramiko.PKey:
        """Load a private key, trying multiple formats."""
        if not key_path or not Path(key_path).exists():
            raise FileNotFoundError(f"SSH key not found: {key_path}")

        # Try each key type
        key_classes = [
            paramiko.Ed25519Key,
            paramiko.RSAKey,
            paramiko.ECDSAKey,
        ]
        # DSSKey removed in paramiko >= 3.0
        try:
            key_classes.append(paramiko.DSSKey)
        except AttributeError:
            pass

        errors = []
        for key_cls in key_classes:
            try:
                return key_cls.from_private_key_file(key_path)
            except SSHException as e:
                errors.append(f"{key_cls.__name__}: {e}")
            except Exception:
                pass  # Wrong key type entirely

        raise SSHException(
            f"Could not load SSH key {key_path}. Errors: {'; '.join(errors)}"
        )

    def _connect(self, conn: SSHConnection) -> paramiko.SSHClient:
        """Establish or reconnect SSH connection."""
        if conn.client is not None:
            try:
                transport = conn.client.get_transport()
                if transport and transport.is_active():
                    return conn.client
            except Exception:
                conn.client = None

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            key = self._load_private_key(conn.ssh_key)
        except Exception as e:
            raise ConnectionError(
                f"Failed to load SSH key for {conn.name}: {e}"
            )

        client.connect(
            hostname=conn.hostname,
            port=conn.ssh_port,
            username=conn.ssh_user,
            pkey=key,
            timeout=30,
            banner_timeout=10,
            auth_timeout=10,
        )

        conn.client = client
        conn.last_connected = time.time()
        return conn.client

    def get_connection(self, name: str) -> paramiko.SSHClient:
        """Get active SSH connection, connecting if needed."""
        if name not in self.connections:
            raise ValueError(f"Unknown machine: {name}")

        conn = self.connections[name]
        return self._connect(conn)

    def exec_command(
        self, machine: str, command: str, timeout: int = 30
    ) -> tuple[str, str, int]:
        """Execute command on remote machine. Returns (stdout, stderr, exit_code)."""
        client = self.get_connection(machine)
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        return (
            stdout.read().decode('utf-8', errors='replace'),
            stderr.read().decode('utf-8', errors='replace'),
            exit_code
        )

    def exec_with_retry(
        self, machine: str, command: str, retries: int = 3, timeout: int = 30
    ) -> tuple[str, str, int]:
        """Execute command with automatic retry on failure."""
        attempts = max(1, retries)
        last_error: Exception | None = None
        for attempt in range(attempts):
            try:
                return self.exec_command(machine, command, timeout)
            except Exception as e:
                last_error = e
                # Reset connection for retry — guard against a None client
                # (e.g. the very first connect raised before one was set).
                conn = self.connections.get(machine)
                if conn is not None:
                    if conn.client is not None:
                        try:
                            conn.client.close()
                        except Exception:
                            pass
                    conn.client = None
                if attempt < attempts - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff

        # All attempts exhausted.
        assert last_error is not None  # at least one attempt always runs
        raise last_error

    def close_all(self):
        """Close all SSH connections."""
        for conn in self.connections.values():
            if conn.client:
                try:
                    conn.client.close()
                except Exception:
                    pass
                conn.client = None


# Singleton instance
_manager: SSHManager | None = None


def get_ssh_manager() -> SSHManager:
    """Get singleton SSH manager instance."""
    global _manager
    if _manager is None:
        _manager = SSHManager()
    return _manager
