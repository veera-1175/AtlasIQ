from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import (
    approve_password_change_request,
    create_company,
    create_company_admin,
    delete_company_admin,
    get_company,
    get_platform_analytics,
    get_platform_stats,
    list_audit_logs,
    list_companies,
    list_company_admins,
    list_password_change_requests,
    log_audit,
    reject_password_change_request,
    update_company_details,
    update_company_quotas,
)
from app.core.permissions import require_super_admin
from app.models.schemas import (
    AuditLogItem,
    CompanyAdminCreateRequest,
    CompanyAdminListItem,
    CompanyCreateRequest,
    CompanyDetailResponse,
    CompanyListItem,
    CompanyQuotaUpdateRequest,
    CompanyUpdateRequest,
    PasswordChangeRequestItem,
    PasswordChangeReviewBody,
    PlatformAnalytics,
    PlatformStats,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/stats", response_model=PlatformStats)
def platform_stats(_: dict = Depends(require_super_admin)) -> PlatformStats:
    return PlatformStats(**get_platform_stats())


@router.get("/analytics", response_model=PlatformAnalytics)
def platform_analytics(_: dict = Depends(require_super_admin)) -> PlatformAnalytics:
    return PlatformAnalytics(**get_platform_analytics())


@router.get("/companies", response_model=list[CompanyListItem])
def get_companies(_: dict = Depends(require_super_admin)) -> list[CompanyListItem]:
    return [
        CompanyListItem(
            id=item["id"],
            name=item["name"],
            is_active=bool(item["is_active"]),
            industry=item.get("industry"),
            plan_tier=item.get("plan_tier") or "professional",
            contact_name=item.get("contact_name"),
            contact_email=item.get("contact_email"),
            employee_count=item.get("employee_count") or 0,
            admin_count=item.get("admin_count") or 0,
            database_count=item.get("database_count") or 0,
            admin_email=item.get("admin_email"),
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in list_companies()
    ]


@router.get("/companies/{company_id}", response_model=CompanyDetailResponse)
def get_company_detail(company_id: str, _: dict = Depends(require_super_admin)) -> CompanyDetailResponse:
    company = get_company(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    admins = list_company_admins(company_id)
    stats_row = next((c for c in list_companies() if c["id"] == company_id), {})
    return CompanyDetailResponse(
        id=company["id"],
        name=company["name"],
        is_active=bool(company["is_active"]),
        industry=company.get("industry"),
        website=company.get("website"),
        address=company.get("address"),
        contact_name=company.get("contact_name"),
        contact_email=company.get("contact_email"),
        contact_phone=company.get("contact_phone"),
        plan_tier=company.get("plan_tier") or "professional",
        notes=company.get("notes"),
        quota_queries_per_day=company.get("quota_queries_per_day"),
        quota_max_rows=company.get("quota_max_rows"),
        quota_max_databases=company.get("quota_max_databases"),
        quota_concurrent_jobs=company.get("quota_concurrent_jobs"),
        employee_count=stats_row.get("employee_count") or 0,
        admin_count=len([a for a in admins if a.get("is_active")]),
        database_count=stats_row.get("database_count") or 0,
        created_at=datetime.fromisoformat(company["created_at"]),
        admins=[
            CompanyAdminListItem(
                id=a["id"],
                email=a["email"],
                full_name=a.get("full_name"),
                is_active=bool(a.get("is_active", 1)),
                created_at=datetime.fromisoformat(a["created_at"]),
            )
            for a in admins
        ],
    )


@router.post("/companies", response_model=CompanyDetailResponse)
def add_company(body: CompanyCreateRequest, user: dict = Depends(require_super_admin)) -> CompanyDetailResponse:
    company = create_company(
        body.name,
        user["id"],
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        industry=body.industry,
        website=body.website,
        address=body.address,
        plan_tier=body.plan_tier,
        notes=body.notes,
    )
    return get_company_detail(company["id"], user)


@router.get("/companies/{company_id}/admins", response_model=list[CompanyAdminListItem])
def get_company_admins(company_id: str, _: dict = Depends(require_super_admin)) -> list[CompanyAdminListItem]:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    return [
        CompanyAdminListItem(
            id=a["id"],
            email=a["email"],
            full_name=a.get("full_name"),
            is_active=bool(a.get("is_active", 1)),
            created_at=datetime.fromisoformat(a["created_at"]),
        )
        for a in list_company_admins(company_id)
    ]


@router.post("/companies/{company_id}/admins", response_model=CompanyAdminListItem)
def assign_company_admin(
    company_id: str,
    body: CompanyAdminCreateRequest,
    user: dict = Depends(require_super_admin),
) -> CompanyAdminListItem:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        admin = create_company_admin(company_id, body.email, body.password, body.full_name, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CompanyAdminListItem(
        id=admin["id"],
        email=admin["email"],
        full_name=admin.get("full_name"),
        is_active=True,
        created_at=datetime.fromisoformat(admin["created_at"]),
    )


@router.delete("/companies/{company_id}/admins/{admin_id}")
def remove_company_admin(company_id: str, admin_id: str, user: dict = Depends(require_super_admin)) -> dict:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        delete_company_admin(company_id, user["id"], admin_id=admin_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@router.delete("/companies/{company_id}/admin")
def remove_company_admin_legacy(company_id: str, user: dict = Depends(require_super_admin)) -> dict:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        delete_company_admin(company_id, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@router.patch("/companies/{company_id}", response_model=CompanyDetailResponse)
def patch_company(
    company_id: str,
    body: CompanyUpdateRequest,
    user: dict = Depends(require_super_admin),
) -> CompanyDetailResponse:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        update_company_details(company_id, user["id"], **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return get_company_detail(company_id, user)


@router.patch("/companies/{company_id}/quotas", response_model=CompanyDetailResponse)
def patch_company_quotas(
    company_id: str,
    body: CompanyQuotaUpdateRequest,
    user: dict = Depends(require_super_admin),
) -> CompanyDetailResponse:
    if not get_company(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        update_company_quotas(company_id, user["id"], **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return get_company_detail(company_id, user)


@router.patch("/companies/{company_id}/status")
def set_company_status(
    company_id: str,
    is_active: bool,
    user: dict = Depends(require_super_admin),
) -> dict:
    company = get_company(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.database import get_db

    with get_db() as conn:
        conn.execute("UPDATE companies SET is_active = ? WHERE id = ?", (int(is_active), company_id))

    log_audit(
        "company.status_changed",
        user_id=user["id"],
        company_id=company_id,
        resource_type="company",
        resource_id=company_id,
        details={"is_active": is_active},
    )
    return {"status": "ok", "is_active": is_active}


@router.get("/password-requests", response_model=list[PasswordChangeRequestItem])
def password_requests(
    _: dict = Depends(require_super_admin),
    status: str = "pending",
) -> list[PasswordChangeRequestItem]:
    items = list_password_change_requests(
        status=status if status != "all" else None,
        requester_role="company_admin",
    )
    return [
        PasswordChangeRequestItem(
            id=item["id"],
            user_id=item["user_id"],
            user_email=item.get("user_email"),
            user_name=item.get("user_name"),
            company_id=item.get("company_id"),
            company_name=item.get("company_name"),
            requester_role=item.get("requester_role"),
            status=item["status"],
            created_at=datetime.fromisoformat(item["created_at"]),
            reviewed_at=datetime.fromisoformat(item["reviewed_at"]) if item.get("reviewed_at") else None,
            review_note=item.get("review_note"),
        )
        for item in items
    ]


@router.post("/password-requests/{request_id}/approve", response_model=PasswordChangeRequestItem)
def approve_password_request(
    request_id: str,
    user: dict = Depends(require_super_admin),
) -> PasswordChangeRequestItem:
    try:
        item = approve_password_change_request(request_id, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PasswordChangeRequestItem(
        id=item["id"],
        user_id=item["user_id"],
        user_email=item.get("user_email"),
        user_name=item.get("user_name"),
        company_id=item.get("company_id"),
        company_name=item.get("company_name"),
        status=item["status"],
        created_at=datetime.fromisoformat(item["created_at"]),
        reviewed_at=datetime.fromisoformat(item["reviewed_at"]) if item.get("reviewed_at") else None,
        review_note=item.get("review_note"),
    )


@router.post("/password-requests/{request_id}/reject", response_model=PasswordChangeRequestItem)
def reject_password_request(
    request_id: str,
    body: PasswordChangeReviewBody,
    user: dict = Depends(require_super_admin),
) -> PasswordChangeRequestItem:
    try:
        item = reject_password_change_request(request_id, user, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PasswordChangeRequestItem(
        id=item["id"],
        user_id=item["user_id"],
        user_email=item.get("user_email"),
        user_name=item.get("user_name"),
        company_id=item.get("company_id"),
        company_name=item.get("company_name"),
        status=item["status"],
        created_at=datetime.fromisoformat(item["created_at"]),
        reviewed_at=datetime.fromisoformat(item["reviewed_at"]) if item.get("reviewed_at") else None,
        review_note=item.get("review_note"),
    )


@router.get("/audit", response_model=list[AuditLogItem])
def platform_audit(_: dict = Depends(require_super_admin), limit: int = 100) -> list[AuditLogItem]:
    items = list_audit_logs(company_id=None, limit=limit)
    return [
        AuditLogItem(
            id=item["id"],
            action=item["action"],
            resource_type=item.get("resource_type"),
            resource_id=item.get("resource_id"),
            details=item.get("details"),
            user_email=item.get("user_email"),
            company_name=item.get("company_name"),
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in items
        if not item["action"].startswith(("query.", "database."))
    ]
