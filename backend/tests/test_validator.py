import pytest

from app.services.sql_validator import SQLValidationError, validate_sql


def test_allows_simple_select():
    sql = validate_sql("SELECT region, SUM(revenue) FROM sales GROUP BY region")
    assert sql.startswith("SELECT")


def test_allows_cte():
    sql = validate_sql(
        "WITH top_regions AS (SELECT region FROM sales) SELECT * FROM top_regions"
    )
    assert "WITH" in sql


def test_allows_union_select():
    sql = validate_sql(
        "SELECT 'accounts' AS table_name, COUNT(*) AS row_count FROM accounts "
        "UNION ALL SELECT 'accounts_02', COUNT(*) FROM accounts_02"
    )
    assert "UNION ALL" in sql


def test_blocks_delete():
    with pytest.raises(SQLValidationError, match="blocked"):
        validate_sql("DELETE FROM sales")


def test_blocks_drop():
    with pytest.raises(SQLValidationError, match="blocked"):
        validate_sql("DROP TABLE sales")


def test_blocks_insert():
    with pytest.raises(SQLValidationError, match="blocked"):
        validate_sql("INSERT INTO sales VALUES (1, 'x', 100, 'Q1', '2024-01-01')")


def test_blocks_semicolon_chaining():
    with pytest.raises(SQLValidationError, match="Multiple statements"):
        validate_sql("SELECT 1; DROP TABLE sales")


def test_blocks_system_tables():
    with pytest.raises(SQLValidationError, match="system table"):
        validate_sql("SELECT * FROM sqlite_master")
