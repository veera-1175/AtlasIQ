from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import init_app_db
from app.core.redis_client import redis_available
from app.models.schemas import HealthResponse, PlatformFeatures
from app.routers import admin, auth, company, databases, employee, notifications, query, reports, stats
from app.services.object_storage import ensure_bucket, storage_enabled
from app.services.scheduler import start_scheduler, stop_scheduler

FEATURES = [
    "nl-to-sql",
    "sql-validation",
    "schema-extraction",
    "schema-sampling",
    "auto-charts",
    "trend-detection",
    "query-history",
    "error-correction",
    "postgres-connector",
    "redshift-connector",
    "read-replicas",
    "connection-pooling",
    "multi-tenant-rbac",
    "company-admin",
    "audit-logging",
    "rate-limiting",
    "query-caching",
    "cost-estimation",
    "scheduled-reports",
    "async-query-queue",
    "per-company-quotas",
    "encrypted-connections",
    "prebuilt-aggregates",
    "object-storage",
    "horizontal-scaling",
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_app_db()
    if storage_enabled():
        try:
            ensure_bucket()
        except Exception:
            pass
    if get_settings().enable_report_scheduler:
        start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="AtlasIQ",
    description="Natural Language to SQL Analytics Intelligence Platform",
    version="2.0.0",
    lifespan=lifespan,
)

def _cors_origins() -> list[str]:
    raw = get_settings().cors_origins.strip()
    if not raw:
        return ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(company.router)
app.include_router(employee.router)
app.include_router(databases.router)
app.include_router(query.router)
app.include_router(reports.router)
app.include_router(stats.router)
app.include_router(notifications.router)


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", features=FEATURES)


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/api/v1/config/features", response_model=PlatformFeatures)
def platform_features() -> PlatformFeatures:
    s = get_settings()
    llm_configured = bool(s.groq_api_key or s.openai_api_key)
    return PlatformFeatures(
        enterprise_mode=s.enterprise_mode,
        allow_sqlite_uploads=s.allow_sqlite_uploads and not s.enterprise_mode,
        async_queries_enabled=bool(s.celery_broker_url and redis_available()),
        redis_enabled=redis_available(),
        object_storage_enabled=storage_enabled(),
        schema_sampling=True,
        read_replicas=s.use_read_replicas,
        encrypted_connections=bool(s.company_data_key),
        max_query_rows=s.max_query_rows,
        max_upload_mb=s.max_upload_mb,
        llm_configured=llm_configured,
    )


def _mount_frontend() -> None:
    if not STATIC_DIR.is_dir():
        return
    assets = STATIC_DIR / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    def spa_root() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{path:path}")
    def spa_fallback(path: str) -> FileResponse:
        if path.startswith("api") or path.startswith("docs") or path.startswith("openapi"):
            raise HTTPException(status_code=404, detail="Not found")
        target = STATIC_DIR / path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")


_mount_frontend()
