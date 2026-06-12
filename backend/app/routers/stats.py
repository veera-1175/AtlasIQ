from fastapi import APIRouter, Depends, HTTPException

from app.core.database import compute_satisfaction_rate, get_company_stats, get_user_query_stats, list_databases
from app.core.permissions import assert_not_super_admin_data_access
from app.core.security import require_user
from app.models.schemas import DashboardStats

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("", response_model=DashboardStats)
def get_stats(user: dict = Depends(require_user)) -> DashboardStats:
    assert_not_super_admin_data_access(user)
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="Company membership required")

    company_id = user["company_id"]
    is_employee = user.get("platform_role") == "employee"

    if is_employee:
        base = get_user_query_stats(company_id, user["id"])
        satisfaction = compute_satisfaction_rate(company_id, user["id"])
    else:
        base = get_company_stats(company_id)
        satisfaction = compute_satisfaction_rate(company_id)

    dbs = list_databases(company_id)

    return DashboardStats(
        total_queries=base["total_queries"],
        successful_queries=base["successful_queries"],
        success_rate=base["success_rate"],
        avg_latency_ms=base["avg_latency_ms"],
        database_count=base["database_count"],
        table_count=sum(d["table_count"] for d in dbs),
        satisfaction_rate=satisfaction,
    )
