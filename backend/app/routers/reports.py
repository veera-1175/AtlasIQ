import uuid

from datetime import datetime


from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException


from app.core.database import (
    create_report,
    delete_report,
    get_database,
    get_report,
    list_report_runs,
    list_reports,
    update_report,
)

from app.core.permissions import assert_database_access, require_company_data_user

from app.models.schemas import (
    ReportCreateRequest,
    ReportItem,
    ReportRunItem,
    ReportUpdateRequest,
)

from app.services.report_runner import assert_report_access, execute_report

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _report_item(item: dict) -> ReportItem:

    return ReportItem(
        id=uuid.UUID(item["id"]),
        database_id=uuid.UUID(item["database_id"]),
        name=item["name"],
        question=item["question"],
        schedule=item["schedule"],
        last_run_at=(
            datetime.fromisoformat(item["last_run_at"])
            if item.get("last_run_at")
            else None
        ),
        last_status=item.get("last_status"),
        last_result=item.get("last_result"),
        created_at=datetime.fromisoformat(item["created_at"]),
    )


def _get_report_or_404(report_id: str, user: dict) -> dict:

    report = get_report(report_id)

    if not report:

        raise HTTPException(status_code=404, detail="Report not found")

    try:

        assert_report_access(report, user)

    except ValueError as exc:

        msg = str(exc)

        if msg == "Not your report":

            raise HTTPException(status_code=403, detail=msg) from exc

        raise HTTPException(status_code=404, detail="Report not found") from exc

    return report


@router.post("", response_model=ReportItem)
def create_scheduled_report(
    body: ReportCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_company_data_user),
) -> ReportItem:

    record = get_database(str(body.database_id))

    if not record:

        raise HTTPException(status_code=404, detail="Database not found")

    assert_database_access(user, record)

    report_id = create_report(
        user["company_id"],
        user["id"],
        str(body.database_id),
        body.name,
        body.question,
        body.schedule,
    )

    background_tasks.add_task(execute_report, report_id)

    report = get_report(report_id)

    assert report is not None

    return _report_item(report)


@router.get("", response_model=list[ReportItem])
def get_reports(user: dict = Depends(require_company_data_user)) -> list[ReportItem]:

    user_filter = user["id"] if user.get("platform_role") == "employee" else None

    items = list_reports(user["company_id"], user_id=user_filter)

    return [_report_item(item) for item in items]


@router.get("/{report_id}/runs", response_model=list[ReportRunItem])
def get_report_runs(
    report_id: str, user: dict = Depends(require_company_data_user)
) -> list[ReportRunItem]:

    _get_report_or_404(report_id, user)

    return [
        ReportRunItem(
            id=r["id"],
            report_id=r["report_id"],
            status=r["status"],
            result_summary=r.get("result_summary"),
            ran_at=datetime.fromisoformat(r["ran_at"]),
        )
        for r in list_report_runs(report_id)
    ]


@router.post("/{report_id}/run")
def run_report_now(
    report_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_company_data_user),
) -> dict:

    _get_report_or_404(report_id, user)

    background_tasks.add_task(execute_report, report_id)

    return {"status": "queued"}


@router.patch("/{report_id}", response_model=ReportItem)
def patch_report(
    report_id: str,
    body: ReportUpdateRequest,
    user: dict = Depends(require_company_data_user),
) -> ReportItem:
    _get_report_or_404(report_id, user)
    updated = update_report(report_id, **body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_item(updated)


@router.delete("/{report_id}")
def remove_report(
    report_id: str, user: dict = Depends(require_company_data_user)
) -> dict:

    _get_report_or_404(report_id, user)

    try:

        delete_report(report_id)

    except ValueError as exc:

        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {"status": "deleted"}
