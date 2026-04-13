"""
Database helpers for direct pgRouting access.
"""

from contextlib import contextmanager
import os

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - exercised only when dependency is missing
    psycopg = None
    dict_row = None


DEFAULT_DATABASE_URI = "postgresql://postgres:postgres@localhost:5432/indoor_map"


def get_database_uri() -> str:
    """Return the database connection string used by the routing service."""
    return os.getenv("PGR_DATABASE_URI") or os.getenv("DATABASE_URI", DEFAULT_DATABASE_URI)


@contextmanager
def get_connection():
    """Yield a PostgreSQL connection configured for dict-like rows."""
    if psycopg is None:
        raise RuntimeError(
            "psycopg is not installed. Add 'psycopg[binary]' to the Routing Service dependencies."
        )

    conn = psycopg.connect(get_database_uri(), row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()
