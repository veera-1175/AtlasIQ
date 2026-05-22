"""Execute scheduled / on-demand report queries."""
import uuid
from typing import Any

from app.core.database import get_database, get_report, get_user_by_id, update_report_run
from app.core.permissions import get_allowed_tables
from app.models.schemas import QueryRequest
from app.services.query_pipeline import run_query


def execute_report(report_id: str) -> None:
    report = get_report(report_id)
    if not report:
        return
    record = get_database(report["database_id"])
    if not record:
        update_report_run(report_id, "failed", "Database not found")
        return
    report_user = get_user_by_id(report["user_id"]) if report.get("user_id") else None
    allowed = get_allowed_tables(report_user) if report_user else None
    try:
        body = QueryRequest(database_id=uuid.UUID(report["database_id"]), question=report["question"])
        result = run_query(body, record, lambda *a, **k: str(uuid.uuid4()), allowed_tables=allowed)
        status = "success" if result.success else "failed"
        summary = result.explanation or result.error or "No summary"
        update_report_run(report_id, status, summary)
    except Exception as exc:
        update_report_run(report_id, "failed", str(exc))


def assert_report_access(report: dict[str, Any], user: dict[str, Any]) -> None:
    if report.get("company_id") != user.get("company_id"):
        raise ValueError("Report not found")
    if user.get("platform_role") == "employee" and report.get("user_id") != user.get("id"):
        raise ValueError("Not your report")
