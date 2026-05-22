import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.database import (
    clear_user_avatar,
    complete_employee_onboarding,
    compute_satisfaction_rate,
    create_password_change_request,
    create_saved_query,
    create_table_access_request,
    delete_saved_query,
    find_database_for_table,
    get_query_history,
    get_user_by_id,
    get_user_query_stats,
    has_pending_password_request,
    list_company_table_names,
    list_databases,
    list_query_templates,
    list_saved_queries,
    get_table_access_request,
    list_table_access_requests,
    log_audit,
    resolve_user_avatar_file,
    set_user_avatar,
    update_member_full_name,
    user_avatars_dir,
)
from app.core.designations import suggest_questions_for_designation, suggest_tables_for_designation
from app.core.permissions import require_company_member
from app.core.security import hash_password, verify_password
from app.models.schemas import (
    DashboardStats,
    EmployeeProfileResponse,
    EmployeeProfileUpdate,
    EmployeeUsageResponse,
    EmployeeWorkspaceHints,
    PasswordChangeRequestBody,
    QueryHistoryItem,
    QueryTemplateItem,
    SavedQueryCreate,
    SavedQueryItem,
    TableAccessRequestCreate,
    TableAccessRequestItem,
)

router = APIRouter(prefix="/api/v1/employee", tags=["employee"])

_ALLOWED_AVATAR_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _require_employee(user: dict = Depends(require_company_member)) -> dict:
    if user.get("platform_role") != "employee":
        raise HTTPException(status_code=403, detail="Employees only")
    return user


def _pending_table_names(user_id: str) -> list[str]:
    pending: list[str] = []
    for req in list_table_access_requests(status="pending", user_id=user_id):
        pending.extend(req.get("table_names") or [])
    return sorted(set(pending))


def _employee_profile(user: dict) -> EmployeeProfileResponse:
    fresh = get_user_by_id(user["id"]) or user
    tables = fresh.get("allowed_tables") or []
    last_login = fresh.get("last_login_at")
    created = fresh.get("created_at")
    return EmployeeProfileResponse(
        id=fresh["id"],
        email=fresh["email"],
        full_name=fresh.get("full_name"),
        employee_id=fresh.get("employee_id"),
        designation=fresh.get("designation"),
        department=fresh.get("department"),
        allowed_tables=tables,
        avatar_url="/api/v1/employee/profile/avatar" if fresh.get("avatar_path") else None,
        last_login_at=datetime.fromisoformat(last_login) if last_login else None,
        created_at=datetime.fromisoformat(created) if created else datetime.now(),
        password_change_pending=has_pending_password_request(fresh["id"]),
        company_name=fresh.get("company_name"),
        security_note=fresh.get("security_note"),
        onboarding_completed=bool(fresh.get("onboarding_completed_at")),
        pending_table_access=_pending_table_names(fresh["id"]),
    )


@router.get("/profile", response_model=EmployeeProfileResponse)
def get_profile(user: dict = Depends(_require_employee)) -> EmployeeProfileResponse:
    return _employee_profile(user)


@router.patch("/profile", response_model=EmployeeProfileResponse)
def update_profile(body: EmployeeProfileUpdate, user: dict = Depends(_require_employee)) -> EmployeeProfileResponse:
    if body.full_name is not None:
        try:
            update_member_full_name(user["id"], user["company_id"], body.full_name)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    if body.complete_onboarding:
        complete_employee_onboarding(user["id"])
    return _employee_profile(get_user_by_id(user["id"]) or user)


@router.get("/profile/avatar")
def get_avatar(user: dict = Depends(_require_employee)):
    path = resolve_user_avatar_file(user["id"])
    if not path:
        raise HTTPException(status_code=404, detail="No profile picture")
    return FileResponse(path)


@router.post("/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(_require_employee)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_AVATAR_EXT:
        raise HTTPException(status_code=400, detail="Allowed formats: JPG, PNG, WebP, GIF")
    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller")
    filename = f"{user['id']}{ext}"
    (user_avatars_dir() / filename).write_bytes(content)
    set_user_avatar(user["id"], filename)
    log_audit(
        "employee.avatar_updated",
        user_id=user["id"],
        company_id=user["company_id"],
        resource_type="user",
        resource_id=user["id"],
    )
    return {"avatar_url": "/api/v1/employee/profile/avatar"}


@router.delete("/profile/avatar")
def delete_avatar(user: dict = Depends(_require_employee)) -> dict:
    if not resolve_user_avatar_file(user["id"]):
        raise HTTPException(status_code=404, detail="No profile picture to remove")
    clear_user_avatar(user["id"])
    log_audit(
        "employee.avatar_removed",
        user_id=user["id"],
        company_id=user["company_id"],
        resource_type="user",
        resource_id=user["id"],
    )
    return {"avatar_url": None}


@router.post("/profile/password-request")
def request_password_change(body: PasswordChangeRequestBody, user: dict = Depends(_require_employee)) -> dict:
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
            "employee",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "status": "pending",
        "message": "Password change submitted for company admin approval",
        "request_id": req["id"],
    }


@router.get("/usage", response_model=EmployeeUsageResponse)
def my_usage(user: dict = Depends(_require_employee), limit: int = 100) -> EmployeeUsageResponse:
    company_id = user["company_id"]
    base = get_user_query_stats(company_id, user["id"])
    dbs = list_databases(company_id)
    items = get_query_history(company_id, user_id=user["id"], limit=min(limit, 200))
    return EmployeeUsageResponse(
        stats=DashboardStats(
            total_queries=base["total_queries"],
            successful_queries=base["successful_queries"],
            success_rate=base["success_rate"],
            avg_latency_ms=base["avg_latency_ms"],
            database_count=base["database_count"],
            table_count=sum(d["table_count"] for d in dbs),
            satisfaction_rate=compute_satisfaction_rate(company_id, user["id"]),
        ),
        recent_queries=[
            QueryHistoryItem(
                id=uuid.UUID(item["id"]),
                database_id=uuid.UUID(item["database_id"]),
                question=item["question"],
                generated_sql=item.get("generated_sql"),
                success=bool(item["success"]),
                row_count=item.get("row_count"),
                execution_ms=item.get("execution_ms"),
                explanation=item.get("explanation"),
                user_email=item.get("user_email"),
                user_name=item.get("user_name"),
                created_at=datetime.fromisoformat(item["created_at"]),
            )
            for item in items
        ],
    )


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


@router.get("/workspace-hints", response_model=EmployeeWorkspaceHints)
def workspace_hints(user: dict = Depends(_require_employee)) -> EmployeeWorkspaceHints:
    fresh = get_user_by_id(user["id"]) or user
    designation = fresh.get("designation") or ""
    allowed = set(fresh.get("allowed_tables") or [])
    company_tables = list_company_table_names(user["company_id"])
    role_tables = suggest_tables_for_designation(designation, company_tables)
    suggested_tables = [t for t in role_tables if t in allowed] or list(allowed)[:6]
    templates = list_query_templates(user["company_id"], designation=designation or None)
    return EmployeeWorkspaceHints(
        designation=designation or None,
        suggested_tables=suggested_tables[:8],
        suggested_questions=suggest_questions_for_designation(designation)[:6],
        query_templates=[
            QueryTemplateItem(
                id=t["id"],
                title=t["title"],
                question=t["question"],
                database_id=t.get("database_id"),
                designation=t.get("designation"),
                created_at=datetime.fromisoformat(t["created_at"]),
            )
            for t in templates[:12]
        ],
        available_tables=[t for t in company_tables if t not in allowed],
    )


@router.post("/table-access-requests", response_model=TableAccessRequestItem)
def request_table_access(
    body: TableAccessRequestCreate,
    user: dict = Depends(_require_employee),
) -> TableAccessRequestItem:
    try:
        req = create_table_access_request(user["id"], user["company_id"], body.table_names, body.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    full = get_table_access_request(req["id"])
    return _table_access_item(full or req)


@router.get("/table-access-requests", response_model=list[TableAccessRequestItem])
def my_table_access_requests(user: dict = Depends(_require_employee)) -> list[TableAccessRequestItem]:
    items = list_table_access_requests(user_id=user["id"])
    return [_table_access_item(i) for i in items]


@router.get("/saved-queries", response_model=list[SavedQueryItem])
def get_saved_queries(user: dict = Depends(_require_employee)) -> list[SavedQueryItem]:
    return [
        SavedQueryItem(
            id=item["id"],
            database_id=item["database_id"],
            name=item.get("name"),
            question=item["question"],
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in list_saved_queries(user["id"])
    ]


@router.post("/saved-queries", response_model=SavedQueryItem)
def save_query(body: SavedQueryCreate, user: dict = Depends(_require_employee)) -> SavedQueryItem:
    item = create_saved_query(
        user["id"],
        user["company_id"],
        str(body.database_id),
        body.question,
        body.name,
    )
    return SavedQueryItem(
        id=item["id"],
        database_id=item["database_id"],
        name=item.get("name"),
        question=item["question"],
        created_at=datetime.fromisoformat(item["created_at"]),
    )


@router.delete("/saved-queries/{query_id}")
def remove_saved_query(query_id: str, user: dict = Depends(_require_employee)) -> dict:
    try:
        delete_saved_query(query_id, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@router.get("/tables/{table_name}/database")
def resolve_table_database(table_name: str, user: dict = Depends(_require_employee)) -> dict:
    match = find_database_for_table(user["company_id"], table_name)
    if not match:
        raise HTTPException(status_code=404, detail="Table not found in any connected database")
    fresh = get_user_by_id(user["id"]) or user
    allowed = {t.lower() for t in (fresh.get("allowed_tables") or [])}
    if match["table_name"].lower() not in allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this table")
    return match


@router.get("/query-templates", response_model=list[QueryTemplateItem])
def employee_query_templates(user: dict = Depends(_require_employee)) -> list[QueryTemplateItem]:
    fresh = get_user_by_id(user["id"]) or user
    items = list_query_templates(user["company_id"], designation=fresh.get("designation"))
    return [
        QueryTemplateItem(
            id=t["id"],
            title=t["title"],
            question=t["question"],
            database_id=t.get("database_id"),
            designation=t.get("designation"),
            created_at=datetime.fromisoformat(t["created_at"]),
        )
        for t in items
    ]
