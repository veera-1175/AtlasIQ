import json

import uuid

from datetime import datetime


from fastapi import APIRouter, Depends, HTTPException, Request


from app.core.config import get_settings

from app.core.database import (
    get_company,
    get_database,
    get_query_by_id,
    get_query_history,
    save_query_history,
    set_query_feedback,
)

from app.core.permissions import (
    assert_database_access,
    get_allowed_tables,
    require_company_data_user,
)

from app.core.quotas import (
    check_concurrent_jobs,
    check_query_quota,
    get_company_quotas,
    get_quota_usage,
    increment_active_jobs,
    record_query_usage,
)

from app.core.rate_limit import check_rate_limit

from app.core.redis_client import redis_available

from app.models.schemas import (
    FeedbackRequest,
    QueryHistoryItem,
    QueryJobResponse,
    QueryRequest,
    QueryResponse,
)

from app.services.query_jobs import create_job, get_job

from app.services.query_pipeline import run_query

router = APIRouter(prefix="/api/v1/query", tags=["query"])


def _save_history(user: dict):

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
            user["company_id"],
            user["id"],
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


def _celery_available() -> bool:

    settings = get_settings()

    return bool(settings.celery_broker_url and redis_available())


def _should_run_async(body: QueryRequest, record: dict) -> bool:
    if body.async_mode:
        return True
    settings = get_settings()
    if _celery_available() and record.get("source_type") in ("postgres", "redshift"):
        schema = record.get("schema")
        table_count = len(schema.tables) if schema else 0
        if table_count > settings.schema_max_tables_for_llm:
            return True
    return False


@router.post("", response_model=QueryResponse | QueryJobResponse)
def ask_question(
    body: QueryRequest,
    request: Request,
    user: dict = Depends(require_company_data_user),
):

    check_rate_limit(request, user_id=user["id"])

    company = get_company(user["company_id"])

    check_query_quota(user["company_id"], company)

    record = get_database(str(body.database_id))

    if not record:

        raise HTTPException(status_code=404, detail="Database not found")

    assert_database_access(user, record)

    allowed = get_allowed_tables(user)

    quotas = get_company_quotas(company)

    max_rows = quotas["max_rows_per_query"]

    if _should_run_async(body, record) and _celery_available():

        check_concurrent_jobs(user["company_id"], company)

        job_id = create_job(
            user["company_id"], user["id"], body.question, str(body.database_id)
        )

        increment_active_jobs(user["company_id"])

        from app.worker.tasks import run_query_async

        run_query_async.delay(
            job_id,
            body.model_dump(mode="json"),
            str(body.database_id),
            user["id"],
            user["company_id"],
            allowed,
        )

        return QueryJobResponse(
            job_id=uuid.UUID(job_id),
            status="pending",
            question=body.question,
            message="Query queued for async execution. Poll GET /api/v1/query/jobs/{job_id} for results.",
        )

    result = run_query(
        body,
        record,
        _save_history(user),
        allowed_tables=allowed,
        company_max_rows=max_rows,
    )

    record_query_usage(user["company_id"])

    return result


@router.get("/jobs/{job_id}", response_model=QueryJobResponse)
def get_query_job(
    job_id: str, user: dict = Depends(require_company_data_user)
) -> QueryJobResponse:

    job = get_job(job_id)

    if not job or job.get("company_id") != user["company_id"]:

        raise HTTPException(status_code=404, detail="Job not found")

    if user["platform_role"] == "employee" and job.get("user_id") != user["id"]:

        raise HTTPException(status_code=404, detail="Job not found")

    response = QueryJobResponse(
        job_id=uuid.UUID(job_id),
        status=job["status"],
        question=job["question"],
    )

    if job["status"] == "completed" and job.get("result"):

        response.result = QueryResponse(**job["result"])

    elif job["status"] == "failed":

        response.error = job.get("error")

    return response


@router.get("/quota")
def query_quota(user: dict = Depends(require_company_data_user)) -> dict:

    company = get_company(user["company_id"])

    return get_quota_usage(user["company_id"], company)


@router.get("/history", response_model=list[QueryHistoryItem])
def query_history(
    limit: int = 50, user: dict = Depends(require_company_data_user)
) -> list[QueryHistoryItem]:

    user_id = None if user["platform_role"] == "company_admin" else user["id"]

    items = get_query_history(user["company_id"], user_id=user_id, limit=limit)

    return [
        QueryHistoryItem(
            id=uuid.UUID(item["id"]),
            database_id=uuid.UUID(item["database_id"]),
            question=item["question"],
            generated_sql=item["generated_sql"],
            success=bool(item["success"]),
            row_count=item["row_count"],
            execution_ms=item["execution_ms"],
            explanation=item.get("explanation"),
            user_email=item.get("user_email"),
            user_name=item.get("user_name"),
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in items
    ]


@router.get("/{query_id}/result", response_model=QueryResponse)
def get_query_result(
    query_id: str, user: dict = Depends(require_company_data_user)
) -> QueryResponse:

    item = get_query_by_id(query_id)

    if not item or item.get("company_id") != user.get("company_id"):

        raise HTTPException(status_code=404, detail="Query not found")

    if user["platform_role"] == "employee" and item.get("user_id") != user["id"]:

        raise HTTPException(status_code=404, detail="Query not found")

    if item.get("result_json"):

        data = json.loads(item["result_json"])

        data["id"] = query_id

        return QueryResponse(**data)

    return QueryResponse(
        id=uuid.UUID(query_id),
        question=item["question"],
        generated_sql=item.get("generated_sql"),
        success=bool(item["success"]),
        error=item.get("error"),
        execution_ms=item.get("execution_ms"),
        row_count=item.get("row_count"),
        explanation=item.get("explanation"),
    )


@router.post("/{query_id}/feedback")
def submit_feedback(
    query_id: str,
    body: FeedbackRequest,
    user: dict = Depends(require_company_data_user),
) -> dict:

    item = get_query_by_id(query_id)

    if not item or item.get("company_id") != user.get("company_id"):

        raise HTTPException(status_code=404, detail="Query not found")

    if user["platform_role"] == "employee" and item.get("user_id") != user["id"]:

        raise HTTPException(status_code=404, detail="Query not found")

    if not set_query_feedback(query_id, body.feedback):

        raise HTTPException(status_code=404, detail="Query not found")

    return {"status": "ok"}
