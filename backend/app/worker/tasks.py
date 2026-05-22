"""Background tasks for enterprise-scale query execution."""

import json
from typing import Any

from app.core.database import get_database
from app.core.quotas import decrement_active_jobs, get_company_quotas, record_query_usage
from app.models.schemas import QueryRequest
from app.services.query_jobs import complete_job, fail_job, update_job
from app.services.query_pipeline import run_query
from app.worker.celery_app import celery_app


def _save_history_factory(user_id: str, company_id: str):
    from app.core.database import save_query_history

    def save(
        database_id: str,
        question: str,
        generated_sql: str | None,
        success: bool,
        execution_ms: int | None = None,
        row_count: int | None = None,
        error: str | None = None,
        result_json: str | None = None,
        explanation: str | None = None,
    ) -> str:
        return save_query_history(
            database_id,
            company_id,
            user_id,
            question,
            generated_sql,
            success,
            execution_ms=execution_ms,
            row_count=row_count,
            error=error,
            result_json=result_json,
            explanation=explanation,
        )

    return save


@celery_app.task(name="app.worker.tasks.run_query_async", bind=True, max_retries=1)
def run_query_async(
    self,
    job_id: str,
    body_dict: dict[str, Any],
    database_id: str,
    user_id: str,
    company_id: str,
    allowed_tables: list[str] | None,
) -> dict[str, Any]:
    update_job(job_id, status="running")
    try:
        record = get_database(database_id)
        if not record:
            fail_job(job_id, "Database not found")
            return {"status": "failed"}

        body = QueryRequest(**body_dict)
        from app.core.database import get_company
        from app.core.quotas import get_company_quotas

        company = get_company(company_id)
        max_rows = get_company_quotas(company)["max_rows_per_query"]
        result = run_query(body, record, _save_history_factory(user_id, company_id), allowed_tables=allowed_tables, company_max_rows=max_rows)
        record_query_usage(company_id)
        payload = result.model_dump(mode="json")
        complete_job(job_id, payload)
        return {"status": "completed", "job_id": job_id}
    except Exception as exc:
        fail_job(job_id, str(exc))
        raise
    finally:
        decrement_active_jobs(company_id)
