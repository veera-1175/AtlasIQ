"""Pre-built aggregate / materialized view definitions for common analytics questions."""

import json
import re
from typing import Any

from app.core.config import get_settings
from app.core.database import get_db, _utcnow
from app.models.schemas import DatabaseSchema

# Standard aggregates created for every connected warehouse database
DEFAULT_AGGREGATES: list[dict[str, str]] = [
    {
        "name": "row_counts_by_table",
        "question_pattern": r"(row|record|count).*(table|each)",
        "view_sql": None,
        "query_sql": """
            SELECT schemaname, relname AS table_name, n_live_tup AS estimated_rows
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 50
        """,
        "description": "Estimated row counts per table",
    },
    {
        "name": "table_sizes",
        "question_pattern": r"(size|storage|disk|space).*(table|database)",
        "view_sql": None,
        "query_sql": """
            SELECT relname AS table_name,
                   pg_size_pretty(pg_total_relation_size(relid)) AS total_size
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 30
        """,
        "description": "Table storage sizes",
    },
]


def _ensure_aggregates_table() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS database_aggregates (
                id TEXT PRIMARY KEY,
                database_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                question_pattern TEXT NOT NULL,
                query_sql TEXT NOT NULL,
                view_sql TEXT,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                last_refreshed_at TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def seed_aggregates_for_database(database_id: str, company_id: str, schema: DatabaseSchema) -> None:
    import uuid

    _ensure_aggregates_table()
    table_names = {t.name.lower() for t in schema.tables}

    with get_db() as conn:
        for agg in DEFAULT_AGGREGATES:
            existing = conn.execute(
                "SELECT id FROM database_aggregates WHERE database_id = ? AND name = ?",
                (database_id, agg["name"]),
            ).fetchone()
            if existing:
                continue
            # Skip pg_stat aggregates if not postgres-like
            if "pg_stat" in agg.get("query_sql", "") and schema.dialect != "postgres":
                continue
            conn.execute(
                "INSERT INTO database_aggregates "
                "(id, database_id, company_id, name, question_pattern, query_sql, view_sql, description, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    database_id,
                    company_id,
                    agg["name"],
                    agg["question_pattern"],
                    agg["query_sql"].strip(),
                    agg.get("view_sql"),
                    agg["description"],
                    _utcnow(),
                ),
            )

        # Schema-aware aggregates for numeric columns
        for table in schema.tables[:8]:
            numeric_cols = [c.name for c in table.columns if any(x in c.type.upper() for x in ("INT", "NUM", "DEC", "FLOAT", "DOUBLE", "REAL"))]
            if not numeric_cols:
                continue
            col = numeric_cols[0]
            name = f"sum_{table.name}_{col}".lower()[:60]
            pattern = rf"({table.name}|{col.replace('_', ' ')}).*(total|sum|aggregate)"
            query_sql = f'SELECT SUM("{col}") AS total_{col} FROM "{table.name}"'
            existing = conn.execute(
                "SELECT id FROM database_aggregates WHERE database_id = ? AND name = ?",
                (database_id, name),
            ).fetchone()
            if not existing and table.name.lower() in table_names:
                conn.execute(
                    "INSERT INTO database_aggregates "
                    "(id, database_id, company_id, name, question_pattern, query_sql, description, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        database_id,
                        company_id,
                        name,
                        pattern,
                        query_sql,
                        f"Pre-computed SUM({col}) on {table.name}",
                        _utcnow(),
                    ),
                )


def find_matching_aggregate(database_id: str, question: str) -> dict[str, Any] | None:
    _ensure_aggregates_table()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM database_aggregates WHERE database_id = ? AND is_active = 1",
            (database_id,),
        ).fetchall()
    q_lower = question.lower()
    for row in rows:
        agg = dict(row)
        try:
            if re.search(agg["question_pattern"], q_lower, re.IGNORECASE):
                return agg
        except re.error:
            continue
    return None


def list_aggregates(database_id: str) -> list[dict[str, Any]]:
    _ensure_aggregates_table()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, description, question_pattern, last_refreshed_at, created_at "
            "FROM database_aggregates WHERE database_id = ? AND is_active = 1 ORDER BY name",
            (database_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def refresh_materialized_views(database_id: str, connection_url: str) -> int:
    _ensure_aggregates_table()
    refreshed = 0
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, view_sql FROM database_aggregates WHERE database_id = ? AND view_sql IS NOT NULL AND is_active = 1",
            (database_id,),
        ).fetchall()
    if not rows:
        return 0

    import psycopg2

    pg_conn = psycopg2.connect(connection_url)
    pg_conn.autocommit = True
    try:
        with pg_conn.cursor() as cur:
            for row in rows:
                try:
                    cur.execute(row["view_sql"])
                    with get_db() as conn:
                        conn.execute(
                            "UPDATE database_aggregates SET last_refreshed_at = ? WHERE id = ?",
                            (_utcnow(), row["id"]),
                        )
                    refreshed += 1
                except Exception:
                    continue
    finally:
        pg_conn.close()
    return refreshed
