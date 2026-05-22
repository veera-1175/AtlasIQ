import sqlite3
import time
from pathlib import Path
from typing import Any

from app.core.config import get_settings


def execute_query(db_path: Path, sql: str) -> tuple[list[str], list[dict[str, Any]], int]:
    settings = get_settings()
    limited_sql = sql.strip().rstrip(";")
    if "limit" not in limited_sql.lower():
        limited_sql = f"{limited_sql} LIMIT {settings.max_query_rows}"

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute(f"PRAGMA query_timeout = {settings.query_timeout_sec * 1000}")
        start = time.perf_counter()
        cursor = conn.execute(limited_sql)
        rows_raw = cursor.fetchmany(settings.max_query_rows)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        columns = [desc[0] for desc in cursor.description or []]
        rows = [dict(zip(columns, row)) for row in rows_raw]
        return columns, rows, elapsed_ms
    finally:
        conn.close()
