"""Select only schema tables relevant to the user's question for LLM context."""

import re
from typing import Iterable

from app.core.config import get_settings
from app.models.schemas import DatabaseSchema, TableInfo


_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "what", "how", "many", "much",
    "show", "me", "all", "of", "in", "by", "for", "and", "or", "to", "from", "with",
    "last", "this", "that", "each", "per", "total", "count", "list", "get", "find",
}


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 1}


def _table_score(table: TableInfo, question_tokens: set[str], allowed: set[str] | None) -> float:
    if allowed is not None and table.name not in allowed:
        return -1.0
    score = 0.0
    name_parts = set(table.name.lower().replace("_", " ").split())
    col_names = {c.name.lower() for c in table.columns}
    col_parts: set[str] = set()
    for c in table.columns:
        col_parts.update(c.name.lower().replace("_", " ").split())

    for tok in question_tokens:
        if tok in name_parts or tok in table.name.lower():
            score += 5.0
        if tok in col_names:
            score += 3.0
        if tok in col_parts:
            score += 1.5
        for part in name_parts | col_names:
            if tok in part or part in tok:
                score += 0.5

    # Prefer tables with sample data (likely core business tables)
    if table.sample_rows:
        score += 0.5
    return score


def _resolve_focus_tables(schema: DatabaseSchema, focus_tables: list[str]) -> set[str]:
    by_lower = {t.name.lower(): t.name for t in schema.tables}
    selected: set[str] = set()
    for name in focus_tables:
        key = name.strip().lower()
        if not key:
            continue
        if key in by_lower:
            selected.add(by_lower[key])
    return selected


def sample_schema_for_question(
    schema: DatabaseSchema,
    question: str,
    allowed_tables: list[str] | None = None,
    focus_tables: list[str] | None = None,
    max_tables: int | None = None,
    max_columns: int | None = None,
) -> DatabaseSchema:
    settings = get_settings()
    max_tables = max_tables or settings.schema_max_tables_for_llm
    max_columns = max_columns or settings.schema_max_columns_per_table

    if focus_tables:
        selected_names = _resolve_focus_tables(schema, focus_tables)
        if selected_names:
            tables = [t for t in schema.tables if t.name in selected_names]
            relationships = [
                r for r in schema.relationships
                if r.from_table in selected_names and r.to_table in selected_names
            ]
            trimmed = DatabaseSchema(tables=tables, relationships=relationships, dialect=schema.dialect)
            return _trim_columns(trimmed, max_columns)

    if len(schema.tables) <= max_tables:
        return _trim_columns(schema, max_columns)

    allowed_set = set(allowed_tables) if allowed_tables else None
    tokens = _tokens(question)

    scored: list[tuple[float, TableInfo]] = []
    for table in schema.tables:
        s = _table_score(table, tokens, allowed_set)
        if s >= 0:
            scored.append((s, table))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected_names = {t.name for _, t in scored[:max_tables]}

    # Include FK-related tables so joins remain possible
    for rel in schema.relationships:
        if rel.from_table in selected_names:
            selected_names.add(rel.to_table)
        if rel.to_table in selected_names:
            selected_names.add(rel.from_table)

    # Cap again after FK expansion
    if len(selected_names) > max_tables + 4:
        top = {t.name for _, t in scored[:max_tables]}
        selected_names = top

    tables = [t for t in schema.tables if t.name in selected_names]
    if not tables and schema.tables:
        tables = schema.tables[:max_tables]

    relationships = [
        r for r in schema.relationships
        if r.from_table in selected_names and r.to_table in selected_names
    ]
    trimmed = DatabaseSchema(tables=tables, relationships=relationships, dialect=schema.dialect)
    return _trim_columns(trimmed, max_columns)


def _trim_columns(schema: DatabaseSchema, max_columns: int) -> DatabaseSchema:
    tables: list[TableInfo] = []
    for table in schema.tables:
        cols = table.columns[:max_columns]
        tables.append(TableInfo(name=table.name, columns=cols, sample_rows=table.sample_rows[:1]))
    return DatabaseSchema(tables=tables, relationships=schema.relationships, dialect=schema.dialect)
