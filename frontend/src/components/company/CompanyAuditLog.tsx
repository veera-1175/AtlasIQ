import { useMemo, useState } from "react";
import { AuditLogItem, exportCsv } from "../../api";
import { auditCategory, categoryBadgeClass, formatAuditDetails } from "../../auditUtils";
import { formatAuditAction } from "../../designations";

interface Props {
  audit: AuditLogItem[];
  onRefresh: () => void;
}

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

export default function CompanyAuditLog({ audit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = useMemo(() => [...new Set(audit.map((a) => a.action))].sort(), [audit]);

  const filtered = useMemo(() => {
    return audit.filter((a) => {
      if (!inPeriod(a.created_at, periodFilter)) return false;
      if (actionFilter && a.action !== actionFilter) return false;
      if (categoryFilter && auditCategory(a.action) !== categoryFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const details = formatAuditDetails(a.details).toLowerCase();
      return (
        a.action.toLowerCase().includes(q) ||
        formatAuditAction(a.action).toLowerCase().includes(q) ||
        (a.user_email || "").toLowerCase().includes(q) ||
        (a.user_name || "").toLowerCase().includes(q) ||
        details.includes(q)
      );
    });
  }, [audit, search, actionFilter, categoryFilter, periodFilter]);

  const todayCount = audit.filter((a) => inPeriod(a.created_at, "today")).length;
  const uniqueUsers = new Set(audit.map((a) => a.user_email).filter(Boolean)).size;
  const categories = ["Team", "Security", "Data", "Profile", "System"] as const;

  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of filtered) {
      const cat = auditCategory(a.action);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card">
          <p className="mono-label">Total events</p>
          <p className="mt-2 text-3xl font-bold text-white">{audit.length}</p>
          <p className="mt-1 text-xs text-ink-400">All time · company scope</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">Today</p>
          <p className="mt-2 text-3xl font-bold text-white">{todayCount}</p>
          <p className="mt-1 text-xs text-ink-400">Events logged today</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">In view</p>
          <p className="mt-2 text-3xl font-bold text-white">{filtered.length}</p>
          <p className="mt-1 text-xs text-ink-400">Matching filters</p>
        </div>
        <div className="kpi-card">
          <p className="mono-label">Contributors</p>
          <p className="mt-2 text-3xl font-bold text-white">{uniqueUsers}</p>
          <p className="mt-1 text-xs text-ink-400">Unique users in log</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            className={`panel p-4 text-left transition-colors ${
              categoryFilter === cat ? "border-white" : "hover:border-ink-500"
            }`}
          >
            <p className="mono-label text-[9px]">{cat}</p>
            <p className="mt-2 text-2xl font-bold text-white">{byCategory[cat] || 0}</p>
          </button>
        ))}
      </div>

      <div className="panel flex flex-wrap gap-3 p-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, user, details…"
          className="input-ink min-w-[200px] flex-1 text-sm"
        />
        <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)} className="input-ink text-sm">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-ink text-sm">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{formatAuditAction(a)}</option>
          ))}
        </select>
        <button type="button" onClick={onRefresh} className="btn-ghost text-sm">Refresh</button>
        <button
          type="button"
          onClick={() => {
            const cols = ["created_at", "action", "user_name", "user_email", "resource_type", "details"];
            exportCsv(
              cols,
              filtered.map((a) => ({
                created_at: a.created_at,
                action: a.action,
                user_name: a.user_name ?? "",
                user_email: a.user_email ?? "",
                resource_type: a.resource_type ?? "",
                details: formatAuditDetails(a.details),
              })),
              "audit-log.csv",
            );
          }}
          className="btn-ghost text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Compliance trail</p>
          <p className="mt-1 text-xs text-ink-500">
            Immutable record of admin actions, team changes, and data events within your organization
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Timestamp</th>
              <th className="mono-label px-6 py-4">Category</th>
              <th className="mono-label px-6 py-4">Action</th>
              <th className="mono-label px-6 py-4">User</th>
              <th className="mono-label px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-ink-500">
                  No audit events match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const cat = auditCategory(a.action);
                const details = formatAuditDetails(a.details);
                const isExpanded = expandedId === a.id;
                return (
                  <tr key={a.id} className="border-b border-ink-900 hover:bg-ink-900/40">
                    <td className="px-6 py-4 font-mono text-xs text-ink-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`tag text-[10px] ${categoryBadgeClass(cat)}`}>{cat}</span>
                    </td>
                    <td className="px-6 py-4 text-white">{formatAuditAction(a.action)}</td>
                    <td className="px-6 py-4">
                      <p className="text-ink-300">{a.user_name || a.user_email || "System"}</p>
                      {a.user_name && a.user_email && (
                        <p className="text-xs text-ink-600">{a.user_email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className={`max-w-xs text-left text-xs ${isExpanded ? "text-ink-200" : "truncate text-ink-500 hover:text-ink-300"}`}
                        title={details}
                      >
                        {details}
                      </button>
                      {a.resource_type && (
                        <p className="mt-1 font-mono text-[10px] text-ink-600">
                          {a.resource_type}{a.resource_id ? ` · ${a.resource_id.slice(0, 8)}…` : ""}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
