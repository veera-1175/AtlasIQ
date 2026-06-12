"""Tests for schema sampling on large warehouses."""

from app.models.schemas import ColumnInfo, DatabaseSchema, TableInfo
from app.services.schema_sampler import sample_schema_for_question


def _table(name: str, cols: list[str]) -> TableInfo:
    return TableInfo(
        name=name,
        columns=[ColumnInfo(name=c, type="TEXT") for c in cols],
        sample_rows=[{cols[0]: "x"}] if cols else [],
    )


def test_sample_schema_picks_relevant_tables():
    schema = DatabaseSchema(
        tables=[
            _table("employees", ["employee_id", "department", "salary"]),
            _table("orders", ["order_id", "revenue", "region"]),
            _table("logs", ["message", "level"]),
            _table("misc_a", ["a"]),
            _table("misc_b", ["b"]),
            _table("misc_c", ["c"]),
            _table("misc_d", ["d"]),
            _table("misc_e", ["e"]),
            _table("misc_f", ["f"]),
            _table("misc_g", ["g"]),
            _table("misc_h", ["h"]),
            _table("misc_i", ["i"]),
            _table("misc_j", ["j"]),
        ],
        dialect="postgres",
    )
    sampled = sample_schema_for_question(schema, "What is total revenue by region?", max_tables=4)
    names = {t.name for t in sampled.tables}
    assert "orders" in names
    assert len(sampled.tables) <= 8


def test_sample_schema_honors_focus_tables():
    schema = DatabaseSchema(
        tables=[
            _table("sales", ["region", "revenue"]),
            _table("employees", ["department", "salary"]),
            _table("inventory", ["sku", "quantity"]),
        ],
        dialect="sqlite",
    )
    sampled = sample_schema_for_question(schema, "total revenue", focus_tables=["sales"])
    assert [t.name for t in sampled.tables] == ["sales"]
