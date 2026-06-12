import re
import sqlite3
from pathlib import Path

from app.models.schemas import CostEstimate

HIGH_COST_THRESHOLD = 100_000

_SCAN_TABLE_RE = re.compile(r"\bSCAN(?:\s+TABLE)?\s+([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)


def _scanned_tables(plan_rows: list) -> list[str]:
    tables: list[str] = []
    seen: set[str] = set()
    for row in plan_rows:
        detail = " ".join(str(c) for c in row if c)
        for match in _SCAN_TABLE_RE.finditer(detail):
            name = match.group(1).lower()
            if name not in seen:
                seen.add(name)
                tables.append(name)
    return tables


def _sqlite_table_row_count(conn: sqlite3.Connection, table: str) -> int:
    try:
        row = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()
        return int(row[0]) if row else 0
    except sqlite3.Error:
        return HIGH_COST_THRESHOLD


def estimate_sqlite_cost(db_path: Path, sql: str) -> CostEstimate:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        plan_rows = conn.execute(f"EXPLAIN QUERY PLAN {sql}").fetchall()
        details = " | ".join(" ".join(str(c) for c in row if c) for row in plan_rows)
        scanned = _scanned_tables(plan_rows)
        if scanned:
            estimated_rows = sum(_sqlite_table_row_count(conn, table) for table in scanned)
        else:
            estimated_rows = 0

        high_cost = estimated_rows >= HIGH_COST_THRESHOLD
        warning = None
        if high_cost:
            warning = "Query may scan large tables. Consider adding filters to narrow results."

        return CostEstimate(
            estimated_rows=estimated_rows,
            plan_summary=details or "No plan available",
            high_cost=high_cost,
            warning=warning,
        )
    except Exception as exc:
        return CostEstimate(
            estimated_rows=0,
            plan_summary=str(exc),
            high_cost=False,
            warning=None,
        )
    finally:
        conn.close()


def estimate_postgres_cost(connection_url: str, sql: str) -> CostEstimate:
    try:
        import psycopg2

        conn = psycopg2.connect(connection_url)
        conn.set_session(readonly=True, autocommit=True)
        try:
            with conn.cursor() as cur:
                cur.execute(f"EXPLAIN {sql}")
                plan = "\n".join(row[0] for row in cur.fetchall())
            high_cost = "Seq Scan" in plan and "rows=" in plan
            warning = "Sequential scan detected — query may be slow on large tables." if high_cost else None
            return CostEstimate(
                estimated_rows=HIGH_COST_THRESHOLD if high_cost else 1000,
                plan_summary=plan,
                high_cost=high_cost,
                warning=warning,
            )
        finally:
            conn.close()
    except Exception as exc:
        return CostEstimate(estimated_rows=0, plan_summary=str(exc), high_cost=False)
