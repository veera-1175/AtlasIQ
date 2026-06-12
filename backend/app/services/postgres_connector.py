"""PostgreSQL / warehouse schema extraction and pooled query execution."""

from typing import Any

from app.core.config import get_settings
from app.models.schemas import ColumnInfo, DatabaseSchema, RelationshipInfo, TableInfo
from app.services.connection_pool import execute_pooled_query, normalize_warehouse_url


def extract_postgres_schema(connection_url: str, sample_limit: int = 3) -> DatabaseSchema:
    import psycopg2
    import psycopg2.extras

    _, dialect = normalize_warehouse_url(connection_url)
    conn = psycopg2.connect(connection_url)
    conn.set_session(readonly=True, autocommit=True)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            table_names = [row["table_name"] for row in cur.fetchall()]

            tables: list[TableInfo] = []
            relationships: list[RelationshipInfo] = []

            for table in table_names:
                cur.execute(
                    """
                    SELECT column_name, data_type, is_nullable,
                           EXISTS (
                               SELECT 1 FROM information_schema.table_constraints tc
                               JOIN information_schema.key_column_usage kcu
                                 ON tc.constraint_name = kcu.constraint_name
                               WHERE tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY'
                                 AND kcu.column_name = c.column_name
                           ) AS is_pk
                    FROM information_schema.columns c
                    WHERE table_schema = 'public' AND table_name = %s
                    ORDER BY ordinal_position
                    """,
                    (table, table),
                )
                columns = [
                    ColumnInfo(
                        name=row["column_name"],
                        type=row["data_type"].upper(),
                        nullable=row["is_nullable"] == "YES",
                        is_primary_key=row["is_pk"],
                    )
                    for row in cur.fetchall()
                ]

                cur.execute(f'SELECT * FROM "{table}" LIMIT %s', (sample_limit,))
                sample_rows = [dict(row) for row in cur.fetchall()]

                tables.append(TableInfo(name=table, columns=columns, sample_rows=sample_rows))

                cur.execute(
                    """
                    SELECT kcu.table_name AS from_table, kcu.column_name AS from_column,
                           ccu.table_name AS to_table, ccu.column_name AS to_column
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.table_name = %s
                    """,
                    (table,),
                )
                for row in cur.fetchall():
                    relationships.append(
                        RelationshipInfo(
                            from_table=row["from_table"],
                            from_column=row["from_column"],
                            to_table=row["to_table"],
                            to_column=row["to_column"],
                        )
                    )

        return DatabaseSchema(tables=tables, relationships=relationships, dialect=dialect)
    finally:
        conn.close()


def execute_postgres_query(
    connection_url: str,
    sql: str,
    max_rows: int,
    read_replica_url: str | None = None,
) -> tuple[list[str], list[dict[str, Any]], int]:
    settings = get_settings()
    return execute_pooled_query(
        connection_url,
        sql,
        max_rows,
        read_replica_url=read_replica_url,
        timeout_sec=settings.query_timeout_sec,
    )
