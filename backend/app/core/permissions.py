import json
from typing import Any

from fastapi import Depends, HTTPException

from app.core.security import require_user
from app.models.schemas import DatabaseSchema

PLATFORM_SUPER_ADMIN = "super_admin"
PLATFORM_COMPANY_ADMIN = "company_admin"
PLATFORM_EMPLOYEE = "employee"


def filter_schema_by_tables(
    schema: DatabaseSchema, allowed_tables: list[str] | None
) -> DatabaseSchema:
    if allowed_tables is None:
        return schema
    allowed = {t.lower() for t in allowed_tables}
    filtered_tables = [t for t in schema.tables if t.name.lower() in allowed]
    allowed_set = {t.name.lower() for t in filtered_tables}
    filtered_rels = [
        r
        for r in schema.relationships
        if r.from_table.lower() in allowed_set and r.to_table.lower() in allowed_set
    ]
    return DatabaseSchema(
        tables=filtered_tables, relationships=filtered_rels, dialect=schema.dialect
    )


def user_can_upload(user: dict[str, Any]) -> bool:
    return user.get("platform_role") == PLATFORM_COMPANY_ADMIN


def user_is_super_admin(user: dict[str, Any]) -> bool:
    return user.get("platform_role") == PLATFORM_SUPER_ADMIN


def user_is_company_admin(user: dict[str, Any]) -> bool:
    return user.get("platform_role") == PLATFORM_COMPANY_ADMIN


def get_allowed_tables(user: dict[str, Any]) -> list[str] | None:
    if user.get("platform_role") in (PLATFORM_SUPER_ADMIN, PLATFORM_COMPANY_ADMIN):
        return None
    raw = user.get("allowed_tables")
    if isinstance(raw, str):
        return json.loads(raw) if raw else []
    return raw or []


def require_role(*roles: str):
    async def checker(user: dict = Depends(require_user)) -> dict:
        if user["platform_role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return checker


require_super_admin = require_role(PLATFORM_SUPER_ADMIN)
require_company_admin = require_role(PLATFORM_COMPANY_ADMIN)
require_company_member = require_role(PLATFORM_COMPANY_ADMIN, PLATFORM_EMPLOYEE)


def require_company_data_user(user: dict = Depends(require_user)) -> dict:
    """Company admin or employee with a tenant — blocks platform super admin data access."""
    assert_not_super_admin_data_access(user)
    if user.get("platform_role") not in (PLATFORM_COMPANY_ADMIN, PLATFORM_EMPLOYEE):
        raise HTTPException(status_code=403, detail="Company membership required")
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="Company membership required")
    return user


def assert_not_super_admin_data_access(user: dict[str, Any]) -> None:
    if user_is_super_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Company data is confidential to AtlasIQ platform staff",
        )


def assert_database_access(user: dict[str, Any], record: dict[str, Any]) -> None:
    assert_not_super_admin_data_access(user)
    if record.get("company_id") != user.get("company_id"):
        raise HTTPException(status_code=404, detail="Database not found")
