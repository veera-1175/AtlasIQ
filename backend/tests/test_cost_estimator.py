from pathlib import Path

from app.services.cost_estimator import estimate_sqlite_cost

SAMPLE_DB = Path(__file__).resolve().parents[2] / "sample_data" / "enterprise_sample.db"


def test_union_on_small_focus_tables_not_high_cost():
    sql = (
        "SELECT 'accounts' AS table_name, COUNT(*) AS row_count FROM accounts "
        "UNION ALL SELECT 'accounts_02', COUNT(*) FROM accounts_02"
    )
    cost = estimate_sqlite_cost(SAMPLE_DB, sql)
    assert cost.high_cost is False
    assert cost.estimated_rows < 1000
    assert cost.warning is None


def test_simple_count_not_high_cost():
    sql = "SELECT COUNT(*) FROM sales WHERE status = 'completed'"
    cost = estimate_sqlite_cost(SAMPLE_DB, sql)
    assert cost.high_cost is False
