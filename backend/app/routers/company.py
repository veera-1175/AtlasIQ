import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.core.database import (
    approve_password_change_request,
    approve_table_access_request,
    clear_user_avatar,
    create_employee,
    create_password_change_request,
    create_query_template,
    delete_employee,
    delete_query_template,
    get_company,
    get_company_analytics,
    get_company_stats,
    get_employee_detail,
    get_query_history,
    get_user_by_id,
    has_pending_password_request,
    list_audit_logs,
    list_company_activity,
    find_database_for_table,
    list_company_table_names,
    list_company_users,
    list_password_change_requests,
    list_query_templates,
    list_table_access_requests,
    log_audit,
    reject_password_change_request,
    reject_table_access_request,
    resolve_user_avatar_file,
    set_user_avatar,
    update_admin_full_name,
    update_company_contact_info,
    update_employee,
    user_avatars_dir,
)
from app.core.security import hash_password, verify_password
from app.core.designations import (
    DESIGNATION_TABLE_HINTS,
    PLATFORM_AUDIT_ACTIONS,
    designations_for_industry,
    validate_designation_for_industry,
)
from app.core.permissions import require_company_admin
from app.models.schemas import (
    ActivityItem,
    AuditLogItem,
    CompanyAdminProfileResponse,
    CompanyAdminProfileUpdate,
    CompanyAnalytics,
    CompanyProfileSection,
    DesignationListResponse,
    EmployeeCreateRequest,
    EmployeeDetailResponse,
    EmployeeListItem,
    EmployeeUpdateRequest,
    PasswordChangeRequestBody,
    PasswordChangeRequestItem,
    PasswordChangeReviewBody,
    QueryHistoryItem,
    QueryTemplateCreate,
    QueryTemplateItem,
    TableAccessRequestItem,
)

router = APIRouter(prefix="/api/v1/company", tags=["company"])


def _employee_item(item: dict) -> EmployeeListItem:
    tables = item.get("allowed_tables") or []
    if isinstance(tables, str):
        import json
        tables = json.loads(tables) if tables else []
    last_login = item.get("last_login_at")
    return EmployeeListItem(
        id=item["id"],
        email=item["email"],
        employee_id=item.get("employee_id"),
        full_name=item.get("full_name"),
        platform_role=item["platform_role"],
        designation=item.get("designation"),
        department=item.get("department"),
        allowed_tables=tables,
        is_active=bool(item.get("is_active", 1)),
        created_at=datetime.fromisoformat(item["created_at"]),
        last_login_at=datetime.fromisoformat(last_login) if last_login else None,
        security_note=item.get("security_note"),
    )


def _company_industry(company_id: str) -> str | None:
    company = get_company(company_id)
    if not company:
        return None
    industry = company.get("industry")
    return str(industry).strip() if industry else None


def _avatar_url(user: dict) -> str | None:
    if user.get("avatar_path"):
        return "/api/v1/company/profile/avatar"
    return None


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.fromisoformat("1970-01-01T00:00:00+00:00")
    return datetime.fromisoformat(value)


def _company_section(company: dict) -> CompanyProfileSection:
    created = company.get("created_at")
    return CompanyProfileSection(
        id=company["id"],
        name=company["name"],
        is_active=bool(company.get("is_active", 1)),
        industry=company.get("industry"),
        plan_tier=company.get("plan_tier") or "professional",
        contact_name=company.get("contact_name"),
        contact_email=company.get("contact_email"),
        contact_phone=company.get("contact_phone"),
        website=company.get("website"),
        address=company.get("address"),
        quota_queries_per_day=company.get("quota_queries_per_day"),
        quota_max_rows=company.get("quota_max_rows"),
        quota_max_databases=company.get("quota_max_databases"),
        created_at=_parse_dt(created),
    )


def _admin_profile_response(user: dict, company: dict) -> CompanyAdminProfileResponse:
    last_login = user.get("last_login_at")
    created = user.get("created_at")
    return CompanyAdminProfileResponse(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
        platform_role=user["platform_role"],
        avatar_url=_avatar_url(user),
        last_login_at=datetime.fromisoformat(last_login) if last_login else None,
        created_at=_parse_dt(created),
        password_change_pending=has_pending_password_request(user["id"]),
        company=_company_section(company),
    )


_ALLOWED_AVATAR_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024


@router.get("/profile", response_model=CompanyAdminProfileResponse)
def admin_profile(user: dict = Depends(require_company_admin)) -> CompanyAdminProfileResponse:
    company = get_company(user["company_id"])
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    fresh = get_user_by_id(user["id"]) or user
    return _admin_profile_response(fresh, company)


@router.patch("/profile", response_model=CompanyAdminProfileResponse)
def update_admin_profile(
    body: CompanyAdminProfileUpdate,
    user: dict = Depends(require_company_admin),
) -> CompanyAdminProfileResponse:
    company = get_company(user["company_id"])
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if body.full_name is not None:
        try:
            update_admin_full_name(user["id"], user["company_id"], body.full_name, user["id"])
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    contact_fields = {
        "contact_name": body.contact_name,
        "contact_email": body.contact_email,
        "contact_phone": body.contact_phone,
        "website": body.website,
        "address": body.address,
    }
    if any(v is not None for v in contact_fields.values()):
        company = update_company_contact_info(user["company_id"], user["id"], **contact_fields)

    fresh = get_user_by_id(user["id"]) or user
    return _admin_profile_response(fresh, company)


@router.get("/profile/avatar")
def get_admin_avatar(user: dict = Depends(require_company_admin)):
    path = resolve_user_avatar_file(user["id"])
    if not path:
        raise HTTPException(status_code=404, detail="No profile picture")
    return FileResponse(path)


@router.post("/profile/avatar")
async def upload_admin_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(require_company_admin),
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_AVATAR_EXT:
        raise HTTPException(status_code=400, detail="Allowed formats: JPG, PNG, WebP, GIF")

    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller")

    filename = f"{user['id']}{ext}"
    dest = user_avatars_dir() / filename
    dest.write_bytes(content)
    set_user_avatar(user["id"], filename)
    log_audit(
        "admin.avatar_updated",
        user_id=user["id"],
        company_id=user["company_id"],
        resource_type="user",
        resource_id=user["id"],
    )
    return {"avatar_url": "/api/v1/company/profile/avatar"}


@router.delete("/profile/avatar")
def delete_admin_avatar(user: dict = Depends(require_company_admin)) -> dict:
    fresh = get_user_by_id(user["id"]) or user
    if not fresh.get("avatar_path") and not resolve_user_avatar_file(user["id"]):
        raise HTTPException(status_code=404, detail="No profile picture to remove")
    clear_user_avatar(user["id"])
    log_audit(
        "admin.avatar_removed",
        user_id=user["id"],
        company_id=user["company_id"],
        resource_type="user",
        resource_id=user["id"],
    )
    return {"avatar_url": None}


@router.post("/profile/password-request")
def request_password_change(
    body: PasswordChangeRequestBody,
    user: dict = Depends(require_company_admin),
) -> dict:
    fresh = get_user_by_id(user["id"]) or user
    if not fresh.get("password_hash") or not verify_password(body.current_password, fresh["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if verify_password(body.new_password, fresh["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    try:
        req = create_password_change_request(
            user["id"],
            user["company_id"],
            hash_password(body.new_password),
            "company_admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "pending",
        "message": "Password change submitted for platform admin approval",
        "request_id": req["id"],
    }


def _password_request_item(item: dict) -> PasswordChangeRequestItem:
    return PasswordChangeRequestItem(
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


@router.get("/password-requests", response_model=list[PasswordChangeRequestItem])
def employee_password_requests(
    user: dict = Depends(require_company_admin),
    status: str = "pending",
) -> list[PasswordChangeRequestItem]:
    items = list_password_change_requests(
        status=status if status != "all" else None,
        company_id=user["company_id"],
        requester_role="employee",
    )
    return [_password_request_item(item) for item in items]


@router.post("/password-requests/{request_id}/approve", response_model=PasswordChangeRequestItem)
def approve_employee_password(
    request_id: str,
    user: dict = Depends(require_company_admin),
) -> PasswordChangeRequestItem:
    try:
        item = approve_password_change_request(request_id, user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _password_request_item(item)


@router.post("/password-requests/{request_id}/reject", response_model=PasswordChangeRequestItem)
def reject_employee_password(
    request_id: str,
    body: PasswordChangeReviewBody,
    user: dict = Depends(require_company_admin),
) -> PasswordChangeRequestItem:
    try:
        item = reject_password_change_request(request_id, user, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _password_request_item(item)


def _table_access_item(item: dict) -> TableAccessRequestItem:
    return TableAccessRequestItem(
        id=item["id"],
        user_id=item["user_id"],
        user_email=item.get("user_email"),
        user_name=item.get("user_name"),
        table_names=item.get("table_names") or [],
        reason=item.get("reason"),
        status=item["status"],
        created_at=datetime.fromisoformat(item["created_at"]),
        reviewed_at=datetime.fromisoformat(item["reviewed_at"]) if item.get("reviewed_at") else None,
        review_note=item.get("review_note"),
    )


@router.get("/table-access-requests", response_model=list[TableAccessRequestItem])
def company_table_access_requests(
    user: dict = Depends(require_company_admin),
    status: str = "pending",
) -> list[TableAccessRequestItem]:
    items = list_table_access_requests(
        status=status if status != "all" else None,
        company_id=user["company_id"],
    )
    return [_table_access_item(i) for i in items]


@router.post("/table-access-requests/{request_id}/approve", response_model=TableAccessRequestItem)
def approve_table_access(
    request_id: str,
    user: dict = Depends(require_company_admin),
) -> TableAccessRequestItem:
    try:
        item = approve_table_access_request(request_id, user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _table_access_item(item)


@router.post("/table-access-requests/{request_id}/reject", response_model=TableAccessRequestItem)
def reject_table_access(
    request_id: str,
    body: PasswordChangeReviewBody,
    user: dict = Depends(require_company_admin),
) -> TableAccessRequestItem:
    try:
        item = reject_table_access_request(request_id, user, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _table_access_item(item)


@router.get("/query-templates", response_model=list[QueryTemplateItem])
def get_query_templates(user: dict = Depends(require_company_admin)) -> list[QueryTemplateItem]:
    return [
        QueryTemplateItem(
            id=t["id"],
            title=t["title"],
            question=t["question"],
            database_id=t.get("database_id"),
            designation=t.get("designation"),
            created_at=datetime.fromisoformat(t["created_at"]),
        )
        for t in list_query_templates(user["company_id"])
    ]


@router.post("/query-templates", response_model=QueryTemplateItem)
def add_query_template(
    body: QueryTemplateCreate,
    user: dict = Depends(require_company_admin),
) -> QueryTemplateItem:
    item = create_query_template(
        user["company_id"],
        user["id"],
        body.title,
        body.question,
        str(body.database_id) if body.database_id else None,
        body.designation,
    )
    return QueryTemplateItem(
        id=item["id"],
        title=item["title"],
        question=item["question"],
        database_id=item.get("database_id"),
        designation=item.get("designation"),
        created_at=datetime.fromisoformat(item["created_at"]),
    )


@router.delete("/query-templates/{template_id}")
def remove_query_template(template_id: str, user: dict = Depends(require_company_admin)) -> dict:
    try:
        delete_query_template(template_id, user["company_id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@router.get("/designations", response_model=DesignationListResponse)
def designations(user: dict = Depends(require_company_admin)) -> DesignationListResponse:
    industry = _company_industry(user["company_id"])
    return DesignationListResponse(
        designations=designations_for_industry(industry),
        table_hints=DESIGNATION_TABLE_HINTS,
        industry=industry,
    )


@router.get("/tables")
def company_tables(user: dict = Depends(require_company_admin)) -> dict:
    return {"tables": list_company_table_names(user["company_id"])}


@router.get("/tables/{table_name}/database")
def resolve_table_database(table_name: str, user: dict = Depends(require_company_admin)) -> dict:
    match = find_database_for_table(user["company_id"], table_name)
    if not match:
        raise HTTPException(status_code=404, detail="Table not found in any connected database")
    return match


@router.get("/stats")
def company_stats(user: dict = Depends(require_company_admin)) -> dict:
    return get_company_stats(user["company_id"])


@router.get("/analytics", response_model=CompanyAnalytics)
def company_analytics(user: dict = Depends(require_company_admin)) -> CompanyAnalytics:
    return CompanyAnalytics(**get_company_analytics(user["company_id"]))


@router.get("/activity", response_model=list[ActivityItem])
def company_activity(
    user: dict = Depends(require_company_admin),
    limit: int = 100,
    user_id: str | None = Query(None),
) -> list[ActivityItem]:
    items = list_company_activity(user["company_id"], limit=limit, user_id=user_id)
    return [ActivityItem(**item) for item in items]


@router.get("/employees/{employee_id}/detail", response_model=EmployeeDetailResponse)
def employee_detail(employee_id: str, user: dict = Depends(require_company_admin)) -> EmployeeDetailResponse:
    try:
        data = get_employee_detail(employee_id, user["company_id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return EmployeeDetailResponse(
        employee=_employee_item(data["employee"]),
        stats=data["stats"],
        queries=[
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
            for item in data["queries"]
        ],
        activity=[ActivityItem(**item) for item in data["activity"]],
        audit=[
            AuditLogItem(
                id=item["id"],
                action=item["action"],
                resource_type=item.get("resource_type"),
                resource_id=item.get("resource_id"),
                details=item.get("details"),
                user_email=item.get("user_email"),
                user_name=item.get("user_name"),
                created_at=datetime.fromisoformat(item["created_at"]),
            )
            for item in data["audit"]
        ],
    )


@router.get("/employees", response_model=list[EmployeeListItem])
def employees(
    user: dict = Depends(require_company_admin),
    department: str | None = None,
    employee_id: str | None = None,
    search: str | None = None,
    include_inactive: bool = False,
) -> list[EmployeeListItem]:
    items = list_company_users(
        user["company_id"],
        department=department,
        employee_id=employee_id,
        search=search,
        platform_role="employee",
        active_only=not include_inactive,
    )
    return [_employee_item(item) for item in items]


@router.post("/employees", response_model=EmployeeListItem)
def add_employee(body: EmployeeCreateRequest, user: dict = Depends(require_company_admin)) -> EmployeeListItem:
    try:
        validate_designation_for_industry(_company_industry(user["company_id"]), body.designation)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        emp = create_employee(
            user["company_id"],
            body.email,
            body.password,
            body.full_name,
            body.employee_id,
            body.designation,
            body.allowed_tables,
            user["id"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(status_code=400, detail="Email already registered") from exc
        raise
    return _employee_item(emp)


@router.put("/employees/{employee_id}", response_model=EmployeeListItem)
def edit_employee(
    employee_id: str,
    body: EmployeeUpdateRequest,
    user: dict = Depends(require_company_admin),
) -> EmployeeListItem:
    if body.designation is not None:
        try:
            validate_designation_for_industry(_company_industry(user["company_id"]), body.designation)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        emp = update_employee(
            employee_id,
            user["company_id"],
            full_name=body.full_name,
            employee_badge=body.employee_id,
            designation=body.designation,
            allowed_tables=body.allowed_tables,
            password=body.password,
            is_active=body.is_active,
            security_note=body.security_note,
            updated_by=user["id"],
        )
    except ValueError as exc:
        msg = str(exc)
        status = 404 if msg == "Employee not found" else 400
        raise HTTPException(status_code=status, detail=msg) from exc
    return _employee_item(emp)


@router.delete("/employees/{employee_id}")
def remove_employee(employee_id: str, user: dict = Depends(require_company_admin)) -> dict:
    try:
        delete_employee(employee_id, user["company_id"], user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deactivated"}


@router.get("/audit", response_model=list[AuditLogItem])
def company_audit(user: dict = Depends(require_company_admin), limit: int = 100) -> list[AuditLogItem]:
    items = list_audit_logs(company_id=user["company_id"], limit=limit)
    return [
        AuditLogItem(
            id=item["id"],
            action=item["action"],
            resource_type=item.get("resource_type"),
            resource_id=item.get("resource_id"),
            details=item.get("details"),
            user_email=item.get("user_email"),
            user_name=item.get("user_name"),
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in items
        if item["action"] not in PLATFORM_AUDIT_ACTIONS
    ]


@router.get("/queries", response_model=list[QueryHistoryItem])
def company_queries(user: dict = Depends(require_company_admin), limit: int = 100) -> list[QueryHistoryItem]:
    items = get_query_history(user["company_id"], user_id=None, limit=limit)
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
