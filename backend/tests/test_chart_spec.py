from app.services.chart_spec import build_chart_spec


def test_bar_chart_for_category_and_numeric():
    columns = ["region", "total_revenue"]
    rows = [
        {"region": "North America", "total_revenue": 1200000},
        {"region": "Europe", "total_revenue": 980000},
    ]
    spec = build_chart_spec(columns, rows)
    assert spec is not None
    assert spec.type == "bar"
    assert spec.x_column == "region"
    assert spec.y_column == "total_revenue"


def test_line_chart_for_date_and_numeric():
    columns = ["sale_date", "revenue"]
    rows = [
        {"sale_date": "2024-01-15", "revenue": 100},
        {"sale_date": "2024-02-10", "revenue": 200},
    ]
    spec = build_chart_spec(columns, rows)
    assert spec is not None
    assert spec.type == "line"
