"""SQLite memory and audit database for JARVIS."""
from __future__ import annotations
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path
import json


DB_PATH = Path.home() / ".jarvis" / "memory.db"


def get_connection() -> sqlite3.Connection:
    """Open a fresh database connection, creating the schema if needed.

    Callers are responsible for closing the returned connection. Internal
    helpers below use ``with closing(get_connection())`` so they never leak;
    the daemon scheduler invokes them on every run, so a per-call leak would
    accumulate connections for the life of the process.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Create tables on first connection (idempotent — IF NOT EXISTS).
    _init_schema(conn)

    return conn


def _init_schema(conn: sqlite3.Connection):
    """Initialize database schema."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS machine_state (
            machine TEXT PRIMARY KEY,
            hostname TEXT,
            disk_used_pct REAL,
            ram_used_pct REAL,
            cpu_avg REAL,
            last_updated TEXT,
            metadata TEXT
        );
        
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            machine TEXT NOT NULL,
            action_type TEXT NOT NULL,
            description TEXT,
            files_affected TEXT,
            bytes_freed INTEGER,
            outcome TEXT,
            llm_reasoning TEXT
        );
        
        CREATE TABLE IF NOT EXISTS user_preferences (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS task_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            machine TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            status TEXT,
            result TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_machine ON audit_log(machine);
        CREATE INDEX IF NOT EXISTS idx_task_started ON task_history(started_at);
    """)


def log_action(
    machine: str,
    action_type: str,
    description: str,
    files_affected: list[str] | None = None,
    bytes_freed: int | None = None,
    outcome: str = "success",
    llm_reasoning: str | None = None
):
    """Log an action to the audit trail."""
    with closing(get_connection()) as conn:
        conn.execute("""
            INSERT INTO audit_log (timestamp, machine, action_type, description, files_affected, bytes_freed, outcome, llm_reasoning)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            machine,
            action_type,
            description,
            json.dumps(files_affected) if files_affected else None,
            bytes_freed,
            outcome,
            llm_reasoning
        ))
        conn.commit()


def get_recent_logs(limit: int = 100, machine: str | None = None) -> list[dict]:
    """Get recent audit log entries."""
    with closing(get_connection()) as conn:
        if machine:
            rows = conn.execute("""
                SELECT * FROM audit_log WHERE machine = ? ORDER BY timestamp DESC LIMIT ?
            """, (machine, limit)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?
            """, (limit,)).fetchall()
        return [dict(r) for r in rows]


def update_machine_state(machine: str, hostname: str, disk_used_pct: float, ram_used_pct: float, cpu_avg: float, metadata: dict | None = None):
    """Update the state of a machine."""
    with closing(get_connection()) as conn:
        conn.execute("""
            INSERT OR REPLACE INTO machine_state (machine, hostname, disk_used_pct, ram_used_pct, cpu_avg, last_updated, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (machine, hostname, disk_used_pct, ram_used_pct, cpu_avg, datetime.now().isoformat(), json.dumps(metadata) if metadata else None))
        conn.commit()


def get_machine_state(machine: str) -> dict | None:
    """Get the last known state of a machine."""
    with closing(get_connection()) as conn:
        row = conn.execute("SELECT * FROM machine_state WHERE machine = ?", (machine,)).fetchone()
        return dict(row) if row else None


def set_preference(key: str, value: str):
    """Set a user preference."""
    with closing(get_connection()) as conn:
        conn.execute("""
            INSERT OR REPLACE INTO user_preferences (key, value, updated_at)
            VALUES (?, ?, ?)
        """, (key, value, datetime.now().isoformat()))
        conn.commit()


def get_preference(key: str) -> str | None:
    """Get a user preference."""
    with closing(get_connection()) as conn:
        row = conn.execute("SELECT value FROM user_preferences WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None


def start_task(task_name: str, machine: str) -> int:
    """Start a task and return task ID."""
    with closing(get_connection()) as conn:
        cursor = conn.execute("""
            INSERT INTO task_history (task_name, machine, started_at, status)
            VALUES (?, ?, ?, 'running')
        """, (task_name, machine, datetime.now().isoformat()))
        conn.commit()
        return cursor.lastrowid


def complete_task(task_id: int, status: str, result: str | None = None):
    """Mark a task as completed."""
    with closing(get_connection()) as conn:
        conn.execute("""
            UPDATE task_history SET completed_at = ?, status = ?, result = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), status, result, task_id))
        conn.commit()


def cleanup_old_logs(days: int = 90) -> int:
    """Remove audit logs older than specified days. Returns rows deleted."""
    with closing(get_connection()) as conn:
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        cursor = conn.execute("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
        conn.commit()
        return cursor.rowcount