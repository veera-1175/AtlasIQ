import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SchemaTableFocus } from "./components/SchemaPanel";
import {
  askQuestion, CompanyStats, DashboardStats, DatabaseItem, DatabaseSchema,
  deleteDatabase, fetchCompanyStats, fetchDatabases, fetchMe, fetchQueryHistory, fetchQueryQuota, fetchQueryResult,
  QueryQuota,
  refreshDatabaseAggregates,
  resolveTableDatabase,
  fetchPlatformFeatures, fetchReports, fetchSchema, fetchStats, getAuthToken, PlatformFeatures, QueryHistoryItem, QueryResult, ReportItem,
  setAuthToken, uploadDatabase, connectPostgres, UserProfile, exportCsv,
  fetchSavedQueries, fetchEmployeeQueryTemplates, createSavedQuery, deleteSavedQuery,
  updateEmployeeProfile, SavedQueryItem, QueryTemplateItem,
} from "./api";
import EmployeeOnboardingTour from "./components/employee/EmployeeOnboardingTour";
import CompanyAdminPanel from "./components/CompanyAdminPanel";
import CompanyAdminOverview from "./components/company/CompanyAdminOverview";
import CompanyAdminProfilePage from "./components/company/CompanyAdminProfilePage";
import EmployeeDetailPage from "./components/company/EmployeeDetailPage";
import EmployeeProfilePage from "./components/employee/EmployeeProfilePage";
import MyUsagePage from "./components/employee/MyUsagePage";
import EmployeeWorkspaceOverview from "./components/EmployeeWorkspaceOverview";
import DatabasesPage from "./components/company/DatabasesPage";
import LoginPage from "./components/LoginPage";
import QueryStudio, { QueryRunOptions } from "./components/QueryStudio";
import SuperAdminPortal from "./components/platform/SuperAdminPortal";
import QueryHistory from "./components/QueryHistory";
import CreateReportModal from "./components/CreateReportModal";
import ReportsPanel from "./components/ReportsPanel";
import NotificationBell from "./components/NotificationBell";
import Sidebar from "./components/Sidebar";
import SchemaPanel from "./components/SchemaPanel";
import { NotificationProvider, useNotification } from "./notification";
import { Page, defaultPage, isPageAllowed, pageTitle } from "./roles";
import { buildQuerySuggestions } from "./querySuggestions";
import { SECTION_IDS } from "./sections";

function AppContent({ onRegisterNavigate }: { onRegisterNavigate: (fn: (page: Page) => void) => void }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const schemaFocusNonceRef = useRef(0);
  const [schemaTableFocus, setSchemaTableFocus] = useState<SchemaTableFocus | null>(null);
  const isSuperAdmin = user?.platform_role === "super_admin";
  const isCompanyAdmin = user?.platform_role === "company_admin";
  const isEmployee = user?.platform_role === "employee";
  const canUpload = user?.can_upload === true;

  const navigateTo = useCallback((next: Page) => {
    if (!user || !isPageAllowed(user.platform_role, next)) return;
    if (next !== "admin-employee") setSelectedEmployeeId(null);
    if (next !== "schema") setSchemaTableFocus(null);
    setPage(next);
  }, [user]);

  useEffect(() => {
    onRegisterNavigate(navigateTo);
  }, [navigateTo, onRegisterNavigate]);

  function viewEmployee(employeeId: string) {
    if (!user || !isPageAllowed(user.platform_role, "admin-employee")) return;
    setSelectedEmployeeId(employeeId);
    setPage("admin-employee");
    notifySuccess("Employee profile opened", { page: "admin-employee" });
  }

  function backFromEmployee() {
    setSelectedEmployeeId(null);
    setPage("admin-team");
  }

  async function viewSchemaTable(tableName: string) {
    if (!user || !isPageAllowed(user.platform_role, "schema")) return;
    try {
      const match = await resolveTableDatabase(tableName);
      schemaFocusNonceRef.current += 1;
      setSelectedDb(match.database_id);
      setSchemaTableFocus({
        table: match.table_name,
        showData: true,
        nonce: schemaFocusNonceRef.current,
      });
      setPage("schema");
      notifySuccess(`Viewing data for "${match.table_name}"`);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not open table data");
    }
  }

  const [databases, setDatabases] = useState<DatabaseItem[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);

  const [question, setQuestion] = useState("");
  const [focusTables, setFocusTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryLoadingLabel, setQueryLoadingLabel] = useState("Processing");
  const [queryQuota, setQueryQuota] = useState<QueryQuota | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [clarification, setClarification] = useState("");
  const [pgUrl, setPgUrl] = useState("");
  const [pgReplicaUrl, setPgReplicaUrl] = useState("");
  const [pgName, setPgName] = useState("PostgreSQL DB");
  const [showPgForm, setShowPgForm] = useState(false);
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatures | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState({ databaseId: "", question: "" });
  const [savedQueries, setSavedQueries] = useState<SavedQueryItem[]>([]);
  const [queryTemplates, setQueryTemplates] = useState<QueryTemplateItem[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { notifySuccess, notifyError } = useNotification();

  useEffect(() => {
    fetchPlatformFeatures().then(setPlatformFeatures).catch(() => {});
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setAuthLoading(false); return; }
    fetchMe()
      .then((u) => {
        setUser(u);
        setPage(defaultPage(u.platform_role));
        localStorage.setItem("atlasiq_email", u.email);
        localStorage.setItem("atlasiq_role", u.platform_role);
      })
      .catch(() => setAuthToken(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!user || user.platform_role === "super_admin") return;
    try {
      const [dbs, hist, reps, st, quota] = await Promise.all([
        fetchDatabases(),
        fetchQueryHistory(),
        fetchReports(),
        fetchStats(),
        fetchQueryQuota().catch(() => null),
      ]);
      setDatabases(dbs);
      setHistory(hist);
      setReports(reps);
      setStats(st);
      setQueryQuota(quota);
      if (isCompanyAdmin) {
        setCompanyStats(await fetchCompanyStats());
      }
      if (isEmployee) {
        const [sq, qt] = await Promise.all([fetchSavedQueries(), fetchEmployeeQueryTemplates()]);
        setSavedQueries(sq);
        setQueryTemplates(qt);
      }
      const dbList = dbs as DatabaseItem[];
      if (dbList.length && !selectedDb) setSelectedDb(dbList[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [selectedDb, user, isCompanyAdmin, isEmployee]);

  useEffect(() => {
    if (!user) return;
    if (!isPageAllowed(user.platform_role, page)) {
      setPage(defaultPage(user.platform_role));
    }
  }, [user, page]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (isEmployee && user && !user.onboarding_completed) {
      setOnboardingOpen(true);
    }
  }, [isEmployee, user]);

  useEffect(() => {
    if (!selectedDb || !user || isSuperAdmin) return;
    setFocusTables([]);
    setSchemaLoading(true);
    fetchSchema(selectedDb)
      .then(setSchema)
      .catch(() => setSchema(null))
      .finally(() => setSchemaLoading(false));
  }, [selectedDb, user, isSuperAdmin]);

  const querySuggestions = useMemo(
    () => buildQuerySuggestions(schema, focusTables),
    [schema, focusTables],
  );

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setResult(null);
    setPage("overview");
    setError(null);
  }

  function handleLoginSuccess(u: UserProfile) {
    setPage(defaultPage(u.platform_role));
    setUser(u);
    setError(null);
    notifySuccess(`Signed in as ${u.email}`);
    fetchMe()
      .then((full) => {
        setUser(full);
        setPage(defaultPage(full.platform_role));
      })
      .catch(() => {});
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDatabase(file);
      await refresh();
      setSelectedDb(uploaded.id);
      notifySuccess(`"${uploaded.filename}" uploaded · ${uploaded.table_count} tables indexed`, {
        page: "databases",
        scrollTo: SECTION_IDS.databaseList,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      notifyError(message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemoveDatabase(databaseId: string, filename: string) {
    try {
      await deleteDatabase(databaseId);
      if (selectedDb === databaseId) setSelectedDb("");
      await refresh();
      notifySuccess(`"${filename}" disconnected and removed`, { page: "databases", scrollTo: SECTION_IDS.databaseList });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove data source";
      setError(message);
      notifyError(message);
      throw err;
    }
  }

  async function handleRefreshAggregates(databaseId: string) {
    try {
      const res = await refreshDatabaseAggregates(databaseId);
      notifySuccess(`Refreshed ${res.refreshed} aggregate view${res.refreshed === 1 ? "" : "s"}`, { page: "databases" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Aggregate refresh failed";
      notifyError(message);
      throw err;
    }
  }

  async function handlePgConnect() {
    setUploading(true);
    setError(null);
    try {
      const db = await connectPostgres(pgName, pgUrl, pgReplicaUrl || undefined);
      await refresh();
      setSelectedDb(db.id);
      setShowPgForm(false);
      setPgUrl("");
      setPgReplicaUrl("");
      notifySuccess(`"${db.filename}" connected · ${db.table_count} tables indexed`, {
        page: "databases",
        scrollTo: SECTION_IDS.databaseList,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      notifyError(message);
    } finally {
      setUploading(false);
    }
  }

  async function runQuery(opts: QueryRunOptions = {}) {
    if (!selectedDb || question.trim().length < 3 || loading) return;
    const retryId = result?.id && (opts.clarification || opts.skip_cost_check || opts.previous_error)
      ? result.id
      : undefined;
    setLoading(true);
    setQueryLoadingLabel("Processing");
    setError(null);
    try {
      const res = await askQuestion(selectedDb, question.trim(), {
        ...opts,
        retry_query_id: retryId,
        focus_tables: focusTables.length ? focusTables : undefined,
        onStatus: (status) => setQueryLoadingLabel(status === "queued" ? "Queued…" : "Running…"),
      });
      setResult(res);
      await refresh();
      if (res.success) {
        notifySuccess(`Query completed · ${res.row_count} rows in ${res.execution_ms}ms`, {
          page: "analytics",
          scrollTo: SECTION_IDS.queryResults,
        });
      } else if (res.clarification_needed) {
        notifySuccess("More detail needed — review the clarification below", {
          page: "analytics",
          scrollTo: SECTION_IDS.queryResults,
        });
      } else {
        notifyError(res.error || "Query could not be completed", {
          page: "analytics",
          scrollTo: SECTION_IDS.queryResults,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query failed";
      setError(message);
      notifyError(message, { page: "analytics", scrollTo: SECTION_IDS.queryResults });
    } finally {
      setLoading(false);
      setQueryLoadingLabel("Processing");
    }
  }

  async function handleViewHistory(id: string) {
    try {
      const res = await fetchQueryResult(id);
      setResult(res);
      setQuestion(res.question);
      notifySuccess("Past query loaded", { page: "analytics", scrollTo: SECTION_IDS.queryResults });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load result";
      setError(message);
      notifyError(message);
    }
  }

  function openReportModal(prefill?: { databaseId?: string; question?: string }) {
    setReportPrefill({
      databaseId: prefill?.databaseId || selectedDb || databases[0]?.id || "",
      question: prefill?.question ?? question,
    });
    setReportModalOpen(true);
  }

  async function handleReportCreated(reportName: string) {
    await refresh();
    notifySuccess(`Report "${reportName}" scheduled`, { page: "reports", scrollTo: SECTION_IDS.reportsList });
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (!user) return <LoginPage onSuccess={handleLoginSuccess} />;

  const headerTitle = pageTitle(page, user.company_name);

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar page={page} onNavigate={navigateTo} user={user} onLogout={handleLogout} />

      <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-ink-950">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid opacity-20" />

        <header className="shell-header-main relative">
          <div className="flex w-full items-center justify-between">
            <div>
              <p className="mono-label text-ink-100">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
              <h2 className="page-title mt-1">{headerTitle}</h2>
            </div>
            <div className="flex items-center gap-6">
              {stats && !isSuperAdmin && (
                <div className="hidden items-center gap-10 md:flex">
                  <div>
                    <p className="mono-label">Success</p>
                    <p className="mt-1 text-2xl font-bold text-white">{stats.success_rate}%</p>
                  </div>
                  <div className="h-10 w-px bg-ink-800" />
                  <div>
                    <p className="mono-label">Queries</p>
                    <p className="mt-1 text-2xl font-bold text-white">{stats.successful_queries ?? stats.total_queries}</p>
                  </div>
                </div>
              )}
              <NotificationBell onNavigate={navigateTo} />
            </div>
          </div>
        </header>

        <div className="relative px-10 py-10">
          {error && (
            <div className="mb-8 flex items-center justify-between border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
              {error}
              <button type="button" onClick={() => setError(null)} className="mono-label hover:text-white">Dismiss</button>
            </div>
          )}

          {isSuperAdmin && page.startsWith("platform-") && (
            <SuperAdminPortal section={page} onNavigate={navigateTo} />
          )}

          {page === "overview" && isCompanyAdmin && (
            <CompanyAdminOverview
              stats={companyStats}
              companyName={user.company_name}
              onNavigate={navigateTo}
              onViewEmployee={viewEmployee}
            />
          )}

          {page === "overview" && !isSuperAdmin && !isCompanyAdmin && user && (
            <EmployeeWorkspaceOverview
              stats={stats}
              history={history}
              user={user}
              databases={databases}
              onNavigate={navigateTo}
              onViewQuery={handleViewHistory}
              onRerunQuery={(item) => {
                setQuestion(item.question);
                setSelectedDb(item.database_id);
                setPage("analytics");
                runQuery();
              }}
              onOpenTable={viewSchemaTable}
              onTryQuestion={(q) => {
                setQuestion(q);
                setPage("analytics");
              }}
              onTryTemplate={(t) => {
                if (t.database_id) setSelectedDb(t.database_id);
                setQuestion(t.question);
                setPage("analytics");
              }}
            />
          )}

          {page === "databases" && isCompanyAdmin && (
            <DatabasesPage
              databases={databases}
              features={platformFeatures}
              canUpload={canUpload}
              uploading={uploading}
              showPgForm={showPgForm}
              pgName={pgName}
              pgUrl={pgUrl}
              pgReplicaUrl={pgReplicaUrl}
              onUpload={handleUpload}
              onPgConnect={handlePgConnect}
              onTogglePg={() => setShowPgForm(!showPgForm)}
              setPgName={setPgName}
              setPgUrl={setPgUrl}
              setPgReplicaUrl={setPgReplicaUrl}
              onRemove={handleRemoveDatabase}
              onRefreshAggregates={handleRefreshAggregates}
            />
          )}

          {(page === "admin-team" || page === "admin-activity" || page === "admin-analytics" || page === "admin-audit") && isCompanyAdmin && (
            <CompanyAdminPanel section={page} onViewEmployee={viewEmployee} />
          )}

          {page === "admin-employee" && isCompanyAdmin && selectedEmployeeId && (
            <EmployeeDetailPage
              employeeId={selectedEmployeeId}
              onBack={backFromEmployee}
              onViewTable={viewSchemaTable}
            />
          )}

          {page === "admin-profile" && isCompanyAdmin && user && (
            <CompanyAdminProfilePage
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                fetchMe().then(setUser).catch(() => {});
              }}
            />
          )}

          {page === "employee-profile" && isEmployee && user && (
            <EmployeeProfilePage
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                fetchMe().then(setUser).catch(() => {});
              }}
              onOpenTable={viewSchemaTable}
            />
          )}

          {page === "my-usage" && isEmployee && (
            <MyUsagePage
              onViewQuery={handleViewHistory}
              onRerunQuery={(item) => {
                setQuestion(item.question);
                setSelectedDb(item.database_id);
                setPage("analytics");
                runQuery();
              }}
            />
          )}

          {page === "analytics" && !isSuperAdmin && (
            <QueryStudio
              databases={databases}
              selectedDb={selectedDb}
              onSelectDatabase={setSelectedDb}
              canManageDataSources={canUpload}
              schema={schema}
              schemaLoading={schemaLoading}
              focusTables={focusTables}
              onFocusChange={setFocusTables}
              question={question}
              onQuestionChange={setQuestion}
              querySuggestions={querySuggestions}
              loading={loading}
              loadingLabel={queryLoadingLabel}
              llmConfigured={platformFeatures?.llm_configured !== false}
              queryQuota={queryQuota}
              onRunQuery={(opts) => { void runQuery(opts ?? {}); }}
              result={result}
              clarification={clarification}
              onClarificationChange={setClarification}
              onScheduleReport={(databaseId, q) => openReportModal({ databaseId, question: q })}
              onNotify={notifySuccess}
              savedQueries={isEmployee ? savedQueries : []}
              queryTemplates={isEmployee ? queryTemplates : []}
              onLoadQuestion={(databaseId, q) => {
                setSelectedDb(databaseId);
                setQuestion(q);
              }}
              onSaveQuery={isEmployee && selectedDb && question.trim() ? async () => {
                try {
                  const item = await createSavedQuery(selectedDb, question.trim());
                  setSavedQueries((prev) => [item, ...prev]);
                  notifySuccess("Question saved");
                } catch (e) {
                  notifyError(e instanceof Error ? e.message : "Failed to save question");
                }
              } : undefined}
              onDeleteSavedQuery={isEmployee ? async (id) => {
                try {
                  await deleteSavedQuery(id);
                  setSavedQueries((prev) => prev.filter((s) => s.id !== id));
                  notifySuccess("Saved question removed");
                } catch (e) {
                  notifyError(e instanceof Error ? e.message : "Failed to remove saved question");
                }
              } : undefined}
            />
          )}

          {page === "schema" && !isSuperAdmin && (
            <SchemaPanel
              schema={schema}
              loading={schemaLoading}
              databaseId={selectedDb}
              databases={databases}
              onSelectDatabase={setSelectedDb}
              canBrowseData
              canManageDataSources={canUpload}
              tableFocus={schemaTableFocus}
            />
          )}

          {page === "history" && !isSuperAdmin && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mono-label">Archive</p>
                  <h3 className="mt-2 text-3xl font-bold text-white">Query History</h3>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      exportCsv(
                        ["created_at", "user", "question", "success", "row_count", "execution_ms", "generated_sql"],
                        history.map((item) => ({
                          created_at: item.created_at,
                          user: item.user_name || item.user_email || "",
                          question: item.question,
                          success: item.success ? "yes" : "no",
                          row_count: item.row_count ?? "",
                          execution_ms: item.execution_ms ?? "",
                          generated_sql: item.generated_sql ?? "",
                        })),
                        isEmployee ? "my-query-history.csv" : "company-query-history.csv",
                      );
                      notifySuccess("Query history exported");
                    }}
                  >
                    Export CSV
                  </button>
                )}
              </div>
              <div className="mb-8" />
              <QueryHistory
                items={history}
                onRerun={(item) => { setQuestion(item.question); setSelectedDb(item.database_id); setPage("analytics"); runQuery(); }}
                onView={handleViewHistory}
              />
            </div>
          )}

          {page === "reports" && !isSuperAdmin && (
            <div>
              <p className="mono-label">Automation</p>
              <h3 className="mt-2 mb-8 text-3xl font-bold text-white">Scheduled Reports</h3>
              <ReportsPanel
                reports={reports}
                onCreate={() => openReportModal()}
                onRefresh={refresh}
                showRunActions
              />
            </div>
          )}

        </div>
      </main>

      {isEmployee && (
        <EmployeeOnboardingTour
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onNavigate={navigateTo}
          onComplete={() => {
            void updateEmployeeProfile({ complete_onboarding: true }).then(() => {
              setUser((u) => (u ? { ...u, onboarding_completed: true } : u));
            });
          }}
        />
      )}

      {!isSuperAdmin && (
        <CreateReportModal
          open={reportModalOpen}
          databases={databases}
          initialDatabaseId={reportPrefill.databaseId}
          initialQuestion={reportPrefill.question}
          onClose={() => setReportModalOpen(false)}
          onCreated={handleReportCreated}
        />
      )}
    </div>
  );
}

export default function App() {
  const navigateRef = useRef<(page: Page) => void>(() => {});

  return (
    <NotificationProvider navigateTo={(page) => navigateRef.current(page)}>
      <AppContent onRegisterNavigate={(fn) => { navigateRef.current = fn; }} />
    </NotificationProvider>
  );
}
