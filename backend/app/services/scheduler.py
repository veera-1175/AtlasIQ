"""Background scheduler for weekly/daily reports."""
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import list_all_reports
from app.services.report_runner import execute_report
from app.services.report_schedule import is_report_due

_scheduler: BackgroundScheduler | None = None


def _run_due_reports() -> None:
    for report in list_all_reports():
        if not is_report_due(report.get("schedule", "weekly"), report.get("last_run_at")):
            continue
        execute_report(report["id"])


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_run_due_reports, "cron", hour=8, minute=0)
    _scheduler.start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
