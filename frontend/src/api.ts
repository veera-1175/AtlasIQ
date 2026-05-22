const API_BASE = "/api/v1";

let authToken: string | null = localStorage.getItem("atlasiq_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("atlasiq_token", token);
  else localStorage.removeItem("atlasiq_token");
}

export function getAuthToken() {
  return authToken;
}

function headers(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const err = await res.json();
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) return err.detail.map((d: { msg?: string }) => d.msg).join(", ");
    return fallback;
  } catch {
    return fallback;
  }
}

export interface DatabaseItem {
  id: string;
  filename: string;
  table_count: number;
  source_type: string;
  dialect: string;
  created_at: string;
}

export interface DatabaseSchema {
  tables: { name: string; columns: { name: string; type: string; is_primary_key: boolean }[]; sample_rows: Record<string, unknown>[] }[];
  relationships: { from_table: string; from_column: string; to_table: string; to_column: string }[];
  dialect: string;
}

export interface ChartSpec {
  type: "bar" | "line" | "pie" | "none";
  x_column: string | null;
  y_column: string | null;
  title: string | null;
}

export interface CostEstimate {
  estimated_rows: number;
  plan_summary: string;
  high_cost: boolean;
  warning: string | null;
}

export interface QueryResult {
  id: string;
  question: string;
  generated_sql: string | null;
  sql_breakdown: string | null;
  confidence: number | null;
  assumptions: string[];
  clarification_needed: boolean;
  clarification_message: string | null;
  success: boolean;
  error: string | null;
  execution_ms: number | null;
  row_count: number | null;
  columns: string[];
  rows: Record<string, unknown>[];
  explanation: string | null;
  trends: string[];
  chart: ChartSpec | null;
  cost_estimate: CostEstimate | null;
}

export interface QueryHistoryItem {
  id: string;
  database_id: string;
  question: string;
  generated_sql: string | null;
  success: boolean;
  row_count: number | null;
  execution_ms: number | null;
  explanation: string | null;
  user_email?: string | null;
  user_name?: string | null;
  created_at: string;
}

export interface ReportItem {
  id: string;
  database_id: string;
  name: string;
  question: string;
  schedule: string;
  last_run_at: string | null;
  last_status: string | null;
  last_result?: string | null;
  created_at: string;
}

export interface ReportRunItem {
  id: string;
  report_id: string;
  status: string;
  result_summary?: string | null;
  ran_at: string;
}

export interface SavedQueryItem {
  id: string;
  database_id: string;
  name?: string | null;
  question: string;
  created_at: string;
}

export interface QueryTemplateItem {
  id: string;
  title: string;
  question: string;
  database_id?: string | null;
  designation?: string | null;
  created_at: string;
}

export interface TableAccessRequest {
  id: string;
  user_id: string;
  user_email?: string | null;
  user_name?: string | null;
  table_names: string[];
  reason?: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
}

export interface EmployeeWorkspaceHints {
  designation?: string | null;
  suggested_tables: string[];
  suggested_questions: string[];
  query_templates: QueryTemplateItem[];
  available_tables: string[];
}

export interface AuthUser {
  access_token: string;
  email: string;
  platform_role: string;
  company_id?: string | null;
  company_name?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  platform_role: string;
  company_id?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  allowed_tables?: string[];
  can_upload?: boolean;
  avatar_url?: string | null;
  onboarding_completed?: boolean;
}

export interface CompanyProfileSection {
  id: string;
  name: string;
  is_active: boolean;
  industry?: string | null;
  plan_tier: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  address?: string | null;
  quota_queries_per_day?: number | null;
  quota_max_rows?: number | null;
  quota_max_databases?: number | null;
  created_at: string;
}

export interface CompanyAdminProfile {
  id: string;
  email: string;
  full_name?: string | null;
  platform_role: string;
  avatar_url?: string | null;
  last_login_at?: string | null;
  created_at: string;
  password_change_pending: boolean;
  company: CompanyProfileSection;
}

export interface CompanyAdminProfileUpdate {
  full_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  address?: string;
}

export interface PasswordChangeRequest {
  id: string;
  user_id: string;
  user_email?: string | null;
  user_name?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  requester_role?: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
}

export interface EmployeeProfile {
  id: string;
  email: string;
  full_name?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  department?: string | null;
  allowed_tables: string[];
  avatar_url?: string | null;
  last_login_at?: string | null;
  created_at: string;
  password_change_pending: boolean;
  company_name?: string | null;
  security_note?: string | null;
  onboarding_completed?: boolean;
  pending_table_access?: string[];
}

export interface EmployeeUsage {
  stats: DashboardStats;
  recent_queries: QueryHistoryItem[];
}

export interface DashboardStats {
  total_queries: number;
  successful_queries: number;
  success_rate: number;
  avg_latency_ms: number;
  database_count: number;
  table_count: number;
  satisfaction_rate: number;
}

export interface PlatformStats {
  companies: number;
  users: number;
  company_admins: number;
  employees: number;
  total_queries: number;
}

export interface CompanyItem {
  id: string;
  name: string;
  is_active: boolean;
  industry?: string | null;
  plan_tier?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  employee_count: number;
  admin_count: number;
  database_count: number;
  admin_email: string | null;
  created_at: string;
}

export interface CompanyCreatePayload {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  industry?: string;
  website?: string;
  address?: string;
  plan_tier?: "starter" | "professional" | "enterprise";
  notes?: string;
}

export interface CompanyAdminItem {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CompanyDetail extends CompanyItem {
  website?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  quota_queries_per_day?: number | null;
  quota_max_rows?: number | null;
  quota_max_databases?: number | null;
  quota_concurrent_jobs?: number | null;
  admins: CompanyAdminItem[];
}

export interface CompanyUpdatePayload {
  name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  industry?: string;
  website?: string;
  address?: string;
  plan_tier?: "starter" | "professional" | "enterprise";
  notes?: string;
}

export interface CompanyQuotaPayload {
  quota_queries_per_day?: number;
  quota_max_rows?: number;
  quota_max_databases?: number;
  quota_concurrent_jobs?: number;
}

export interface PlatformAnalytics {
  clients_by_industry: { industry: string; count: number }[];
  clients_by_plan: { plan: string; count: number }[];
  recent_clients: { name: string; industry: string; plan_tier: string; created_at: string }[];
  queries_last_7_days: number;
}

export interface CompanyAnalyticsSummary {
  total_employee_queries: number;
  successful_queries: number;
  failed_queries: number;
  success_rate: number;
  avg_latency_ms: number;
  avg_rows_per_query: number;
  active_employees: number;
  total_employees: number;
  adoption_rate: number;
  queries_today: number;
  queries_last_7_days: number;
  queries_last_30_days: number;
}

export interface CompanyAnalytics {
  summary: CompanyAnalyticsSummary;
  department_usage: { department: string; employee_count: number; query_count: number; success_rate: number }[];
  daily_activity: { date: string; query_count: number; successful: number }[];
  recent_queries: {
    user_id?: string;
    question: string;
    success: number | boolean;
    created_at: string;
    full_name: string;
    employee_id: string;
    department?: string;
    execution_ms?: number | null;
    row_count?: number | null;
  }[];
}

export interface ActivityItem {
  type: string;
  id: string;
  action: string;
  summary: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  employee_id?: string | null;
  department?: string | null;
  execution_ms?: number | null;
  row_count?: number | null;
  created_at: string;
  success: boolean;
}

export interface EmployeeItem {
  id: string;
  email: string;
  employee_id?: string | null;
  full_name: string | null;
  platform_role: string;
  designation: string | null;
  department?: string | null;
  allowed_tables: string[];
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  security_note?: string | null;
}

export interface EmployeeDetail {
  employee: EmployeeItem;
  stats: {
    total_queries: number;
    successful_queries: number;
    success_rate: number;
    avg_latency_ms: number;
    database_count: number;
  };
  queries: QueryHistoryItem[];
  activity: ActivityItem[];
  audit: AuditLogItem[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  company_name?: string | null;
  created_at: string;
}

export interface CompanyStats {
  total_queries: number;
  successful_queries: number;
  success_rate: number;
  avg_latency_ms: number;
  database_count: number;
  employee_count: number;
}

export interface DesignationList {
  designations: string[];
  table_hints: Record<string, string[]>;
  industry?: string | null;
}

export interface AskOptions {
  focus_tables?: string[];
  clarification?: string;
  previous_error?: string;
  previous_sql?: string;
  skip_cost_check?: boolean;
  async_mode?: boolean;
  retry_query_id?: string;
}

export interface PlatformFeatures {
  enterprise_mode: boolean;
  allow_sqlite_uploads: boolean;
  async_queries_enabled: boolean;
  redis_enabled: boolean;
  object_storage_enabled: boolean;
  schema_sampling: boolean;
  read_replicas: boolean;
  encrypted_connections: boolean;
  max_query_rows: number;
  max_upload_mb: number;
  llm_configured?: boolean;
}

export interface QueryQuota {
  queries_today: number;
  queries_limit: number;
  concurrent_jobs: number;
  concurrent_jobs_limit: number;
  max_rows_per_query: number;
  max_databases: number;
}

export interface DatabaseAggregate {
  id: string;
  name: string;
  description?: string | null;
  last_refreshed_at?: string | null;
}

export interface QueryJobResult {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  question: string;
  message?: string | null;
  result?: QueryResult;
  error?: string | null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Login failed"));
  return res.json();
}

export async function fetchMe(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: headers() });
  if (!res.ok) throw new Error("Session expired");
  return res.json();
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchDatabases(): Promise<DatabaseItem[]> {
  const res = await fetch(`${API_BASE}/databases`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load databases");
  return res.json();
}

export async function fetchSchema(databaseId: string): Promise<DatabaseSchema> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/schema`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load schema");
  return res.json();
}

export interface TablePreview {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  limit: number;
}

export async function fetchTablePreview(databaseId: string, tableName: string, limit = 100): Promise<TablePreview> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(
    `${API_BASE}/databases/${databaseId}/tables/${encodeURIComponent(tableName)}/preview?${params}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(await parseError(res, "Failed to load table data"));
  return res.json();
}

export async function uploadDatabase(file: File): Promise<DatabaseItem> {
  const form = new FormData();
  form.append("file", file);
  const h: HeadersInit = {};
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}/databases/upload`, { method: "POST", body: form, headers: h });
  if (!res.ok) throw new Error(await parseError(res, "Upload failed"));
  return res.json();
}

export async function fetchPlatformFeatures(): Promise<PlatformFeatures> {
  const res = await fetch(`${API_BASE}/config/features`);
  if (!res.ok) throw new Error("Failed to load platform features");
  return res.json();
}

export async function connectPostgres(name: string, connectionUrl: string, readReplicaUrl?: string): Promise<DatabaseItem> {
  const res = await fetch(`${API_BASE}/databases/connect`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      connection_url: connectionUrl,
      read_replica_url: readReplicaUrl || undefined,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Connection failed"));
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchQueryJob(jobId: string): Promise<QueryJobResult> {
  const res = await fetch(`${API_BASE}/query/jobs/${jobId}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load query job"));
  return res.json();
}

export async function askQuestion(
  databaseId: string,
  question: string,
  options: AskOptions & { onStatus?: (status: "queued" | "running") => void } = {},
): Promise<QueryResult> {
  const { onStatus, ...body } = options;
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ database_id: databaseId, question, ...body }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Query failed"));
  const data = await res.json();

  if (data.job_id && data.status) {
    onStatus?.("queued");
    for (let attempt = 0; attempt < 120; attempt++) {
      await sleep(attempt < 5 ? 1000 : 2000);
      onStatus?.("running");
      const job = await fetchQueryJob(data.job_id);
      if (job.status === "completed" && job.result) return job.result as QueryResult;
      if (job.status === "failed") throw new Error(job.error || "Async query failed");
    }
    throw new Error("Query timed out — check History later for results.");
  }

  return data;
}

export async function fetchQueryQuota(): Promise<QueryQuota> {
  const res = await fetch(`${API_BASE}/query/quota`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load query quota"));
  return res.json();
}

export async function fetchQueryHistory(limit = 200): Promise<QueryHistoryItem[]> {
  const res = await fetch(`${API_BASE}/query/history?limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function fetchQueryResult(queryId: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query/${queryId}/result`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load query result");
  return res.json();
}

export async function submitFeedback(queryId: string, feedback: 1 | -1): Promise<void> {
  const res = await fetch(`${API_BASE}/query/${queryId}/feedback`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to submit feedback"));
}

export async function fetchReports(): Promise<ReportItem[]> {
  const res = await fetch(`${API_BASE}/reports`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

export async function createReport(databaseId: string, name: string, question: string, schedule: "daily" | "weekly"): Promise<ReportItem> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ database_id: databaseId, name, question, schedule }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create report"));
  return res.json();
}

export async function updateReport(
  reportId: string,
  payload: { name?: string; question?: string; schedule?: "daily" | "weekly" },
): Promise<ReportItem> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update report"));
  return res.json();
}

export async function fetchAdminStats(): Promise<PlatformStats> {
  const res = await fetch(`${API_BASE}/admin/stats`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load platform stats"));
  const data = await res.json();
  return {
    companies: data.companies ?? 0,
    users: data.users ?? 0,
    company_admins: data.company_admins ?? 0,
    employees: data.employees ?? 0,
    total_queries: data.total_queries ?? 0,
  };
}

export async function fetchAdminAnalytics(): Promise<PlatformAnalytics> {
  const res = await fetch(`${API_BASE}/admin/analytics`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load platform analytics"));
  return res.json();
}

export async function fetchAdminCompanies(): Promise<CompanyItem[]> {
  const res = await fetch(`${API_BASE}/admin/companies`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load companies"));
  return res.json();
}

export async function fetchCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const res = await fetch(`${API_BASE}/admin/companies/${companyId}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load company"));
  return res.json();
}

export async function createCompany(payload: CompanyCreatePayload): Promise<CompanyDetail> {
  const res = await fetch(`${API_BASE}/admin/companies`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to onboard client"));
  return res.json();
}

export async function assignCompanyAdmin(companyId: string, email: string, password: string, fullName: string): Promise<CompanyAdminItem> {
  const res = await fetch(`${API_BASE}/admin/companies/${companyId}/admins`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to assign admin"));
  return res.json();
}

export async function deleteCompanyAdmin(companyId: string, adminId?: string): Promise<void> {
  const url = adminId
    ? `${API_BASE}/admin/companies/${companyId}/admins/${adminId}`
    : `${API_BASE}/admin/companies/${companyId}/admin`;
  const res = await fetch(url, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete company admin"));
}

export async function setCompanyStatus(companyId: string, isActive: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/companies/${companyId}/status?is_active=${isActive}`, {
    method: "PATCH",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update company"));
}

export async function updateCompany(companyId: string, payload: CompanyUpdatePayload): Promise<CompanyDetail> {
  const res = await fetch(`${API_BASE}/admin/companies/${companyId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update company"));
  return res.json();
}

export async function updateCompanyQuotas(companyId: string, payload: CompanyQuotaPayload): Promise<CompanyDetail> {
  const res = await fetch(`${API_BASE}/admin/companies/${companyId}/quotas`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update quotas"));
  return res.json();
}

export async function fetchAdminAudit(): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/admin/audit`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load audit log"));
  return res.json();
}

export async function fetchCompanyStats(): Promise<CompanyStats> {
  const res = await fetch(`${API_BASE}/company/stats`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load company stats"));
  return res.json();
}

export async function fetchCompanyEmployees(filters?: {
  department?: string;
  employee_id?: string;
  search?: string;
  includeInactive?: boolean;
}): Promise<EmployeeItem[]> {
  const params = new URLSearchParams();
  if (filters?.department) params.set("department", filters.department);
  if (filters?.employee_id) params.set("employee_id", filters.employee_id);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.includeInactive) params.set("include_inactive", "true");
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`${API_BASE}/company/employees${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load employees"));
  return res.json();
}

export async function fetchCompanyAnalytics(): Promise<CompanyAnalytics> {
  const res = await fetch(`${API_BASE}/company/analytics`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load analytics"));
  return res.json();
}

export async function fetchCompanyActivity(userId?: string, limit = 200): Promise<ActivityItem[]> {
  const qs = new URLSearchParams();
  if (userId) qs.set("user_id", userId);
  qs.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/company/activity?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load activity"));
  return res.json();
}

export async function fetchEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
  const res = await fetch(`${API_BASE}/company/employees/${employeeId}/detail`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load employee"));
  return res.json();
}

export async function createEmployee(
  email: string,
  password: string,
  fullName: string,
  employeeId: string,
  designation: string,
  allowedTables: string[],
): Promise<EmployeeItem> {
  const res = await fetch(`${API_BASE}/company/employees`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      employee_id: employeeId,
      designation,
      allowed_tables: allowedTables,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create employee"));
  return res.json();
}

export async function updateEmployee(
  id: string,
  data: {
    full_name?: string;
    employee_id?: string;
    designation?: string;
    allowed_tables?: string[];
    password?: string;
    is_active?: boolean;
    security_note?: string;
  },
): Promise<EmployeeItem> {
  const res = await fetch(`${API_BASE}/company/employees/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update employee"));
  return res.json();
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/company/employees/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to deactivate employee"));
}

export async function fetchCompanyTables(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/company/tables`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load database tables"));
  const data = await res.json();
  return data.tables as string[];
}

export async function resolveTableDatabase(tableName: string): Promise<{ database_id: string; table_name: string }> {
  const role = localStorage.getItem("atlasiq_role");
  const base =
    role === "employee"
      ? `${API_BASE}/employee/tables/${encodeURIComponent(tableName)}/database`
      : `${API_BASE}/company/tables/${encodeURIComponent(tableName)}/database`;
  const res = await fetch(base, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Table not found in any connected database"));
  return res.json();
}

export async function fetchCompanyDesignations(): Promise<DesignationList> {
  const res = await fetch(`${API_BASE}/company/designations`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load designations"));
  return res.json();
}

export async function fetchCompanyAudit(limit = 200): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/company/audit?limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load audit log"));
  return res.json();
}

export async function deleteDatabase(databaseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove data source"));
}

export async function fetchDatabaseAggregates(databaseId: string): Promise<DatabaseAggregate[]> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/aggregates`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load aggregates"));
  const data = await res.json();
  return data.aggregates as DatabaseAggregate[];
}

export async function refreshDatabaseAggregates(databaseId: string): Promise<{ refreshed: number }> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/aggregates/refresh`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to refresh aggregates"));
  return res.json();
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  message: string;
  link_page: string | null;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await fetch(`${API_BASE}/notifications`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load notifications"));
  return res.json();
}

export async function fetchNotificationSummary(): Promise<{ unread_count: number }> {
  const res = await fetch(`${API_BASE}/notifications/summary`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load notifications"));
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to mark notification read"));
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/read-all`, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to mark notifications read"));
}

export async function fetchAdminProfile(): Promise<CompanyAdminProfile> {
  const res = await fetch(`${API_BASE}/company/profile`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load profile"));
  return res.json();
}

export async function updateAdminProfile(payload: CompanyAdminProfileUpdate): Promise<CompanyAdminProfile> {
  const res = await fetch(`${API_BASE}/company/profile`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update profile"));
  return res.json();
}

export async function deleteAdminAvatar(): Promise<{ avatar_url: null }> {
  const res = await fetch(`${API_BASE}/company/profile/avatar`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove profile picture"));
  return res.json();
}

export async function uploadAdminAvatar(file: File): Promise<{ avatar_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const h: HeadersInit = {};
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}/company/profile/avatar`, {
    method: "POST",
    headers: h,
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to upload profile picture"));
  return res.json();
}

export async function requestAdminPasswordChange(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/company/profile/password-request`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to submit password change"));
}

export async function fetchPasswordRequests(status = "pending"): Promise<PasswordChangeRequest[]> {
  const res = await fetch(`${API_BASE}/admin/password-requests?status=${encodeURIComponent(status)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load password requests"));
  return res.json();
}

export async function approvePasswordRequest(requestId: string): Promise<PasswordChangeRequest> {
  const res = await fetch(`${API_BASE}/admin/password-requests/${requestId}/approve`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to approve request"));
  return res.json();
}

export async function rejectPasswordRequest(requestId: string, note?: string): Promise<PasswordChangeRequest> {
  const res = await fetch(`${API_BASE}/admin/password-requests/${requestId}/reject`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ note: note || null }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to reject request"));
  return res.json();
}

export async function fetchEmployeeProfile(): Promise<EmployeeProfile> {
  const res = await fetch(`${API_BASE}/employee/profile`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load profile"));
  return res.json();
}

export async function updateEmployeeProfile(payload: {
  full_name?: string;
  complete_onboarding?: boolean;
}): Promise<EmployeeProfile> {
  const res = await fetch(`${API_BASE}/employee/profile`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update profile"));
  return res.json();
}

export async function uploadEmployeeAvatar(file: File): Promise<{ avatar_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const h: HeadersInit = {};
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}/employee/profile/avatar`, { method: "POST", headers: h, body: form });
  if (!res.ok) throw new Error(await parseError(res, "Failed to upload profile picture"));
  return res.json();
}

export async function deleteEmployeeAvatar(): Promise<{ avatar_url: null }> {
  const res = await fetch(`${API_BASE}/employee/profile/avatar`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove profile picture"));
  return res.json();
}

export async function requestEmployeePasswordChange(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/employee/profile/password-request`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to submit password change"));
}

export async function fetchEmployeeUsage(limit = 100): Promise<EmployeeUsage> {
  const res = await fetch(`${API_BASE}/employee/usage?limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load usage"));
  return res.json();
}

export async function fetchCompanyEmployeePasswordRequests(status = "pending"): Promise<PasswordChangeRequest[]> {
  const res = await fetch(`${API_BASE}/company/password-requests?status=${encodeURIComponent(status)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load employee password requests"));
  return res.json();
}

export async function approveCompanyPasswordRequest(requestId: string): Promise<PasswordChangeRequest> {
  const res = await fetch(`${API_BASE}/company/password-requests/${requestId}/approve`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to approve request"));
  return res.json();
}

export async function rejectCompanyPasswordRequest(requestId: string, note?: string): Promise<PasswordChangeRequest> {
  const res = await fetch(`${API_BASE}/company/password-requests/${requestId}/reject`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ note: note || null }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to reject request"));
  return res.json();
}

export async function fetchEmployeeWorkspaceHints(): Promise<EmployeeWorkspaceHints> {
  const res = await fetch(`${API_BASE}/employee/workspace-hints`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load workspace hints"));
  return res.json();
}

export async function requestTableAccess(tableNames: string[], reason?: string): Promise<TableAccessRequest> {
  const res = await fetch(`${API_BASE}/employee/table-access-requests`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ table_names: tableNames, reason: reason || null }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to submit access request"));
  return res.json();
}

export async function fetchEmployeeTableAccessRequests(): Promise<TableAccessRequest[]> {
  const res = await fetch(`${API_BASE}/employee/table-access-requests`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load access requests"));
  return res.json();
}

export async function fetchSavedQueries(): Promise<SavedQueryItem[]> {
  const res = await fetch(`${API_BASE}/employee/saved-queries`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load saved queries"));
  return res.json();
}

export async function createSavedQuery(
  databaseId: string,
  question: string,
  name?: string,
): Promise<SavedQueryItem> {
  const res = await fetch(`${API_BASE}/employee/saved-queries`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ database_id: databaseId, question, name: name || null }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to save query"));
  return res.json();
}

export async function deleteSavedQuery(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/employee/saved-queries/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete saved query"));
}

export async function fetchEmployeeQueryTemplates(): Promise<QueryTemplateItem[]> {
  const res = await fetch(`${API_BASE}/employee/query-templates`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load query templates"));
  return res.json();
}

export async function fetchCompanyTableAccessRequests(status = "pending"): Promise<TableAccessRequest[]> {
  const res = await fetch(`${API_BASE}/company/table-access-requests?status=${encodeURIComponent(status)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load table access requests"));
  return res.json();
}

export async function approveTableAccessRequest(requestId: string): Promise<TableAccessRequest> {
  const res = await fetch(`${API_BASE}/company/table-access-requests/${requestId}/approve`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to approve request"));
  return res.json();
}

export async function rejectTableAccessRequest(requestId: string, note?: string): Promise<TableAccessRequest> {
  const res = await fetch(`${API_BASE}/company/table-access-requests/${requestId}/reject`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ note: note || null }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to reject request"));
  return res.json();
}

export async function fetchCompanyQueryTemplates(): Promise<QueryTemplateItem[]> {
  const res = await fetch(`${API_BASE}/company/query-templates`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load query templates"));
  return res.json();
}

export async function createCompanyQueryTemplate(data: {
  title: string;
  question: string;
  database_id?: string;
  designation?: string;
}): Promise<QueryTemplateItem> {
  const res = await fetch(`${API_BASE}/company/query-templates`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create template"));
  return res.json();
}

export async function deleteCompanyQueryTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/company/query-templates/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete template"));
}

export async function fetchReportRuns(reportId: string): Promise<ReportRunItem[]> {
  const res = await fetch(`${API_BASE}/reports/${reportId}/runs`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to load report runs"));
  return res.json();
}

export async function runReportNow(reportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/${reportId}/run`, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to run report"));
}

export async function deleteReport(reportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete report"));
}

export function exportCsv(columns: string[], rows: Record<string, unknown>[], filename = "results.csv") {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
