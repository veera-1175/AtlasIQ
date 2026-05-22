import { useCallback, useEffect, useState } from "react";
import {
  ActivityItem,
  AuditLogItem,
  EmployeeDetail,
  fetchEmployeeDetail,
  QueryHistoryItem,
} from "../../api";
import { formatAuditAction } from "../../designations";

interface Props {
  employeeId: string;
  onBack: () => void;
  onViewTable?: (tableName: string) => void;
}

export default function EmployeeDetailPage({ employeeId, onBack, onViewTable }: Props) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeDetail(employeeId);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employee");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <button type="button" onClick={onBack} className="btn-ghost text-sm">← Back to team</button>
        <div className="border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
          {error || "Employee not found"}
        </div>
      </div>
    );
  }

  const { employee, stats, queries, activity, audit } = detail;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="btn-ghost mb-4 text-sm">← Back to team</button>
          <p className="mono-label">Employee Profile</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{employee.full_name || employee.email}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`tag ${employee.is_active ? "border-white text-white" : "text-ink-600"}`}>
              {employee.is_active ? "Active" : "Inactive"}
            </span>
            {employee.designation && <span className="tag">{employee.designation}</span>}
            {employee.department && employee.department !== employee.designation && (
              <span className="tag">{employee.department}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="panel p-8 lg:col-span-1">
          <p className="mono-label">Account Details</p>
          <dl className="mt-6 space-y-4 text-sm">
            {[
              ["Email", employee.email],
              ["Employee ID", employee.employee_id],
              ["Designation", employee.designation],
              ...(employee.department && employee.department !== employee.designation
                ? [["Department", employee.department] as const]
                : []),
              ["Joined", employee.created_at ? new Date(employee.created_at).toLocaleDateString() : "—"],
              ["Last login", employee.last_login_at ? new Date(employee.last_login_at).toLocaleString() : "Never"],
            ].map(([label, value]) => (
              <div key={label as string} className="border-b border-ink-900 pb-3">
                <dt className="mono-label text-[9px]">{label}</dt>
                <dd className="mt-1 text-ink-200">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Queries", value: stats.total_queries },
              { label: "Successful", value: stats.successful_queries },
              { label: "Success Rate", value: `${stats.success_rate}%` },
              { label: "Avg Latency", value: `${stats.avg_latency_ms}ms` },
            ].map(({ label, value }) => (
              <div key={label} className="panel p-6">
                <p className="mono-label">{label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mono-label">Allowed Tables</p>
                <p className="mt-1 text-sm text-ink-500">
                  {(employee.allowed_tables || []).length} table{(employee.allowed_tables || []).length !== 1 ? "s" : ""} assigned · click to open in Schema Explorer
                </p>
              </div>
            </div>
            {(employee.allowed_tables || []).length === 0 ? (
              <p className="mt-4 text-sm text-ink-500">No tables assigned to this employee.</p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(employee.allowed_tables || []).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onViewTable?.(t)}
                    className="group flex items-center justify-between gap-2 border border-ink-700 bg-black px-4 py-3 text-left transition-colors hover:border-white hover:bg-ink-900"
                  >
                    <span className="truncate font-mono text-xs text-ink-200 group-hover:text-white">{t}</span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-600 group-hover:text-white">
                      View →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QuerySection queries={queries} />
      <ActivitySection activity={activity} />
      <AuditSection audit={audit} />
    </div>
  );
}

function QuerySection({ queries }: { queries: QueryHistoryItem[] }) {
  return (
    <div className="panel overflow-hidden">
      <p className="mono-label border-b border-ink-800 px-6 py-4">Query History</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className="mono-label px-6 py-4">Time</th>
            <th className="mono-label px-6 py-4">Question</th>
            <th className="mono-label px-6 py-4">Rows</th>
            <th className="mono-label px-6 py-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {queries.length === 0 && (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-ink-500">No queries yet.</td></tr>
          )}
          {queries.map((q) => (
            <tr key={q.id} className="border-b border-ink-900">
              <td className="px-6 py-4 text-ink-500">{new Date(q.created_at).toLocaleString()}</td>
              <td className="px-6 py-4 text-white">{q.question}</td>
              <td className="px-6 py-4 text-ink-400">{q.row_count ?? "—"}</td>
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
  );
}

function ActivitySection({ activity }: { activity: ActivityItem[] }) {
  return (
    <div className="panel overflow-hidden">
      <p className="mono-label border-b border-ink-800 px-6 py-4">Recent Activity</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className="mono-label px-6 py-4">Time</th>
            <th className="mono-label px-6 py-4">Type</th>
            <th className="mono-label px-6 py-4">Summary</th>
            <th className="mono-label px-6 py-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {activity.length === 0 && (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-ink-500">No activity recorded.</td></tr>
          )}
          {activity.map((a) => (
            <tr key={`${a.type}-${a.id}`} className="border-b border-ink-900">
              <td className="px-6 py-4 text-ink-500">{new Date(a.created_at).toLocaleString()}</td>
              <td className="px-6 py-4 text-ink-400">{a.type === "query" ? "Query" : "Action"}</td>
              <td className="px-6 py-4 text-white">{a.summary}</td>
              <td className="px-6 py-4">
                <span className={`tag ${a.success ? "border-white text-white" : "text-ink-600"}`}>
                  {a.success ? "OK" : "Failed"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditSection({ audit }: { audit: AuditLogItem[] }) {
  return (
    <div className="panel overflow-hidden">
      <p className="mono-label border-b border-ink-800 px-6 py-4">Audit Trail</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className="mono-label px-6 py-4">Time</th>
            <th className="mono-label px-6 py-4">Action</th>
            <th className="mono-label px-6 py-4">Details</th>
          </tr>
        </thead>
        <tbody>
          {audit.length === 0 && (
            <tr><td colSpan={3} className="px-6 py-8 text-center text-ink-500">No audit entries.</td></tr>
          )}
          {audit.map((a) => (
            <tr key={a.id} className="border-b border-ink-900">
              <td className="px-6 py-4 text-ink-500">{new Date(a.created_at).toLocaleString()}</td>
              <td className="px-6 py-4 text-white">{formatAuditAction(a.action)}</td>
              <td className="px-6 py-4 text-xs text-ink-500">{a.details || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
