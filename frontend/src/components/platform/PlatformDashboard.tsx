import { CompanyItem, PlatformAnalytics, PlatformFeatures, PlatformStats } from "../../api";
import { Page } from "../../roles";
import { IconBolt, IconShield, IconSpark } from "../Icons";
import PlatformSectionHeader from "./PlatformSectionHeader";

interface Props {
  stats: PlatformStats;
  companies: CompanyItem[];
  analytics: PlatformAnalytics | null;
  features: PlatformFeatures | null;
  onNavigate: (page: Page) => void;
}

export default function PlatformDashboard({ stats, companies, analytics, features, onNavigate }: Props) {
  const activeCount = companies.filter((c) => c.is_active).length;
  const totalDbs = companies.reduce((s, c) => s + c.database_count, 0);
  const enterpriseCount = companies.filter((c) => c.plan_tier === "enterprise").length;

  const metrics = [
    { label: "Client Companies", value: stats.companies, sub: `${activeCount} active` },
    { label: "Company Admins", value: stats.company_admins, sub: "Portal managers" },
    { label: "End Users", value: stats.employees, sub: "Across all clients" },
    { label: "Platform Queries", value: stats.total_queries, sub: analytics ? `${analytics.queries_last_7_days} last 7d` : "All time" },
    { label: "Data Sources", value: totalDbs, sub: "Connected DBs" },
    { label: "Enterprise Plans", value: enterpriseCount, sub: "Top tier clients" },
  ];

  const workflow = [
    { n: "01", t: "Onboard Client", d: "Company profile & plan tier" },
    { n: "02", t: "Assign Admins", d: "One or more per client" },
    { n: "03", t: "Client Connects Data", d: "Warehouse or upload" },
    { n: "04", t: "Team Queries", d: "RBAC-scoped analytics" },
  ];

  const recent = [...companies]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="animate-fade-in space-y-10">
      <PlatformSectionHeader
        label="AtlasIQ Platform"
        description="Operate the multi-tenant intelligence platform. Onboard client companies, assign administrators, and monitor usage — without accessing client database contents."
        action={
          <button type="button" onClick={() => onNavigate("platform-clients")} className="btn-ink">
            Onboard Client
          </button>
        }
      />

      <div className="grid gap-px bg-ink-800 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((m, i) => (
          <div key={m.label} className="stat-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <p className="mono-label">{m.label}</p>
            <p className="stat-value mt-4 text-4xl lg:text-5xl">{m.value.toLocaleString()}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-300">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel-elevated lg:col-span-2 p-8">
          <p className="mono-label">Client Lifecycle</p>
          <h3 className="mt-2 text-2xl font-bold text-white">Standard onboarding workflow</h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((s, i) => (
              <div
                key={s.n}
                className="feature-card group relative p-5"
              >
                {i < workflow.length - 1 && (
                  <div className="absolute right-0 top-1/2 hidden h-px w-4 translate-x-full bg-ink-600 group-hover:bg-white lg:block" />
                )}
                <p className="font-mono text-xs text-ink-300 group-hover:text-white">{s.n}</p>
                <p className="mt-2 font-semibold text-white">{s.t}</p>
                <p className="mt-1 text-xs text-ink-200">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="section-desc mt-6">
            Super admins never query client data. Company admins own data sources, employees, and permissions.
          </p>
        </div>

        <div className="panel-elevated p-8">
          <p className="mono-label">Platform Health</p>
          <div className="mt-6 space-y-4">
            {[
              { ok: true, label: "API & metadata store" },
              { ok: features?.redis_enabled ?? false, label: "Redis (shared state)" },
              { ok: features?.async_queries_enabled ?? false, label: "Async query workers" },
              { ok: features?.encrypted_connections ?? false, label: "Encrypted connections" },
              { ok: !features?.enterprise_mode, label: features?.enterprise_mode ? "Enterprise mode ON" : "Simple mode (dev)" },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-3 border-b border-ink-900 pb-3 last:border-0">
                <span className={`h-2 w-2 ${ok ? "bg-white" : "bg-ink-700"}`} />
                <span className="text-sm text-ink-100">{label}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate("platform-analytics")} className="btn-ghost mt-6 w-full text-xs">
            View Analytics
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-8">
          <p className="mono-label">Governance</p>
          <div className="mt-6 space-y-5">
            {[
              { Icon: IconShield, t: "Tenant isolation", d: "Each client's data and users are fully separated" },
              { Icon: IconBolt, t: "Admin-only data access", d: "Only company admins connect databases" },
              { Icon: IconSpark, t: "Full audit trail", d: "Platform and per-company activity logging" },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="group flex gap-4 border-b border-ink-900 pb-5 last:border-0">
                <div className="text-ink-400 transition-colors group-hover:text-white"><Icon /></div>
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="mt-1 text-sm text-ink-200">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
            <p className="mono-label">Recent Clients</p>
            <button type="button" onClick={() => onNavigate("platform-clients")} className="btn-ghost px-3 py-1 text-[10px]">
              View all
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {recent.length === 0 ? (
                <tr><td className="px-6 py-8 text-ink-500">No clients onboarded yet.</td></tr>
              ) : (
                recent.map((c) => (
                  <tr key={c.id} className="border-b border-ink-900 hover:bg-ink-900/40">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-ink-600">{c.industry || "—"} · {c.plan_tier || "starter"}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-ink-500">
                      {c.employee_count} users · {c.database_count} DBs
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`tag ${c.is_active ? "border-white text-white" : ""}`}>
                        {c.is_active ? "Active" : "Off"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { page: "platform-clients" as Page, title: "Client Companies", desc: "Onboard & manage admins" },
          { page: "platform-analytics" as Page, title: "Analytics", desc: "Usage & plan distribution" },
          { page: "platform-audit" as Page, title: "Audit Log", desc: "Platform-wide events" },
        ].map(({ page, title, desc }) => (
          <button
            key={page}
            type="button"
            onClick={() => onNavigate(page)}
            className="panel group p-6 text-left transition-colors hover:border-white"
          >
            <p className="mono-label">{title}</p>
            <p className="mt-2 text-sm text-ink-400 group-hover:text-ink-200">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
