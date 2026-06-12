import re

import sqlglot
from sqlglot import exp

BLOCKED_STATEMENTS = {
    exp.Delete,
    exp.Drop,
    exp.Update,
    exp.Insert,
    exp.Alter,
    exp.TruncateTable,
    exp.Create,
    exp.Grant,
    exp.Command,
}

BLOCKED_KEYWORDS = re.compile(
    r"\b(DELETE|DROP|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|EXEC|EXECUTE|ATTACH|DETACH)\b",
    re.IGNORECASE,
)

SYSTEM_TABLES = {
    "sqlite_master",
    "sqlite_sequence",
    "sqlite_temp_master",
    "information_schema",
    "pg_catalog",
}


class SQLValidationError(Exception):
    pass


def _collect_tables(expression: exp.Expression) -> set[str]:
    tables: set[str] = set()
    for table in expression.find_all(exp.Table):
        name = table.name
        if name:
            tables.add(name.lower())
    return tables


def validate_sql(sql: str, dialect: str = "sqlite") -> str:
    cleaned = sql.strip().rstrip(";")
    if not cleaned:
        raise SQLValidationError("Empty SQL query")

    if ";" in cleaned:
        raise SQLValidationError("Multiple statements are not allowed")

    if BLOCKED_KEYWORDS.search(cleaned):
        raise SQLValidationError("Query contains blocked SQL keywords")

    try:
        parsed = sqlglot.parse_one(cleaned, read=dialect)
    except Exception as exc:
        raise SQLValidationError(f"Invalid SQL syntax: {exc}") from exc

    if parsed is None:
        raise SQLValidationError("Could not parse SQL")

    root = parsed
    if isinstance(root, exp.With):
        root = root.this

    allowed_roots = (exp.Select, exp.Union, exp.Intersect, exp.Except)
    if not isinstance(root, allowed_roots):
        raise SQLValidationError("Only SELECT queries (with optional WITH/CTE) are allowed")

    for node in parsed.walk():
        if type(node) in BLOCKED_STATEMENTS:
            raise SQLValidationError(f"Blocked statement type: {type(node).__name__}")

    for table_name in _collect_tables(parsed):
        if table_name in SYSTEM_TABLES or table_name.startswith("sqlite_"):
            raise SQLValidationError(f"Access to system table '{table_name}' is blocked")

    return cleaned
