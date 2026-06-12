import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    groq_api_key: str = ""
    llm_provider: str = "groq"
    llm_model: str = ""

    database_url: str = "sqlite:///./data/app.db"
    data_dir: Path = Path("./data")
    uploads_dir: Path = Path("./data/uploads")

    # Query execution limits (global defaults; per-company overrides in DB)
    max_query_rows: int = 50_000
    query_timeout_sec: int = 120
    max_upload_mb: int = 100
    async_query_threshold_sec: int = 15

    jwt_secret: str = "change-me-in-production"
    redis_url: str = ""
    rate_limit_per_hour: int = 200

    atlasiq_super_admin_email: str = "admin@atlasiq.io"
    atlasiq_super_admin_password: str = "AtlasIQ@2026"
    company_data_key: str = "change-company-data-key-in-production"

    # Enterprise mode — warehouse connectors only, no SQLite file uploads
    enterprise_mode: bool = False
    allow_sqlite_uploads: bool = True

    # Celery async query queue
    celery_broker_url: str = ""
    celery_result_backend: str = ""
    celery_task_soft_time_limit: int = 600
    celery_task_time_limit: int = 900

    # Schema sampling for LLM (large schemas)
    schema_max_tables_for_llm: int = 12
    schema_max_columns_per_table: int = 30

    # PostgreSQL connection pooling
    pg_pool_min_connections: int = 1
    pg_pool_max_connections: int = 20
    pg_pool_max_idle_sec: int = 300
    use_read_replicas: bool = True

    # Per-company quota defaults (overridable per company in DB)
    default_quota_queries_per_day: int = 5000
    default_quota_max_rows: int = 50_000
    default_quota_max_databases: int = 25
    default_quota_concurrent_jobs: int = 10

    # Object storage (S3-compatible — MinIO, AWS S3, etc.)
    object_storage_enabled: bool = False
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "atlasiq-data"
    s3_region: str = "us-east-1"

    # API workers (documented for horizontal scaling)
    uvicorn_workers: int = 4

    # Pre-built aggregates refresh
    aggregates_auto_refresh_hours: int = 24

    # Email (optional — in-app notifications always work without SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@atlasiq.io"
    smtp_use_tls: bool = True
    app_public_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    enable_report_scheduler: bool = True

    class Config:
        env_file = (".env", "../.env", "../../.env")
        extra = "ignore"


def _apply_hosting_defaults(settings: Settings) -> Settings:
    """Auto-configure public URL / CORS on free PaaS (Render, Railway, etc.)."""
    fly_app = os.environ.get("FLY_APP_NAME")
    public = (
        os.environ.get("RENDER_EXTERNAL_URL")
        or os.environ.get("RAILWAY_PUBLIC_DOMAIN")
        or (f"https://{fly_app}.fly.dev" if fly_app else None)
    )
    if public and not public.startswith("http"):
        public = f"https://{public}"
    if public:
        if settings.app_public_url.startswith("http://localhost"):
            object.__setattr__(settings, "app_public_url", public.rstrip("/"))
        if "localhost" in settings.cors_origins:
            object.__setattr__(settings, "cors_origins", public.rstrip("/"))
    return settings


@lru_cache
def get_settings() -> Settings:
    settings = _apply_hosting_defaults(Settings())
    if settings.enterprise_mode:
        settings.allow_sqlite_uploads = False
    if not settings.celery_broker_url and settings.redis_url:
        object.__setattr__(settings, "celery_broker_url", settings.redis_url)
    if not settings.celery_result_backend and settings.redis_url:
        object.__setattr__(settings, "celery_result_backend", settings.redis_url)
    return settings
