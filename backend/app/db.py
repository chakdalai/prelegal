"""SQLite schema and lifecycle.

The database is temporary: it is recreated from scratch every time the
server starts, so there is no migration story here yet — just a schema to
apply after wiping whatever file (if any) was left behind.
"""

import sqlite3
from pathlib import Path

SCHEMA_SQL = """
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    form_data TEXT NOT NULL,
    markdown TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_user_id ON documents (user_id);
"""


def init_db(db_path: Path) -> None:
    """Wipe and recreate the database file at db_path with a fresh schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()
