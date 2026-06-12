import uuid

from datetime import datetime


from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile


from app.core.config import get_settings

from app.core.database import (
    company_uploads_dir,
    delete_database,
    get_company,
    get_database,
    list_databases,
    save_database,
)

from app.core.permissions import (
    assert_database_access,
    filter_schema_by_tables,
    get_allowed_tables,
    require_company_data_user,
    user_can_upload,
    user_is_company_admin,
)

from app.core.quotas import check_database_quota

from app.models.schemas import (
    DatabaseListItem,
    DatabaseSchema,
    DatabaseUploadResponse,
    TablePreviewResponse,
    WarehouseConnectRequest,
)

from app.services.aggregates import (
    list_aggregates,
    refresh_materialized_views,
    seed_aggregates_for_database,
)

from app.services.connection_pool import is_warehouse_url, normalize_warehouse_url

from app.services.object_storage import (
    storage_enabled,
    tenant_key,
    upload_bytes,
    upload_file,
)

from app.services.postgres_connector import (
    execute_postgres_query,
    extract_postgres_schema,
)

from app.services.query_executor import execute_query

from app.services.schema_extractor import extract_sqlite_schema

from app.services.sql_validator import SQLValidationError, validate_sql

router = APIRouter(prefix="/api/v1/databases", tags=["databases"])


def _quote_table(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _resolve_accessible_table(record: dict, user: dict, table_name: str) -> str:
    schema = filter_schema_by_tables(record["schema"], get_allowed_tables(user))
    by_lower = {t.name.lower(): t.name for t in schema.tables}
    key = table_name.strip().lower()
    if key not in by_lower:
        raise HTTPException(status_code=404, detail="Table not found or not accessible")
    return by_lower[key]


def _connect_warehouse(
    name: str,
    connection_url: str,
    user: dict,
    read_replica_url: str | None = None,
) -> DatabaseUploadResponse:

    settings = get_settings()

    company = get_company(user["company_id"])

    existing = list_databases(user["company_id"])

    check_database_quota(user["company_id"], company, len(existing))

    if not is_warehouse_url(connection_url):

        raise HTTPException(
            status_code=400,
            detail="Invalid warehouse URL. Supported: postgresql://, postgres://, redshift://, snowflake://",
        )

    source_type, _ = normalize_warehouse_url(connection_url)

    exec_url = connection_url

    if connection_url.lower().startswith("redshift://"):

        exec_url = "postgresql://" + connection_url[len("redshift://") :]

    if source_type == "snowflake":

        raise HTTPException(
            status_code=501,
            detail="Snowflake connector requires snowflake-connector-python. Use PostgreSQL or Redshift for now.",
        )

    try:

        schema = extract_postgres_schema(exec_url)

    except Exception as exc:

        raise HTTPException(
            status_code=400, detail=f"Could not connect to warehouse: {exc}"
        ) from exc

    if not schema.tables:

        raise HTTPException(
            status_code=400, detail="Warehouse contains no accessible public tables"
        )

    db_id = save_database(
        name,
        schema,
        company_id=user["company_id"],
        uploaded_by=user["id"],
        source_type=source_type,
        connection_url=exec_url,
        read_replica_url=read_replica_url,
    )

    seed_aggregates_for_database(db_id, user["company_id"], schema)

    if settings.use_read_replicas and exec_url:

        try:

            refresh_materialized_views(db_id, exec_url)

        except Exception:

            pass

    record = get_database(db_id)

    assert record is not None

    return DatabaseUploadResponse(
        id=uuid.UUID(db_id),
        filename=record["filename"],
        table_count=len(schema.tables),
        source_type=source_type,
        created_at=datetime.fromisoformat(record["created_at"]),
    )


@router.post("/upload", response_model=DatabaseUploadResponse)
async def upload_database(
    file: UploadFile = File(...),
    user: dict = Depends(require_company_data_user),
) -> DatabaseUploadResponse:

    settings = get_settings()

    if settings.enterprise_mode or not settings.allow_sqlite_uploads:

        raise HTTPException(
            status_code=403,
            detail="File uploads are disabled in enterprise mode. Connect a PostgreSQL or warehouse data source instead.",
        )

    if not user_can_upload(user):

        raise HTTPException(
            status_code=403, detail="Only company admins can upload databases"
        )

    company = get_company(user["company_id"])

    existing = list_databases(user["company_id"])

    check_database_quota(user["company_id"], company, len(existing))

    if not file.filename or not file.filename.lower().endswith(
        (".db", ".sqlite", ".sqlite3")
    ):

        raise HTTPException(
            status_code=400,
            detail="Only SQLite files (.db, .sqlite, .sqlite3) are supported",
        )

    content = await file.read()

    max_bytes = settings.max_upload_mb * 1024 * 1024

    if len(content) > max_bytes:

        raise HTTPException(
            status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit"
        )

    upload_dir = company_uploads_dir(user["company_id"])

    dest = upload_dir / f"{uuid.uuid4()}_{file.filename}"

    dest.write_bytes(content)

    if storage_enabled():

        upload_bytes(content, tenant_key(user["company_id"], dest.name))

    try:

        schema = extract_sqlite_schema(dest)

    except Exception as exc:

        dest.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400, detail=f"Could not read SQLite schema: {exc}"
        ) from exc

    if not schema.tables:

        dest.unlink(missing_ok=True)

        raise HTTPException(status_code=400, detail="Database contains no user tables")

    db_id = save_database(
        file.filename,
        schema,
        company_id=user["company_id"],
        uploaded_by=user["id"],
        file_path=dest,
        source_type="sqlite_file",
    )

    seed_aggregates_for_database(db_id, user["company_id"], schema)

    record = get_database(db_id)

    assert record is not None

    return DatabaseUploadResponse(
        id=uuid.UUID(db_id),
        filename=record["filename"],
        table_count=len(schema.tables),
        source_type="sqlite_file",
        created_at=datetime.fromisoformat(record["created_at"]),
    )


@router.post("/connect", response_model=DatabaseUploadResponse)
def connect_postgres(
    body: WarehouseConnectRequest,
    user: dict = Depends(require_company_data_user),
) -> DatabaseUploadResponse:

    if not user_can_upload(user):

        raise HTTPException(
            status_code=403, detail="Only company admins can connect databases"
        )

    return _connect_warehouse(
        body.name, body.connection_url, user, body.read_replica_url
    )


@router.get("", response_model=list[DatabaseListItem])
def get_databases(
    user: dict = Depends(require_company_data_user),
) -> list[DatabaseListItem]:

    items = list_databases(user["company_id"])

    return [
        DatabaseListItem(
            id=uuid.UUID(item["id"]),
            filename=item["filename"],
            table_count=item["table_count"],
            source_type=item["source_type"],
            dialect=item["dialect"],
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in items
    ]


@router.get("/{database_id}/schema", response_model=DatabaseSchema)
def get_schema(
    database_id: str, user: dict = Depends(require_company_data_user)
) -> DatabaseSchema:

    record = get_database(database_id)

    if not record:

        raise HTTPException(status_code=404, detail="Database not found")

    assert_database_access(user, record)

    schema = record["schema"]

    allowed = get_allowed_tables(user)

    return filter_schema_by_tables(schema, allowed)


@router.get(
    "/{database_id}/tables/{table_name}/preview", response_model=TablePreviewResponse
)
def preview_table(
    database_id: str,
    table_name: str,
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_company_data_user),
) -> TablePreviewResponse:
    if user.get("platform_role") not in ("company_admin", "employee"):
        raise HTTPException(
            status_code=403, detail="Table preview requires company membership"
        )

    record = get_database(database_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found")
    assert_database_access(user, record)

    actual_name = _resolve_accessible_table(record, user, table_name)
    dialect = record.get("dialect", "sqlite")
    sql = f"SELECT * FROM {_quote_table(actual_name)} LIMIT {limit}"
    try:
        validate_sql(sql, dialect=dialect)
    except SQLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    source_type = record.get("source_type", "sqlite_file")
    connection_url = record.get("connection_url")
    try:
        if source_type in ("postgres", "redshift") and connection_url:
            columns, rows, _elapsed = execute_postgres_query(
                connection_url,
                sql,
                limit,
                read_replica_url=record.get("read_replica_url"),
            )
        else:
            file_path = record.get("file_path")
            if not file_path:
                raise HTTPException(
                    status_code=400, detail="Database file not found on server"
                )
            columns, rows, _elapsed = execute_query(file_path, sql)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not load table data: {exc}"
        ) from exc

    return TablePreviewResponse(
        table=actual_name,
        columns=columns,
        rows=rows,
        row_count=len(rows),
        limit=limit,
    )


@router.delete("/{database_id}")
def remove_database(
    database_id: str, user: dict = Depends(require_company_data_user)
) -> dict:
    if not user_can_upload(user):
        raise HTTPException(
            status_code=403, detail="Only company admins can remove data sources"
        )
    try:
        delete_database(database_id, user["company_id"], user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "removed"}


@router.get("/{database_id}/aggregates")
def get_database_aggregates(
    database_id: str, user: dict = Depends(require_company_data_user)
) -> dict:

    record = get_database(database_id)

    if not record:

        raise HTTPException(status_code=404, detail="Database not found")

    assert_database_access(user, record)

    return {"aggregates": list_aggregates(database_id)}


@router.post("/{database_id}/aggregates/refresh")
def refresh_aggregates(
    database_id: str, user: dict = Depends(require_company_data_user)
) -> dict:

    if not user_can_upload(user):

        raise HTTPException(
            status_code=403, detail="Only company admins can refresh aggregates"
        )

    record = get_database(database_id)

    if not record or record["company_id"] != user["company_id"]:

        raise HTTPException(status_code=404, detail="Database not found")

    if not record.get("connection_url"):

        raise HTTPException(
            status_code=400, detail="Aggregates refresh requires a warehouse connection"
        )

    count = refresh_materialized_views(database_id, record["connection_url"])

    return {"refreshed": count}
