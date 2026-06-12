from datetime import datetime, timedelta, timezone

from app.services.report_schedule import is_report_due


def test_daily_not_due_within_24h():
    now = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    last = (now - timedelta(hours=12)).isoformat()
    assert is_report_due("daily", last, now=now) is False


def test_daily_due_after_24h():
    now = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    last = (now - timedelta(hours=25)).isoformat()
    assert is_report_due("daily", last, now=now) is True


def test_weekly_due_after_7_days():
    now = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    last = (now - timedelta(days=8)).isoformat()
    assert is_report_due("weekly", last, now=now) is True


def test_never_run_not_due_on_scheduler():
    assert is_report_due("daily", None) is False
