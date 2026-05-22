from datetime import datetime

from fastapi import APIRouter, Depends

from app.core.database import (
    count_unread_notifications,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    sync_password_request_notifications,
)
from app.core.permissions import user_is_super_admin
from app.core.security import require_user
from app.models.schemas import NotificationItem, NotificationSummary

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationItem])
def get_notifications(user: dict = Depends(require_user)) -> list[NotificationItem]:
    if user_is_super_admin(user):
        sync_password_request_notifications()
    items = list_notifications(user["id"])
    return [
        NotificationItem(
            id=item["id"],
            kind=item["kind"],
            title=item["title"],
            message=item["message"],
            link_page=item.get("link_page"),
            is_read=item["is_read"],
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in items
    ]


@router.get("/summary", response_model=NotificationSummary)
def notification_summary(user: dict = Depends(require_user)) -> NotificationSummary:
    if user_is_super_admin(user):
        sync_password_request_notifications()
    return NotificationSummary(unread_count=count_unread_notifications(user["id"]))


@router.post("/{notification_id}/read")
def read_notification(notification_id: str, user: dict = Depends(require_user)) -> dict:
    mark_notification_read(notification_id, user["id"])
    return {"status": "ok"}


@router.post("/read-all")
def read_all_notifications(user: dict = Depends(require_user)) -> dict:
    mark_all_notifications_read(user["id"])
    return {"status": "ok"}
