import { PlatformAnalytics as Analytics } from "../../api";
import PlatformSectionHeader from "./PlatformSectionHeader";

function BarChart({ items, labelKey, valueKey }: { items: { [k: string]: string | number }[]; labelKey: string; valueKey: string }) {
  const max = Math.max(...items.map((i) => Number(i[valueKey])), 1);
  return (
    <div className="mt-6 space-y-4">
      {items.map((row) => {
        const val = Number(row[valueKey]);
        const pct = (val / max) * 100;
        return (
          <div key={String(row[labelKey])}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="capitalize text-ink-300">{String(row[labelKey]) || "Unspecified"}</span>
              <span className="font-mono text-white">{val}</span>
            </div>
            <div className="h-2 bg-ink-900">
              <div className="h-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PlatformAnalytics({ analytics }: { analytics: Analytics }) {
  return (
    <div className="animate-fade-in space-y-10">
      <PlatformSectionHeader
        label="Usage Intelligence"
        description="Aggregate metrics across all AtlasIQ client tenants. No client database content is included."
      />

      <div className="grid gap-px bg-ink-800 sm:grid-cols-3">
        <div className="stat-card">
          <p className="mono-label">Queries (7 days)</p>
          <p className="stat-value mt-4 text-4xl">{analytics.queries_last_7_days.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="mono-label">Industries</p>
          <p className="stat-value mt-4 text-4xl">{analytics.clients_by_industry.length}</p>
        </div>
        <div className="stat-card">
          <p className="mono-label">Plan tiers in use</p>
          <p className="stat-value mt-4 text-4xl">{analytics.clients_by_plan.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel-elevated p-8">
          <p className="mono-label">Clients by Industry</p>
          {analytics.clients_by_industry.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">No industry data yet.</p>
          ) : (
            <BarChart items={analytics.clients_by_industry} labelKey="industry" valueKey="count" />
          )}
        </div>
        <div className="panel-elevated p-8">
          <p className="mono-label">Clients by Plan Tier</p>
          {analytics.clients_by_plan.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">No plan data yet.</p>
          ) : (
            <BarChart items={analytics.clients_by_plan} labelKey="plan" valueKey="count" />
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Recently Onboarded Clients</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Company</th>
              <th className="mono-label px-6 py-4">Industry</th>
              <th className="mono-label px-6 py-4">Plan</th>
              <th className="mono-label px-6 py-4">Onboarded</th>
            </tr>
          </thead>
          <tbody>
            {analytics.recent_clients.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-ink-500">No clients yet.</td></tr>
            ) : (
              analytics.recent_clients.map((c) => (
                <tr key={`${c.name}-${c.created_at}`} className="border-b border-ink-900 hover:bg-ink-900/40">
                  <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                  <td className="px-6 py-4 text-ink-400">{c.industry || "—"}</td>
                  <td className="px-6 py-4 capitalize text-ink-400">{c.plan_tier || "—"}</td>
                  <td className="px-6 py-4 text-ink-500">{new Date(c.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
