"""MySQL connection pool using environment variables."""

import os

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
    """
    return get_pool().get_connection()
