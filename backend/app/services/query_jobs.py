"""Async query job status stored in Redis for cross-worker polling."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.redis_client import get_redis

JOB_TTL_SEC = 86400


def _job_key(job_id: str) -> str:
    return f"atlasiq:job:{job_id}"


def create_job(company_id: str, user_id: str, question: str, database_id: str) -> str:
    job_id = str(uuid.uuid4())
    payload = {
        "id": job_id,
        "status": "pending",
        "company_id": company_id,
        "user_id": user_id,
        "database_id": database_id,
        "question": question,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "result": None,
        "error": None,
    }
    r = get_redis()
    if r:
        r.setex(_job_key(job_id), JOB_TTL_SEC, json.dumps(payload, default=str))
    else:
        _memory_jobs[job_id] = payload
    return job_id


def update_job(job_id: str, **fields: Any) -> None:
    job = get_job(job_id)
    if not job:
        return
    job.update(fields)
    r = get_redis()
    if r:
        r.setex(_job_key(job_id), JOB_TTL_SEC, json.dumps(job, default=str))
    else:
        _memory_jobs[job_id] = job


def get_job(job_id: str) -> dict[str, Any] | None:
    r = get_redis()
    if r:
        raw = r.get(_job_key(job_id))
        return json.loads(raw) if raw else None
    return _memory_jobs.get(job_id)


def complete_job(job_id: str, result: dict[str, Any]) -> None:
    update_job(job_id, status="completed", result=result)


def fail_job(job_id: str, error: str) -> None:
    update_job(job_id, status="failed", error=error)


_memory_jobs: dict[str, dict[str, Any]] = {}
