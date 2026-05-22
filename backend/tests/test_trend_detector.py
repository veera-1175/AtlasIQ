from app.services.trend_detector import detect_trends


def test_detects_growth():
    columns = ["quarter", "total"]
    rows = [
        {"quarter": "Q1", "total": 100},
        {"quarter": "Q2", "total": 150},
        {"quarter": "Q3", "total": 200},
    ]
    trends = detect_trends(columns, rows)
    assert len(trends) >= 1
    assert "grew" in trends[0]
