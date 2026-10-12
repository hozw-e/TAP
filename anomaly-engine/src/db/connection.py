"""MySQL connection pool using environment variables."""

import os
from contextlib import contextmanager

import mysql.connector
from mysql.connector import pooling


_pool = None


def get_pool():
    """Get or create the MySQL connection pool.

    Uses environment variables for configuration with sensible defaults
    matching the XAMPP development environment.
    """
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="anomaly_engine_pool",
            pool_size=5,
            pool_reset_session=True,
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "3306")),
            database=os.environ.get("DB_NAME", "apdc_attendance"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            charset="utf8mb4",
            collation="utf8mb4_unicode_ci",
            autocommit=True,
        )
    return _pool


def get_connection():
    """Get a connection from the pool.

    Returns a MySQL connection that should be closed after use
    to return it to the pool.

    Prefer the ``connection()`` context manager instead: it guarantees the
    connection is returned to the pool even when the body raises, which is
    what prevents the pool from being exhausted by leaked connections.
    """
    return get_pool().get_connection()


@contextmanager
def connection():
    """Yield a pooled connection, always returning it to the pool.

    Use as::

        with connection() as conn:
            cursor = conn.cursor()
            ...

    Unlike calling ``get_connection()`` and ``conn.close()`` manually, this
    returns the connection to the pool even if the body raises an exception.
    A bare ``conn.close()`` on the happy path only runs when no error occurs,
    so any exception in between leaks the connection; after ``pool_size``
    leaks the pool is permanently exhausted ("Failed getting connection;
    pool exhausted"). This context manager closes in a ``finally`` block so
    that can't happen.
    """
    conn = get_pool().get_connection()
    try:
        yield conn
    finally:
        conn.close()
