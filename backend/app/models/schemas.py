from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator



class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool = True
    is_primary_key: bool = False


class TableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo]
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)


class RelationshipInfo(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str


class DatabaseSchema(BaseModel):
    tables: list[TableInfo]
    relationships: list[RelationshipInfo] = Field(default_factory=list)
    dialect: str = "sqlite"


class TablePreviewResponse(BaseModel):
    table: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    limit: int


class DatabaseUploadResponse(BaseModel):
    id: UUID
    filename: str
    table_count: int
    source_type: str = "sqlite_file"
    created_at: datetime


class DatabaseListItem(BaseModel):
    id: UUID
    filename: str
    table_count: int
    source_type: str = "sqlite_file"
    dialect: str = "sqlite"
    created_at: datetime


class PostgresConnectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    connection_url: str = Field(..., min_length=10)
    read_replica_url: str | None = None


class WarehouseConnectRequest(PostgresConnectRequest):
    """Connect PostgreSQL, Redshift, or warehouse data source."""
    pass


class QueryRequest(BaseModel):
    database_id: UUID
    question: str = Field(..., min_length=3, max_length=2000)
    focus_tables: list[str] = Field(default_factory=list)
    clarification: str | None = None
    previous_error: str | None = None
    previous_sql: str | None = None
    skip_cost_check: bool = False
    async_mode: bool = False
    retry_query_id: UUID | None = None


class QueryJobResponse(BaseModel):
    job_id: UUID
    status: Literal["pending", "running", "completed", "failed"]
    question: str
    message: str | None = None
    result: "QueryResponse | None" = None
    error: str | None = None


class PlatformFeatures(BaseModel):
    enterprise_mode: bool
    allow_sqlite_uploads: bool
    async_queries_enabled: bool
    redis_enabled: bool
    object_storage_enabled: bool
    schema_sampling: bool
    read_replicas: bool
    encrypted_connections: bool
    max_query_rows: int
    max_upload_mb: int
    llm_configured: bool = False


class ChartSpec(BaseModel):
    type: Literal["bar", "line", "pie", "none"] = "none"
    x_column: str | None = None
    y_column: str | None = None
    title: str | None = None


class CostEstimate(BaseModel):
    estimated_rows: int = 0
    plan_summary: str = ""
    high_cost: bool = False
    warning: str | None = None


class QueryResponse(BaseModel):
    id: UUID
    question: str
    generated_sql: str | None = None
    sql_breakdown: str | None = None
    confidence: float | None = None
    assumptions: list[str] = Field(default_factory=list)
    clarification_needed: bool = False
    clarification_message: str | None = None
    success: bool
    error: str | None = None
    execution_ms: int | None = None
    row_count: int | None = None
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    explanation: str | None = None
    trends: list[str] = Field(default_factory=list)
    chart: ChartSpec | None = None
    cost_estimate: CostEstimate | None = None


class QueryHistoryItem(BaseModel):
    id: UUID
    database_id: UUID
    question: str
    generated_sql: str | None
    success: bool
    row_count: int | None
    execution_ms: int | None
    explanation: str | None = None
    user_email: str | None = None
    user_name: str | None = None
    created_at: datetime


class FeedbackRequest(BaseModel):
    feedback: int = Field(..., ge=-1, le=1)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    platform_role: str
    company_id: str | None = None
    company_name: str | None = None


class UserProfile(BaseModel):
    id: str
    email: str
    platform_role: str
    company_id: str | None = None
    company_name: str | None = None
    full_name: str | None = None
    employee_id: str | None = None
    designation: str | None = None
    allowed_tables: list[str] = Field(default_factory=list)
    can_upload: bool = False
    avatar_url: str | None = None
    onboarding_completed: bool = False


class CompanyProfileSection(BaseModel):
    id: str
    name: str
    is_active: bool
    industry: str | None = None
    plan_tier: str = "professional"
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website: str | None = None
    address: str | None = None
    quota_queries_per_day: int | None = None
    quota_max_rows: int | None = None
    quota_max_databases: int | None = None
    created_at: datetime


class CompanyAdminProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    platform_role: str
    avatar_url: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    password_change_pending: bool = False
    company: CompanyProfileSection


class CompanyAdminProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=300)
    address: str | None = Field(default=None, max_length=500)


class PasswordChangeRequestBody(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeRequestItem(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    user_name: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    requester_role: str | None = None
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    review_note: str | None = None


class EmployeeProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    complete_onboarding: bool | None = None


class EmployeeProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    employee_id: str | None = None
    designation: str | None = None
    department: str | None = None
    allowed_tables: list[str] = Field(default_factory=list)
    avatar_url: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    password_change_pending: bool = False
    company_name: str | None = None
    security_note: str | None = None
    onboarding_completed: bool = False
    pending_table_access: list[str] = Field(default_factory=list)


class EmployeeUsageResponse(BaseModel):
    stats: DashboardStats
    recent_queries: list[QueryHistoryItem] = Field(default_factory=list)


class PasswordChangeReviewBody(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class CompanyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    contact_name: str = Field(default="", max_length=200)
    contact_email: str = Field(default="", max_length=200)
    contact_phone: str = Field(default="", max_length=50)
    industry: str = Field(default="", max_length=100)
    website: str = Field(default="", max_length=300)
    address: str = Field(default="", max_length=500)
    plan_tier: Literal["starter", "professional", "enterprise"] = "professional"
    notes: str = Field(default="", max_length=2000)


class CompanyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=50)
    industry: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=300)
    address: str | None = Field(default=None, max_length=500)
    plan_tier: Literal["starter", "professional", "enterprise"] | None = None
    notes: str | None = Field(default=None, max_length=2000)


class CompanyQuotaUpdateRequest(BaseModel):
    quota_queries_per_day: int | None = Field(default=None, ge=1, le=1_000_000)
    quota_max_rows: int | None = Field(default=None, ge=100, le=10_000_000)
    quota_max_databases: int | None = Field(default=None, ge=1, le=1000)
    quota_concurrent_jobs: int | None = Field(default=None, ge=1, le=100)


class CompanyAdminCreateRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=200)


class EmployeeCreateRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=200)
    employee_id: str = Field(..., min_length=1, max_length=50)
    designation: str = Field(..., min_length=2, max_length=100)
    allowed_tables: list[str] = Field(default_factory=list)


class EmployeeUpdateRequest(BaseModel):
    full_name: str | None = None
    employee_id: str | None = Field(default=None, min_length=1, max_length=50)
    designation: str | None = None
    allowed_tables: list[str] | None = None
    password: str | None = Field(default=None, min_length=8)
    is_active: bool | None = None
    security_note: str | None = Field(default=None, max_length=500)

class DesignationListResponse(BaseModel):
    designations: list[str]
    table_hints: dict[str, list[str]]
    industry: str | None = None


class CompanyAdminListItem(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    is_active: bool = True
    created_at: datetime


class CompanyListItem(BaseModel):
    id: str
    name: str
    is_active: bool
    industry: str | None = None
    plan_tier: str = "professional"
    contact_name: str | None = None
    contact_email: str | None = None
    employee_count: int = 0
    admin_count: int = 0
    database_count: int = 0
    admin_email: str | None = None
    created_at: datetime


class CompanyDetailResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    industry: str | None = None
    website: str | None = None
    address: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    plan_tier: str = "professional"
    notes: str | None = None
    quota_queries_per_day: int | None = None
    quota_max_rows: int | None = None
    quota_max_databases: int | None = None
    quota_concurrent_jobs: int | None = None
    employee_count: int = 0
    admin_count: int = 0
    database_count: int = 0
    created_at: datetime
    admins: list[CompanyAdminListItem] = Field(default_factory=list)


class EmployeeListItem(BaseModel):
    id: str
    email: str
    employee_id: str | None = None
    full_name: str | None = None
    platform_role: str
    designation: str | None = None
    department: str | None = None
    allowed_tables: list[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime
    last_login_at: datetime | None = None
    security_note: str | None = None


class AuditLogItem(BaseModel):
    id: str
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    details: str | None = None
    user_email: str | None = None
    user_name: str | None = None
    company_name: str | None = None
    created_at: datetime


class PlatformStats(BaseModel):
    companies: int = 0
    users: int = 0
    company_admins: int = 0
    employees: int = 0
    total_queries: int = 0


class PlatformAnalytics(BaseModel):
    clients_by_industry: list[dict[str, Any]] = Field(default_factory=list)
    clients_by_plan: list[dict[str, Any]] = Field(default_factory=list)
    recent_clients: list[dict[str, Any]] = Field(default_factory=list)
    queries_last_7_days: int = 0


class CompanyAnalyticsSummary(BaseModel):
    total_employee_queries: int = 0
    successful_queries: int = 0
    failed_queries: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    avg_rows_per_query: float = 0.0
    active_employees: int = 0
    total_employees: int = 0
    adoption_rate: float = 0.0
    queries_today: int = 0
    queries_last_7_days: int = 0
    queries_last_30_days: int = 0


class CompanyAnalytics(BaseModel):
    summary: CompanyAnalyticsSummary
    department_usage: list[dict[str, Any]] = Field(default_factory=list)
    daily_activity: list[dict[str, Any]] = Field(default_factory=list)
    recent_queries: list[dict[str, Any]] = Field(default_factory=list)


class ActivityItem(BaseModel):
    type: str
    id: str
    action: str
    summary: str
    user_id: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    employee_id: str | None = None
    department: str | None = None
    execution_ms: int | None = None
    row_count: int | None = None
    created_at: str
    success: bool = True


class EmployeeDetailResponse(BaseModel):
    employee: EmployeeListItem
    stats: dict[str, Any]
    queries: list[QueryHistoryItem] = Field(default_factory=list)
    activity: list[ActivityItem] = Field(default_factory=list)
    audit: list[AuditLogItem] = Field(default_factory=list)


class DashboardStats(BaseModel):
    total_queries: int = 0
    successful_queries: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    database_count: int = 0
    table_count: int = 0
    satisfaction_rate: float = 0.0


class ReportCreateRequest(BaseModel):
    database_id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    question: str = Field(..., min_length=3)
    schedule: Literal["daily", "weekly"] = "weekly"


class ReportUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    question: str | None = Field(default=None, min_length=3)
    schedule: Literal["daily", "weekly"] | None = None


class ReportItem(BaseModel):
    id: UUID
    database_id: UUID
    name: str
    question: str
    schedule: str
    last_run_at: datetime | None = None
    last_status: str | None = None
    last_result: str | None = None
    created_at: datetime


class ReportRunItem(BaseModel):
    id: str
    report_id: str
    status: str
    result_summary: str | None = None
    ran_at: datetime


class SavedQueryItem(BaseModel):
    id: str
    database_id: str
    name: str | None = None
    question: str
    created_at: datetime


class SavedQueryCreate(BaseModel):
    database_id: UUID
    question: str = Field(..., min_length=3)
    name: str | None = Field(default=None, max_length=200)


class QueryTemplateItem(BaseModel):
    id: str
    title: str
    question: str
    database_id: str | None = None
    designation: str | None = None
    created_at: datetime


class QueryTemplateCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    question: str = Field(..., min_length=3)
    database_id: UUID | None = None
    designation: str | None = Field(default=None, max_length=100)


class TableAccessRequestCreate(BaseModel):
    table_names: list[str] = Field(..., min_length=1)
    reason: str | None = Field(default=None, max_length=500)


class TableAccessRequestItem(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    user_name: str | None = None
    table_names: list[str] = Field(default_factory=list)
    reason: str | None = None
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    review_note: str | None = None


class EmployeeWorkspaceHints(BaseModel):
    designation: str | None = None
    suggested_tables: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
    query_templates: list[QueryTemplateItem] = Field(default_factory=list)
    available_tables: list[str] = Field(default_factory=list)


class NotificationItem(BaseModel):
    id: str
    kind: str
    title: str
    message: str
    link_page: str | None = None
    is_read: bool
    created_at: datetime


class NotificationSummary(BaseModel):
    unread_count: int


class HealthResponse(BaseModel):
    status: str
    version: str = "2.0.0"
    features: list[str] = Field(default_factory=list)


QueryJobResponse.model_rebuild()
