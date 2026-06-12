"""Per-company quota enforcement backed by Redis (shared across API workers)."""

import json
import time
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings
from app.core.redis_client import get_redis


def _day_key(company_id: str, metric: str) -> str:
    day = time.strftime("%Y-%m-%d")
    return f"atlasiq:quota:{company_id}:{metric}:{day}"


def get_company_quotas(company: dict[str, Any]) -> dict[str, int]:
    settings = get_settings()
    return {
        "queries_per_day": company.get("quota_queries_per_day") or settings.default_quota_queries_per_day,
        "max_rows_per_query": company.get("quota_max_rows") or settings.default_quota_max_rows,
        "max_databases": company.get("quota_max_databases") or settings.default_quota_max_databases,
        "concurrent_jobs": company.get("quota_concurrent_jobs") or settings.default_quota_concurrent_jobs,
    }


def check_query_quota(company_id: str, company: dict[str, Any]) -> None:
    quotas = get_company_quotas(company)
    r = get_redis()
    if not r:
        return
    key = _day_key(company_id, "queries")
    count = int(r.get(key) or 0)
    if count >= quotas["queries_per_day"]:
        raise HTTPException(
            status_code=429,
            detail=f"Daily query quota exceeded ({quotas['queries_per_day']} queries/day). Contact your administrator.",
        )


def record_query_usage(company_id: str) -> None:
    r = get_redis()
    if not r:
        return
    key = _day_key(company_id, "queries")
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, 86400 * 2)
    pipe.execute()


def check_database_quota(company_id: str, company: dict[str, Any], current_count: int) -> None:
    quotas = get_company_quotas(company)
    if current_count >= quotas["max_databases"]:
        raise HTTPException(
            status_code=403,
            detail=f"Database connection limit reached ({quotas['max_databases']} max). Upgrade plan or remove unused sources.",
        )


def check_concurrent_jobs(company_id: str, company: dict[str, Any]) -> None:
    quotas = get_company_quotas(company)
    r = get_redis()
    if not r:
        return
    key = f"atlasiq:jobs:active:{company_id}"
    count = int(r.get(key) or 0)
    if count >= quotas["concurrent_jobs"]:
        raise HTTPException(
            status_code=429,
            detail=f"Too many concurrent queries ({quotas['concurrent_jobs']} max). Wait for running jobs to finish.",
        )


def increment_active_jobs(company_id: str) -> None:
    r = get_redis()
    if not r:
        return
    key = f"atlasiq:jobs:active:{company_id}"
    r.incr(key)
    r.expire(key, 3600)


def decrement_active_jobs(company_id: str) -> None:
    r = get_redis()
    if not r:
        return
    key = f"atlasiq:jobs:active:{company_id}"
    val = r.decr(key)
    if val is not None and int(val) < 0:
        r.set(key, 0)


def get_quota_usage(company_id: str, company: dict[str, Any]) -> dict[str, Any]:
    quotas = get_company_quotas(company)
    r = get_redis()
    queries_today = int(r.get(_day_key(company_id, "queries")) or 0) if r else 0
    active_jobs = int(r.get(f"atlasiq:jobs:active:{company_id}") or 0) if r else 0
    return {
        "queries_today": queries_today,
        "queries_limit": quotas["queries_per_day"],
        "active_jobs": active_jobs,
        "concurrent_jobs_limit": quotas["concurrent_jobs"],
        "max_rows_per_query": quotas["max_rows_per_query"],
        "max_databases": quotas["max_databases"],
    }
