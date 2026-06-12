from fastapi import APIRouter, Depends, HTTPException

from app.core.database import authenticate_user, get_user_by_email
from app.core.permissions import get_allowed_tables, user_can_upload
from app.core.security import create_access_token, require_user, verify_password
from app.models.schemas import LoginRequest, TokenResponse, UserProfile

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _avatar_url(user: dict) -> str | None:
    if not user.get("avatar_path"):
        return None
    if user.get("platform_role") == "employee":
        return "/api/v1/employee/profile/avatar"
    return "/api/v1/company/profile/avatar"


def _user_profile(user: dict) -> UserProfile:
    return UserProfile(
        id=user["id"],
        email=user["email"],
        platform_role=user["platform_role"],
        company_id=user.get("company_id"),
        company_name=user.get("company_name"),
        full_name=user.get("full_name"),
        employee_id=user.get("employee_id"),
        designation=user.get("designation"),
        allowed_tables=get_allowed_tables(user) or [],
        can_upload=user_can_upload(user),
        avatar_url=_avatar_url(user),
        onboarding_completed=bool(user.get("onboarding_completed_at")),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    user = authenticate_user(email, body.password)
    if not user:
        probe = get_user_by_email(email)
        if probe and probe.get("password_hash") and verify_password(body.password, probe["password_hash"]):
            if not probe.get("is_active"):
                raise HTTPException(status_code=401, detail="Account inactive")
            if (
                probe.get("platform_role") != "super_admin"
                and probe.get("company_id")
                and not probe.get("company_is_active", True)
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Your organization has been deactivated. Contact AtlasIQ support.",
                )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        {
            "sub": user["id"],
            "email": user["email"],
            "platform_role": user["platform_role"],
            "company_id": user.get("company_id"),
        }
    )
    return TokenResponse(
        access_token=token,
        email=user["email"],
        platform_role=user["platform_role"],
        company_id=user.get("company_id"),
        company_name=user.get("company_name"),
    )


@router.get("/me", response_model=UserProfile)
def me(user: dict = Depends(require_user)) -> UserProfile:
    return _user_profile(user)
