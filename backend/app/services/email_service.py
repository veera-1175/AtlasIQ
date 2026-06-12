import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _send_email(to: str, subject: str, body: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host or not to:
        logger.info("Email skipped (SMTP not configured): %s — %s", to, subject)
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user or "noreply@atlasiq.io"
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", to, exc)
        return False


def send_welcome_email(to: str, name: str, temporary_password: str) -> bool:
    settings = get_settings()
    login_url = settings.app_public_url.rstrip("/")
    body = (
        f"Hello {name},\n\n"
        f"Your AtlasIQ employee account is ready.\n\n"
        f"Sign in: {login_url}\n"
        f"Email: {to}\n"
        f"Temporary password: {temporary_password}\n\n"
        "Please change your password after your first login if your administrator allows it.\n\n"
        "— AtlasIQ"
    )
    return _send_email(to, "Welcome to AtlasIQ", body)


def send_password_change_result_email(to: str, *, approved: bool, note: str | None = None) -> bool:
    if approved:
        subject = "AtlasIQ password change approved"
        body = "Your password change request was approved. You can sign in with your new password."
    else:
        subject = "AtlasIQ password change declined"
        body = "Your password change request was not approved."
        if note:
            body += f"\n\nNote from reviewer: {note}"
    return _send_email(to, subject, body)


def send_password_request_pending_email(admin_email: str, admin_name: str | None) -> bool:
    settings = get_settings()
    body = (
        f"A password change was requested by {admin_name or admin_email}.\n\n"
        f"Review pending requests in the AtlasIQ platform admin console:\n{settings.app_public_url.rstrip('/')}\n"
    )
    for admin in _platform_admin_recipients():
        _send_email(admin, "AtlasIQ password change pending review", body)
    return True


def _platform_admin_recipients() -> list[str]:
    from app.core.database import list_super_admin_users

    return [u["email"] for u in list_super_admin_users() if u.get("email")]


def send_employee_password_request_pending_email(company_id: str, employee_name: str) -> bool:
    from app.core.database import list_company_admins

    settings = get_settings()
    body = (
        f"{employee_name} requested a password change.\n\n"
        f"Review pending requests in Team & Access:\n{settings.app_public_url.rstrip('/')}\n"
    )
    sent = False
    for admin in list_company_admins(company_id):
        if admin.get("is_active") and admin.get("email"):
            sent = _send_email(admin["email"], "Employee password change pending", body) or sent
    return sent


def send_table_access_request_email(company_id: str, employee_name: str, tables: list[str]) -> bool:
    from app.core.database import list_company_admins

    settings = get_settings()
    table_list = ", ".join(tables[:10])
    body = (
        f"{employee_name} requested access to: {table_list}\n\n"
        f"Review in Team & Access:\n{settings.app_public_url.rstrip('/')}\n"
    )
    sent = False
    for admin in list_company_admins(company_id):
        if admin.get("is_active") and admin.get("email"):
            sent = _send_email(admin["email"], "Table access request pending", body) or sent
    return sent


def send_table_access_result_email(
    to: str,
    *,
    approved: bool,
    tables: list[str] | None = None,
    note: str | None = None,
) -> bool:
    if approved:
        subject = "AtlasIQ table access approved"
        table_list = ", ".join(tables or [])
        body = f"Your request for table access was approved.\n\nTables: {table_list}"
    else:
        subject = "AtlasIQ table access declined"
        body = "Your table access request was not approved."
        if note:
            body += f"\n\nNote from reviewer: {note}"
    return _send_email(to, subject, body)
