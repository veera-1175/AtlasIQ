from pathlib import Path

from app.services.schema_extractor import extract_sqlite_schema, schema_to_prompt

SAMPLE_DB = Path(__file__).resolve().parents[2] / "sample_data" / "sales.db"


def test_extract_sales_schema():
    if not SAMPLE_DB.exists():
        return
    schema = extract_sqlite_schema(SAMPLE_DB)
    table_names = {t.name for t in schema.tables}
    assert "sales" in table_names
    assert "customers" in table_names

    sales = next(t for t in schema.tables if t.name == "sales")
    col_names = {c.name for c in sales.columns}
    assert {"region", "revenue", "quarter"}.issubset(col_names)


def test_schema_to_prompt_includes_tables():
    if not SAMPLE_DB.exists():
        return
    schema = extract_sqlite_schema(SAMPLE_DB)
    prompt = schema_to_prompt(schema)
    assert "Table: sales" in prompt
    assert "Table: customers" in prompt
