import sqlite3
from pathlib import Path
from typing import Any

from app.models.schemas import ColumnInfo, DatabaseSchema, RelationshipInfo, TableInfo

SQLITE_TYPE_MAP = {
    "INT": "INTEGER",
    "INTEGER": "INTEGER",
    "REAL": "REAL",
    "FLOAT": "REAL",
    "DOUBLE": "REAL",
    "NUMERIC": "NUMERIC",
    "DECIMAL": "NUMERIC",
    "TEXT": "TEXT",
    "VARCHAR": "TEXT",
    "CHAR": "TEXT",
    "BLOB": "BLOB",
    "DATE": "DATE",
    "DATETIME": "DATETIME",
    "TIMESTAMP": "TIMESTAMP",
}


def _normalize_type(raw: str | None) -> str:
    if not raw:
        return "TEXT"
    upper = raw.upper().split("(")[0].strip()
    return SQLITE_TYPE_MAP.get(upper, upper)


def _fetch_sample_rows(conn: sqlite3.Connection, table: str, limit: int = 3) -> list[dict[str, Any]]:
    cursor = conn.execute(f'SELECT * FROM "{table}" LIMIT ?', (limit,))
    columns = [desc[0] for desc in cursor.description or []]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _extract_foreign_keys(conn: sqlite3.Connection, table: str) -> list[RelationshipInfo]:
    relationships: list[RelationshipInfo] = []
    cursor = conn.execute(f'PRAGMA foreign_key_list("{table}")')
    for row in cursor.fetchall():
        # id, seq, table, from, to, on_update, on_delete, match
        relationships.append(
            RelationshipInfo(
                from_table=table,
                from_column=row[3],
                to_table=row[2],
                to_column=row[4],
            )
        )
    return relationships


def extract_sqlite_schema(db_path: Path, sample_limit: int = 3) -> DatabaseSchema:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        tables: list[TableInfo] = []
        all_relationships: list[RelationshipInfo] = []

        table_names = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
        ]

        for table in table_names:
            columns: list[ColumnInfo] = []
            pk_cols = {
                row[1]
                for row in conn.execute(f'PRAGMA table_info("{table}")').fetchall()
                if row[5]
            }
            for row in conn.execute(f'PRAGMA table_info("{table}")').fetchall():
                # cid, name, type, notnull, dflt_value, pk
                columns.append(
                    ColumnInfo(
                        name=row[1],
                        type=_normalize_type(row[2]),
                        nullable=not bool(row[3]),
                        is_primary_key=row[1] in pk_cols,
                    )
                )

            sample_rows = _fetch_sample_rows(conn, table, sample_limit)
            tables.append(TableInfo(name=table, columns=columns, sample_rows=sample_rows))
            all_relationships.extend(_extract_foreign_keys(conn, table))

        return DatabaseSchema(tables=tables, relationships=all_relationships, dialect="sqlite")
    finally:
        conn.close()


def schema_to_prompt(schema: DatabaseSchema) -> str:
    lines: list[str] = []
    for table in schema.tables:
        col_defs = ", ".join(
            f"{c.name} {c.type}" + (" PK" if c.is_primary_key else "") for c in table.columns
        )
        lines.append(f"Table: {table.name} ({col_defs})")
        if table.sample_rows:
            lines.append(f"  Sample: {table.sample_rows[0]}")

    for rel in schema.relationships:
        lines.append(
            f"Relationship: {rel.from_table}.{rel.from_column} -> "
            f"{rel.to_table}.{rel.to_column}"
        )

    return "\n".join(lines)
