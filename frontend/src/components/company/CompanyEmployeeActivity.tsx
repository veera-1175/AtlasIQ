import { useMemo, useState } from "react";
import { ActivityItem, CompanyAnalytics, CompanyStats, EmployeeItem, exportCsv } from "../../api";
import { formatAuditAction } from "../../designations";
import DailyQueryChart from "./DailyQueryChart";

interface Props {
  activity: ActivityItem[];
  stats: CompanyStats | null;
  analytics: CompanyAnalytics | null;
  employees: EmployeeItem[];
  onViewEmployee?: (employeeId: string) => void;
  onRefresh: () => void;
}

type TypeFilter = "all" | "query" | "audit";
type StatusFilter = "all" | "success" | "failed";
type PeriodFilter = "all" | "today" | "7d" | "30d";

function inPeriod(iso: string, period: PeriodFilter): boolean {
  if (period === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

export default function CompanyEmployeeActivity({
  activity,
  stats,
  analytics,
  employees,
  onViewEmployee,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("7d");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const summary = analytics?.summary;

  const filtered = useMemo(() => {
    return activity.filter((a) => {
      if (!inPeriod(a.created_at, periodFilter)) return false;
      if (typeFilter === "query" && a.type !== "query") return false;
      if (typeFilter === "audit" && a.type !== "audit") return false;
      if (statusFilter === "success" && !a.success) return false;
      if (statusFilter === "failed" && a.success) return false;
      if (employeeFilter && a.user_id !== employeeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.summary.toLowerCase().includes(q) ||
        (a.user_name || "").toLowerCase().includes(q) ||
        (a.user_email || "").toLowerCase().includes(q) ||
        (a.employee_id || "").toLowerCase().includes(q) ||
        (a.department || "").toLowerCase().includes(q)
      );
    });
  }, [activity, search, typeFilter, statusFilter, periodFilter, employeeFilter]);

  const periodQueries = filtered.filter((a) => a.type === "query");
  const failedInView = periodQueries.filter((a) => !a.success).length;
  const uniqueEmployees = new Set(filtered.map((a) => a.user_id).filter(Boolean)).size;

  const topContributors = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; id: string }>();
    for (const a of filtered) {
      if (!a.user_id || a.type !== "query") continue;
      const cur = counts.get(a.user_id) || { name: a.user_name || a.user_email || "Unknown", count: 0, id: a.user_id };
      cur.count += 1;
      counts.set(a.user_id, cur);
    }
    return [...counts.values()].sort((x, y) => y.count - x.count).slice(0, 5);
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card">
          <p className="mono-label">Events in view</p>
          <p className="mt-2 text-3xl font-bold text-white">{filtered.length}</p>
          <p className="mt-1 text-xs text-ink-400">{uniqueEmployees} employees active</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">Queries (filtered)</p>
          <p className="mt-2 text-3xl font-bold text-white">{periodQueries.length}</p>
          <p className="mt-1 text-xs text-ink-400">{summary?.queries_today ?? 0} today company-wide</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">Failed</p>
          <p className="mt-2 text-3xl font-bold text-white">{failedInView}</p>
          <p className="mt-1 text-xs text-ink-400">In current filter</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">Success rate</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats ? `${stats.success_rate}%` : "—"}</p>
          <p className="mt-1 text-xs text-ink-400">All employee queries</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="panel p-8 lg:col-span-2">
          <p className="mono-label">Daily activity</p>
          <p className="mt-1 text-sm text-ink-500">Employee query volume · last 14 days</p>
          <div className="mt-6">
            <DailyQueryChart data={analytics?.daily_activity ?? []} />
          </div>
        </div>

        <div className="panel p-8">
          <p className="mono-label">Top contributors</p>
          <p className="mt-1 text-sm text-ink-500">Most queries in current filter</p>
          <ul className="mt-6 space-y-3">
            {topContributors.length === 0 ? (
              <li className="text-sm text-ink-500">No query activity in this period.</li>
            ) : (
              topContributors.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-ink-900 pb-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onViewEmployee?.(c.id)}
                      className="truncate text-left text-sm font-medium text-white hover:underline"
                    >
                      {i + 1}. {c.name}
                    </button>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-400">{c.count} queries</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="panel flex flex-wrap gap-3 p-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee, question, department…"
          className="input-ink min-w-[200px] flex-1 text-sm"
        />
        <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)} className="input-ink text-sm">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="input-ink text-sm">
          <option value="all">All types</option>
          <option value="query">Queries only</option>
          <option value="audit">Actions only</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="input-ink text-sm">
          <option value="all">All statuses</option>
          <option value="success">Successful</option>
          <option value="failed">Failed</option>
        </select>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="input-ink text-sm">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name || e.email}{e.employee_id ? ` (${e.employee_id})` : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRefresh} className="btn-ghost text-sm">Refresh</button>
        <button
          type="button"
          onClick={() => {
            const cols = ["created_at", "type", "user_name", "user_email", "employee_id", "department", "summary", "success", "execution_ms", "row_count"];
            exportCsv(
              cols,
              filtered.map((a) => ({
                created_at: a.created_at,
                type: a.type,
                user_name: a.user_name ?? "",
                user_email: a.user_email ?? "",
                employee_id: a.employee_id ?? "",
                department: a.department ?? "",
                summary: a.summary,
                success: a.success ? "yes" : "no",
                execution_ms: a.execution_ms ?? "",
                row_count: a.row_count ?? "",
              })),
              "employee-activity.csv",
            );
          }}
          className="btn-ghost text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Activity feed</p>
          <p className="mt-1 text-xs text-ink-500">
            {filtered.length} event{filtered.length === 1 ? "" : "s"} · queries and account actions from your team
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Time</th>
              <th className="mono-label px-6 py-4">Employee</th>
              <th className="mono-label px-6 py-4">Type</th>
              <th className="mono-label px-6 py-4">Activity</th>
              <th className="mono-label px-6 py-4">Metrics</th>
              <th className="mono-label px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-ink-500">
                  No activity matches your filters. Try widening the date range or clearing filters.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={`${a.type}-${a.id}`} className="border-b border-ink-900 hover:bg-ink-900/40">
                  <td className="px-6 py-4 font-mono text-xs text-ink-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {a.user_id && onViewEmployee ? (
                      <button type="button" onClick={() => onViewEmployee(a.user_id!)} className="text-left hover:underline">
                        <p className="font-medium text-white">{a.user_name || a.user_email || "—"}</p>
                        <p className="text-xs text-ink-500">{a.employee_id || a.department || "—"}</p>
                      </button>
                    ) : (
                      <>
                        <p className="text-ink-300">{a.user_name || a.user_email || "—"}</p>
                        <p className="text-xs text-ink-600">{a.employee_id || a.department || "—"}</p>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="tag text-[10px]">
                      {a.type === "query" ? "Query" : formatAuditAction(a.action)}
                    </span>
                  </td>
                  <td className="max-w-md px-6 py-4 text-ink-200">{a.summary}</td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-500 whitespace-nowrap">
                    {a.type === "query" ? (
                      <>
                        {a.row_count != null ? `${a.row_count} rows` : "—"}
                        {a.execution_ms != null && ` · ${a.execution_ms}ms`}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`tag ${a.success ? "border-white text-white" : "text-ink-600"}`}>
                      {a.success ? "OK" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
