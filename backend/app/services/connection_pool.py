"""PostgreSQL connection pooling with optional read-replica routing for SELECT queries."""

import threading
import time
from typing import Any
from urllib.parse import urlparse

from app.core.config import get_settings

_pools: dict[str, Any] = {}
_pool_lock = threading.Lock()


def _pool_key(url: str, read_only: bool) -> str:
    return f"{'ro' if read_only else 'rw'}:{url}"


def _create_pool(url: str):
    import psycopg2.pool

    settings = get_settings()
    return psycopg2.pool.ThreadedConnectionPool(
        minconn=settings.pg_pool_min_connections,
        maxconn=settings.pg_pool_max_connections,
        dsn=url,
    )


def get_pooled_connection(primary_url: str, read_replica_url: str | None = None, for_read: bool = True):
    settings = get_settings()
    url = primary_url
    if for_read and settings.use_read_replicas and read_replica_url:
        url = read_replica_url

    key = _pool_key(url, for_read)
    with _pool_lock:
        if key not in _pools:
            _pools[key] = _create_pool(url)
        pool = _pools[key]

    conn = pool.getconn()
    conn.set_session(readonly=for_read, autocommit=True)
    return conn, pool


def release_connection(conn, pool) -> None:
    try:
        pool.putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass


def execute_pooled_query(
    primary_url: str,
    sql: str,
    max_rows: int,
    read_replica_url: str | None = None,
    timeout_sec: int | None = None,
) -> tuple[list[str], list[dict[str, Any]], int]:
    import psycopg2.extras

    settings = get_settings()
    timeout = timeout_sec or settings.query_timeout_sec
    limited_sql = sql.strip().rstrip(";")
    if "limit" not in limited_sql.lower():
        limited_sql = f"{limited_sql} LIMIT {max_rows}"

    conn, pool = get_pooled_connection(primary_url, read_replica_url, for_read=True)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"SET statement_timeout = '{timeout * 1000}'")
            start = time.perf_counter()
            cur.execute(limited_sql)
            rows_raw = cur.fetchmany(max_rows)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            if not rows_raw:
                return [], [], elapsed_ms
            columns = list(rows_raw[0].keys())
            return columns, [dict(r) for r in rows_raw], elapsed_ms
    finally:
        release_connection(conn, pool)


def is_warehouse_url(url: str) -> bool:
    schemes = ("postgresql://", "postgres://", "redshift://", "snowflake://")
    return url.lower().startswith(schemes)


def normalize_warehouse_url(url: str) -> tuple[str, str]:
    """Return (source_type, dialect) for a warehouse connection URL."""
    lower = url.lower()
    if lower.startswith(("postgresql://", "postgres://")):
        return "postgres", "postgres"
    if lower.startswith("redshift://"):
        # Redshift uses PostgreSQL wire protocol
        normalized = "postgresql://" + url[len("redshift://"):]
        return "redshift", "postgres"
    if lower.startswith("snowflake://"):
        return "snowflake", "snowflake"
    raise ValueError("Unsupported warehouse URL scheme. Use postgresql://, redshift://, or snowflake://")
