"""Determine when scheduled reports are due to run."""
from datetime import datetime, timedelta, timezone


def _parse_ts(value: str) -> datetime:
    ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def is_report_due(schedule: str, last_run_at: str | None, *, now: datetime | None = None) -> bool:
    """Return True if a report should run on this scheduler tick."""
    if not last_run_at:
        return False
    current = now or datetime.now(timezone.utc)
    last = _parse_ts(last_run_at)
    age = current - last
    if schedule == "weekly":
        return age >= timedelta(days=7)
    return age >= timedelta(hours=24)
