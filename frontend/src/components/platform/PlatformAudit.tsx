import { useMemo, useState } from "react";
import { AuditLogItem } from "../../api";
import { formatAuditAction } from "../../designations";
import PlatformSectionHeader from "./PlatformSectionHeader";

export default function PlatformAudit({ audit }: { audit: AuditLogItem[] }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const actions = useMemo(() => [...new Set(audit.map((a) => a.action))].sort(), [audit]);

  const filtered = useMemo(() => {
    return audit.filter((a) => {
      if (filterAction && a.action !== filterAction) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.action.toLowerCase().includes(q) ||
        (a.company_name || "").toLowerCase().includes(q) ||
        (a.user_email || "").toLowerCase().includes(q)
      );
    });
  }, [audit, search, filterAction]);

  const todayCount = audit.filter((a) => {
    const d = new Date(a.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="animate-fade-in space-y-10">
      <PlatformSectionHeader
        label="Compliance"
        description="Immutable record of platform-level actions: client onboarding, admin assignments, and system events."
      />

      <div className="grid gap-px bg-ink-800 sm:grid-cols-3">
        <div className="stat-card">
          <p className="mono-label">Total Events</p>
          <p className="stat-value mt-4 text-4xl">{audit.length}</p>
        </div>
        <div className="stat-card">
          <p className="mono-label">Today</p>
          <p className="stat-value mt-4 text-4xl">{todayCount}</p>
        </div>
        <div className="stat-card">
          <p className="mono-label">Event Types</p>
          <p className="stat-value mt-4 text-4xl">{actions.length}</p>
        </div>
      </div>

      <div className="panel flex flex-wrap gap-4 p-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, company, user…"
          className="input-ink min-w-[200px] flex-1 text-sm"
        />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-ink text-sm">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{formatAuditAction(a)}</option>)}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Timestamp</th>
              <th className="mono-label px-6 py-4">Action</th>
              <th className="mono-label px-6 py-4">Company</th>
              <th className="mono-label px-6 py-4">User</th>
              <th className="mono-label px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-ink-500">No audit events match.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="border-b border-ink-900 hover:bg-ink-900/40">
                  <td className="px-6 py-4 font-mono text-xs text-ink-500">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-white">{formatAuditAction(a.action)}</td>
                  <td className="px-6 py-4 text-ink-400">{a.company_name || "—"}</td>
                  <td className="px-6 py-4 text-ink-400">{a.user_name || a.user_email || "—"}</td>
                  <td className="max-w-xs truncate px-6 py-4 text-xs text-ink-600">{a.details || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
