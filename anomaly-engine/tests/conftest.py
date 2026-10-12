"""Shared pytest fixtures and helpers for the anomaly engine test suite."""

from unittest.mock import MagicMock


def make_connection_mock():
    """Return a MagicMock standing in for the ``connection()`` context manager.

    The production code now acquires connections via::

        with connection() as conn:
            cursor = conn.cursor()
            ...

    so a mock that replaces ``connection`` must behave as a callable returning
    a context manager. This helper wires the mock so that both

        conn = mock.return_value          # the context-manager object
        conn.__enter__() is conn          # entering yields that same object

    which means ``conn.cursor.return_value`` is the cursor seen inside the
    ``with`` block. That keeps the existing per-test wiring
    (``mock.return_value.cursor.return_value = mock_cursor``) working unchanged.
    """
    mock_connection = MagicMock()
    cm = mock_connection.return_value
    cm.__enter__.return_value = cm
    cm.__exit__.return_value = False
    return mock_connection
