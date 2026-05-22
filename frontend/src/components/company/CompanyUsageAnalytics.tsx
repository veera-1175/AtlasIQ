import { CompanyAnalytics } from "../../api";
import DailyQueryChart from "./DailyQueryChart";

interface Props {
  analytics: CompanyAnalytics | null;
  onViewEmployee?: (employeeId: string) => void;
}

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="kpi-card">
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-300">{hint}</p>}
    </div>
  );
}

export default function CompanyUsageAnalytics({ analytics, onViewEmployee }: Props) {
  const s = analytics?.summary;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Employee Queries" value={s?.total_employee_queries ?? 0} hint="All time · employees only" />
        <KpiCard label="Success Rate" value={s ? `${s.success_rate}%` : "—"} hint={`${s?.failed_queries ?? 0} failed`} />
        <KpiCard label="Team Adoption" value={s ? `${s.adoption_rate}%` : "—"} hint={`${s?.active_employees ?? 0} of ${s?.total_employees ?? 0} active`} />
        <KpiCard label="Avg Response" value={s ? `${s.avg_latency_ms}ms` : "—"} hint={`~${s?.avg_rows_per_query ?? 0} rows per query`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Today" value={s?.queries_today ?? 0} hint="Queries run today" />
        <KpiCard label="Last 7 Days" value={s?.queries_last_7_days ?? 0} hint="Rolling weekly volume" />
        <KpiCard label="Last 30 Days" value={s?.queries_last_30_days ?? 0} hint="Monthly usage trend" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="panel p-8">
          <p className="mono-label">Query Volume</p>
          <p className="mt-1 text-sm text-ink-500">Daily employee queries · last 14 days</p>
          <div className="mt-8">
            <DailyQueryChart data={analytics?.daily_activity ?? []} />
          </div>
        </div>

        <div className="panel p-8">
          <p className="mono-label">Department Breakdown</p>
          <p className="mt-1 text-sm text-ink-500">Headcount, query volume, and success rate by team</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-ink-500">
                  <th className="mono-label pb-3 pr-4">Department</th>
                  <th className="mono-label pb-3 pr-4">Staff</th>
                  <th className="mono-label pb-3 pr-4">Queries</th>
                  <th className="mono-label pb-3">Success</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.department_usage ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-ink-500">No employees yet.</td></tr>
                )}
                {(analytics?.department_usage ?? []).map((d) => (
                  <tr key={d.department} className="border-b border-ink-900">
                    <td className="py-3 pr-4 font-medium text-white">{d.department}</td>
                    <td className="py-3 pr-4 text-ink-400">{d.employee_count}</td>
                    <td className="py-3 pr-4 text-ink-300">{d.query_count}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-16 bg-ink-800">
                          <div className="h-full bg-white" style={{ width: `${Math.min(d.success_rate, 100)}%` }} />
                        </div>
                        <span className="font-mono text-xs text-ink-400">{d.success_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Query Log</p>
          <p className="mt-1 text-sm text-ink-500">Recent employee queries with performance metrics</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Time</th>
              <th className="mono-label px-6 py-4">Employee</th>
              <th className="mono-label px-6 py-4">Question</th>
              <th className="mono-label px-6 py-4">Rows</th>
              <th className="mono-label px-6 py-4">Latency</th>
              <th className="mono-label px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {(analytics?.recent_queries ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-ink-500">No employee queries yet.</td></tr>
            )}
            {(analytics?.recent_queries ?? []).map((q, i) => (
              <tr key={i} className="border-b border-ink-900">
                <td className="px-6 py-4 text-ink-500">{new Date(q.created_at).toLocaleString()}</td>
                <td className="px-6 py-4 text-ink-400">
                  {q.user_id && onViewEmployee ? (
                    <button type="button" onClick={() => onViewEmployee(q.user_id!)} className="text-left hover:underline">
                      <p className="text-ink-300">{q.full_name}</p>
                      <p className="font-mono text-xs text-ink-600">{q.employee_id}{q.department ? ` · ${q.department}` : ""}</p>
                    </button>
                  ) : (
                    <>
                      <p className="text-ink-300">{q.full_name}</p>
                      <p className="font-mono text-xs text-ink-600">{q.employee_id}</p>
                    </>
                  )}
                </td>
                <td className="max-w-md px-6 py-4 text-white">{q.question}</td>
                <td className="px-6 py-4 text-ink-400">{q.row_count ?? "—"}</td>
                <td className="px-6 py-4 font-mono text-xs text-ink-400">{q.execution_ms != null ? `${q.execution_ms}ms` : "—"}</td>
                <td className="px-6 py-4">
                  <span className={`tag ${q.success ? "border-white text-white" : "text-ink-600"}`}>
                    {q.success ? "Success" : "Failed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
