import { useEffect, useMemo, useState } from "react";
import {
  ActivityItem,
  CompanyAnalytics,
  CompanyStats,
  fetchCompanyActivity,
  fetchCompanyAnalytics,
} from "../../api";
import { Page } from "../../roles";
import {
  IconBolt,
  IconChart,
  IconDatabase,
  IconGrid,
  IconHistory,
  IconQuery,
  IconReport,
  IconShield,
  IconSpark,
} from "../Icons";
import DailyQueryChart from "./DailyQueryChart";
import DashboardInfoModal, { DashboardInfo } from "./DashboardInfoModal";

interface Props {
  stats: CompanyStats | null;
  companyName?: string | null;
  onNavigate: (page: Page) => void;
  onViewEmployee?: (employeeId: string) => void;
}

function ClickableTile({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-tile text-left ${className}`}
    >
      {children}
    </button>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <ClickableTile onClick={onClick} className={`kpi-card w-full ${accent ? "border-white/20" : ""}`}>
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      <p className="mono-label mt-3 text-[9px] text-ink-600">Click for details</p>
    </ClickableTile>
  );
}

function healthScore(stats: CompanyStats | null, analytics: CompanyAnalytics | null): number {
  let score = 0;
  if ((stats?.database_count ?? 0) > 0) score += 25;
  if ((stats?.employee_count ?? 0) > 0) score += 25;
  const adoption = analytics?.summary.adoption_rate ?? 0;
  score += Math.round(Math.min(25, adoption * 0.25));
  const success = stats?.success_rate ?? analytics?.summary.success_rate ?? 0;
  score += Math.round(Math.min(25, success * 0.25));
  return Math.min(100, score);
}

function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Healthy";
  if (score >= 40) return "Growing";
  return "Needs attention";
}

const SHORTCUTS: { page: Page; title: string; desc: string; Icon: () => JSX.Element }[] = [
  { page: "analytics", title: "Query Studio", desc: "Run NL queries across company data", Icon: IconQuery },
  { page: "databases", title: "Data Sources", desc: "Upload SQLite or connect PostgreSQL", Icon: IconDatabase },
  { page: "admin-team", title: "Team & Access", desc: "Onboard employees and assign table permissions", Icon: IconShield },
  { page: "schema", title: "Schema Explorer", desc: "Browse tables, columns, and relationships", Icon: IconGrid },
  { page: "admin-activity", title: "Employee Activity", desc: "Live feed of queries and actions", Icon: IconHistory },
  { page: "admin-analytics", title: "Usage Analytics", desc: "Adoption, latency, and department trends", Icon: IconChart },
  { page: "reports", title: "Scheduled Reports", desc: "Automate recurring insights", Icon: IconReport },
  { page: "admin-audit", title: "Audit Log", desc: "Compliance trail for admin actions", Icon: IconBolt },
];

export default function CompanyAdminOverview({ stats, companyName, onNavigate, onViewEmployee }: Props) {
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<DashboardInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchCompanyAnalytics(), fetchCompanyActivity()])
      .then(([a, act]) => {
        if (cancelled) return;
        setAnalytics(a);
        setActivity(act);
      })
      .catch(() => {
        if (!cancelled) {
          setAnalytics(null);
          setActivity([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const summary = analytics?.summary;
  const score = healthScore(stats, analytics);
  const inactiveEmployees = Math.max((summary?.total_employees ?? stats?.employee_count ?? 0) - (summary?.active_employees ?? 0), 0);

  const insights = useMemo(() => {
    const items: { tone: "info" | "warn" | "ok"; text: string; action?: Page }[] = [];
    if ((stats?.database_count ?? 0) === 0) {
      items.push({ tone: "warn", text: "No data sources connected — upload a database to enable queries.", action: "databases" });
    }
    if ((stats?.employee_count ?? 0) === 0) {
      items.push({ tone: "warn", text: "No employees onboarded yet — create accounts under Team & Access.", action: "admin-team" });
    }
    if (inactiveEmployees > 0) {
      items.push({ tone: "info", text: `${inactiveEmployees} employee${inactiveEmployees > 1 ? "s have" : " has"} not run a query yet.`, action: "admin-team" });
    }
    if ((summary?.failed_queries ?? 0) > 0 && (summary?.success_rate ?? 100) < 90) {
      items.push({ tone: "warn", text: `${summary?.failed_queries} failed queries — review activity for troubleshooting.`, action: "admin-activity" });
    }
    if ((summary?.queries_today ?? 0) > 0) {
      items.push({ tone: "ok", text: `${summary?.queries_today} queries run today across your team.` });
    }
    if (items.length === 0) {
      items.push({ tone: "ok", text: "Your organization is set up and ready for analytics." });
    }
    return items.slice(0, 4);
  }, [stats, summary, inactiveEmployees]);

  const setupSteps = [
    { done: (stats?.database_count ?? 0) > 0, label: "Connect a data source", page: "databases" as Page },
    { done: (stats?.employee_count ?? 0) > 0, label: "Onboard your team", page: "admin-team" as Page },
    { done: (stats?.total_queries ?? 0) > 0, label: "Run your first query", page: "analytics" as Page },
    { done: (summary?.adoption_rate ?? 0) >= 50, label: "Reach 50% team adoption", page: "admin-analytics" as Page },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;

  const topDepartments = [...(analytics?.department_usage ?? [])]
    .sort((a, b) => b.query_count - a.query_count)
    .slice(0, 5);

  function showInfo(info: DashboardInfo) {
    setInfoModal(info);
  }

  const metricInfos = useMemo((): Record<string, DashboardInfo> => ({
    total_queries: {
      id: "total_queries",
      category: "Performance",
      title: "Total Queries",
      description: "All Query Studio runs for your organization — including company admin and employee accounts. Usage Analytics and the activity feed count employee queries only.",
      stats: [
        { label: "Current total", value: String(stats?.total_queries ?? summary?.total_employee_queries ?? 0) },
        { label: "Successful", value: String(stats?.successful_queries ?? summary?.successful_queries ?? 0) },
        { label: "Failed", value: String(summary?.failed_queries ?? 0) },
      ],
      action: { label: "Open Query Studio", page: "analytics" },
    },
    success_rate: {
      id: "success_rate",
      category: "Performance",
      title: "Success Rate",
      description: "Percentage of queries that completed successfully and returned results. A high rate means your team is getting reliable answers from their data.",
      stats: [
        { label: "Success rate", value: `${stats?.success_rate ?? summary?.success_rate ?? 0}%` },
        { label: "Avg latency", value: `${stats?.avg_latency_ms ?? summary?.avg_latency_ms ?? 0} ms` },
      ],
      action: { label: "View Activity", page: "admin-activity" },
    },
    avg_latency: {
      id: "avg_latency",
      category: "Performance",
      title: "Average Latency",
      description: "How long successful queries take to execute on average, measured in milliseconds. Lower is faster. This reflects database size, query complexity, and server load.",
      stats: [
        { label: "Avg response", value: `${stats?.avg_latency_ms ?? summary?.avg_latency_ms ?? 0} ms` },
        { label: "Avg rows returned", value: String(summary?.avg_rows_per_query ?? "—") },
      ],
      action: { label: "Usage Analytics", page: "admin-analytics" },
    },
    team_adoption: {
      id: "team_adoption",
      category: "Adoption",
      title: "Team Adoption",
      description: "The share of active employees who have run at least one query. Higher adoption means more of your team is using AtlasIQ for data insights.",
      stats: [
        { label: "Adoption rate", value: `${summary?.adoption_rate ?? 0}%` },
        { label: "Active employees", value: String(summary?.active_employees ?? 0) },
        { label: "Total employees", value: String(summary?.total_employees ?? stats?.employee_count ?? 0) },
        { label: "Inactive", value: String(inactiveEmployees) },
      ],
      action: { label: "Manage Team", page: "admin-team" },
    },
    employees: {
      id: "employees",
      category: "Organization",
      title: "Employees",
      description: "Active employee accounts in your company. Each employee can query data within their assigned table permissions.",
      stats: [
        { label: "Total employees", value: String(stats?.employee_count ?? summary?.total_employees ?? 0) },
        { label: "Active (queried)", value: String(summary?.active_employees ?? 0) },
      ],
      action: { label: "Team & Access", page: "admin-team" },
    },
    data_sources: {
      id: "data_sources",
      category: "Data",
      title: "Data Sources",
      description: "Connected databases available to your organization — uploaded SQLite files or live PostgreSQL/Redshift connections managed under Data Sources.",
      stats: [{ label: "Connected", value: String(stats?.database_count ?? 0) }],
      action: { label: "Data Sources", page: "databases" },
    },
    queries_today: {
      id: "queries_today",
      category: "Activity",
      title: "Queries Today",
      description: "Number of employee queries run since midnight (server time). A quick pulse on daily platform usage.",
      stats: [
        { label: "Today", value: String(summary?.queries_today ?? 0) },
        { label: "Last 7 days", value: String(summary?.queries_last_7_days ?? 0) },
      ],
      action: { label: "Employee Activity", page: "admin-activity" },
    },
    queries_week: {
      id: "queries_week",
      category: "Activity",
      title: "Last 7 Days",
      description: "Rolling weekly query volume from your team. Use this to spot usage trends and engagement patterns.",
      stats: [
        { label: "Last 7 days", value: String(summary?.queries_last_7_days ?? 0) },
        { label: "Last 30 days", value: String(summary?.queries_last_30_days ?? 0) },
      ],
      action: { label: "Usage Analytics", page: "admin-analytics" },
    },
    query_volume: {
      id: "query_volume",
      category: "Analytics",
      title: "Query Volume",
      description: "Daily employee query counts over the last 14 days. Bar height shows volume; the white fill inside each bar shows the success rate for that day.",
      stats: [
        { label: "Days charted", value: String(analytics?.daily_activity?.length ?? 0) },
        { label: "Queries today", value: String(summary?.queries_today ?? 0) },
      ],
      action: { label: "Full Analytics", page: "admin-analytics" },
    },
    platform_health: {
      id: "platform_health",
      category: "Health",
      title: "Platform Health",
      description: "An overall readiness score (0–100) based on four factors: connected data sources, onboarded team, team adoption, and query success rate.",
      bullets: [
        "Up to 25 pts — at least one database connected",
        "Up to 25 pts — at least one employee onboarded",
        "Up to 25 pts — team adoption percentage",
        "Up to 25 pts — query success rate",
      ],
      stats: [
        { label: "Score", value: `${score} — ${healthLabel(score)}` },
        { label: "Databases", value: String(stats?.database_count ?? 0) },
        { label: "Employees", value: String(stats?.employee_count ?? 0) },
        { label: "Adoption", value: `${summary?.adoption_rate ?? 0}%` },
      ],
    },
    setup_progress: {
      id: "setup_progress",
      category: "Onboarding",
      title: "Setup Progress",
      description: "A checklist to get your organization fully operational on AtlasIQ. Complete each step to maximize platform value.",
      stats: setupSteps.map((s) => ({
        label: s.label,
        value: s.done ? "Done" : "Pending",
      })),
      action: { label: "Continue Setup", page: setupSteps.find((s) => !s.done)?.page ?? "databases" },
    },
    smart_insights: {
      id: "smart_insights",
      category: "Insights",
      title: "Smart Insights",
      description: "Automated signals based on your current data — warnings about gaps, inactive users, or failed queries, plus positive usage highlights.",
      bullets: insights.map((i) => i.text),
    },
    department_leaderboard: {
      id: "department_leaderboard",
      category: "Teams",
      title: "Department Leaderboard",
      description: "Ranks departments by query volume. Shows headcount, total queries, and success rate so you can see which teams use analytics most.",
      stats: topDepartments.slice(0, 3).map((d, i) => ({
        label: `#${i + 1} ${d.department}`,
        value: `${d.query_count} queries · ${d.success_rate}% success`,
      })),
      action: { label: "Usage Analytics", page: "admin-analytics" },
    },
    live_activity: {
      id: "live_activity",
      category: "Activity",
      title: "Live Activity",
      description: "The most recent actions from your team — natural-language queries and system events — with employee name and timestamp.",
      stats: [
        { label: "Recent items", value: String(Math.min(activity.length, 6)) },
        { label: "Latest", value: activity[0] ? new Date(activity[0].created_at).toLocaleString() : "—" },
      ],
      action: { label: "View All Activity", page: "admin-activity" },
    },
    recent_queries: {
      id: "recent_queries",
      category: "Queries",
      title: "Recent Employee Queries",
      description: "Latest questions employees asked, with row counts, execution time, and success status. Useful for monitoring what your team is exploring.",
      stats: [
        { label: "Shown", value: String(Math.min(analytics?.recent_queries?.length ?? 0, 5)) },
        { label: "Success rate", value: `${summary?.success_rate ?? 0}%` },
      ],
      action: { label: "Full Query Log", page: "admin-activity" },
    },
  }), [stats, summary, analytics, score, inactiveEmployees, insights, setupSteps, topDepartments, activity]);

  return (
    <div className="animate-fade-in space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-800 pb-8">
        <div>
          <p className="mono-label">Company Command Center</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-white lg:text-5xl">
            {companyName || "Administration"} Overview
          </h2>
          <p className="section-desc mt-3 max-w-2xl">
            Real-time visibility into team adoption, query performance, data sources, and organizational health.
            Click any metric or panel to learn what it means.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate("analytics")} className="btn-ink">
            Open Query Studio
          </button>
          <button type="button" onClick={() => onNavigate("admin-team")} className="btn-ghost">
            Manage Team
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
        </div>
      )}

      <div className="grid gap-px bg-ink-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { key: "total_queries", label: "Total Queries", value: stats?.total_queries ?? summary?.total_employee_queries ?? 0, unit: "", hint: "All users" },
          { key: "success_rate", label: "Success Rate", value: stats?.success_rate ?? summary?.success_rate ?? 0, unit: "%" },
          { key: "avg_latency", label: "Avg Latency", value: stats?.avg_latency_ms ?? summary?.avg_latency_ms ?? 0, unit: "ms" },
          { key: "team_adoption", label: "Team Adoption", value: summary?.adoption_rate ?? 0, unit: "%", hint: "Employees only" },
        ].map((m) => (
          <ClickableTile
            key={m.key}
            onClick={() => showInfo(metricInfos[m.key])}
            className="stat-card w-full"
          >
            <p className="mono-label">{m.label}</p>
            {"hint" in m && m.hint && <p className="mt-1 text-[10px] text-ink-500">{m.hint}</p>}
            <p className="stat-value mt-4 text-5xl lg:text-6xl">
              {m.value}
              <span className="text-2xl font-normal text-ink-600">{m.unit}</span>
            </p>
            <p className="mono-label mt-4 text-[9px] text-ink-600">Click for details</p>
          </ClickableTile>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Employees" value={stats?.employee_count ?? summary?.total_employees ?? 0} hint={`${summary?.active_employees ?? 0} active this month`} onClick={() => showInfo(metricInfos.employees)} />
        <KpiCard label="Data Sources" value={stats?.database_count ?? 0} hint="Connected databases" onClick={() => showInfo(metricInfos.data_sources)} />
        <KpiCard label="Queries Today" value={summary?.queries_today ?? 0} hint="Employee activity today" accent onClick={() => showInfo(metricInfos.queries_today)} />
        <KpiCard label="Last 7 Days" value={summary?.queries_last_7_days ?? 0} hint={`${summary?.queries_last_30_days ?? 0} in last 30 days`} onClick={() => showInfo(metricInfos.queries_week)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <ClickableTile
          onClick={() => showInfo(metricInfos.query_volume)}
          className="panel-elevated w-full p-8 lg:col-span-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono-label">Query Volume</p>
              <p className="mt-1 text-sm text-ink-500">Daily employee queries · last 14 days</p>
            </div>
            <span className="mono-label text-[9px] text-ink-600">Click for details</span>
          </div>
          <div className="mt-8">
            <DailyQueryChart data={analytics?.daily_activity ?? []} />
          </div>
        </ClickableTile>

        <ClickableTile
          onClick={() => showInfo(metricInfos.platform_health)}
          className="panel-elevated flex w-full flex-col p-8 lg:col-span-4"
        >
          <p className="mono-label">Platform Health</p>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#262626" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${score * 2.64} 264`}
                />
              </svg>
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{score}</p>
                <p className="mono-label mt-1 text-[10px]">{healthLabel(score)}</p>
              </div>
            </div>
            <p className="mono-label mt-6 text-[9px] text-ink-600">Click for details</p>
          </div>
        </ClickableTile>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <ClickableTile onClick={() => showInfo(metricInfos.setup_progress)} className="panel w-full p-8 lg:col-span-5">
          <div className="flex items-center justify-between">
            <p className="mono-label">Setup Progress</p>
            <span className="font-mono text-sm text-ink-400">{setupDone}/{setupSteps.length}</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-ink-800">
            <div className="h-full bg-white transition-all" style={{ width: `${(setupDone / setupSteps.length) * 100}%` }} />
          </div>
          <ul className="mt-6 space-y-3">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 px-3 py-2.5">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold ${step.done ? "border-white bg-white text-black" : "border-ink-600 text-ink-500"}`}>
                  {step.done ? "✓" : "·"}
                </span>
                <span className={step.done ? "text-ink-300 line-through" : "text-white"}>{step.label}</span>
              </li>
            ))}
          </ul>
          <p className="mono-label mt-4 text-[9px] text-ink-600">Click for details</p>
        </ClickableTile>

        <ClickableTile onClick={() => showInfo(metricInfos.smart_insights)} className="panel w-full p-8 lg:col-span-7">
          <p className="mono-label">Smart Insights</p>
          <p className="mt-1 text-sm text-ink-500">Actionable signals for your organization</p>
          <ul className="mt-6 space-y-3">
            {insights.map((item, i) => (
              <li
                key={i}
                className={`flex items-start gap-3 border px-4 py-3 ${
                  item.tone === "warn" ? "border-ink-500 bg-ink-900/80" : item.tone === "ok" ? "border-ink-700 bg-black" : "border-ink-800 bg-ink-950"
                }`}
              >
                <IconSpark />
                <p className="text-sm text-ink-200">{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="mono-label mt-4 text-[9px] text-ink-600">Click for details</p>
        </ClickableTile>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ClickableTile onClick={() => showInfo(metricInfos.department_leaderboard)} className="panel w-full overflow-hidden text-left">
          <div className="border-b border-ink-800 px-6 py-4">
            <p className="mono-label">Department Leaderboard</p>
            <p className="mt-1 text-sm text-ink-500">Query volume by team · click for details</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-800 bg-ink-900/50">
              <tr>
                <th className="mono-label px-6 py-3">Department</th>
                <th className="mono-label px-6 py-3">Staff</th>
                <th className="mono-label px-6 py-3">Queries</th>
                <th className="mono-label px-6 py-3">Success</th>
              </tr>
            </thead>
            <tbody>
              {topDepartments.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-ink-500">No department data yet.</td></tr>
              )}
              {topDepartments.map((d, i) => (
                <tr key={d.department} className="border-b border-ink-900">
                  <td className="px-6 py-3">
                    <span className="mr-2 font-mono text-xs text-ink-600">#{i + 1}</span>
                    <span className="font-medium text-white">{d.department}</span>
                  </td>
                  <td className="px-6 py-3 text-ink-400">{d.employee_count}</td>
                  <td className="px-6 py-3 font-mono text-ink-300">{d.query_count}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 bg-ink-800">
                        <div className="h-full bg-white" style={{ width: `${Math.min(d.success_rate, 100)}%` }} />
                      </div>
                      <span className="font-mono text-xs text-ink-500">{d.success_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClickableTile>

        <ClickableTile onClick={() => showInfo(metricInfos.live_activity)} className="panel w-full overflow-hidden text-left">
          <div className="border-b border-ink-800 px-6 py-4">
            <p className="mono-label">Live Activity</p>
            <p className="mt-1 text-sm text-ink-500">Latest team actions · click for details</p>
          </div>
          <ul className="divide-y divide-ink-900">
            {activity.length === 0 && (
              <li className="px-6 py-8 text-center text-sm text-ink-500">No activity recorded yet.</li>
            )}
            {activity.slice(0, 6).map((a) => (
              <li key={`${a.type}-${a.id}`} className="flex items-start gap-4 px-6 py-4">
                <span className={`tag mt-0.5 shrink-0 ${a.success ? "border-white/40 text-white" : "text-ink-600"}`}>
                  {a.type === "query" ? "Query" : "Action"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{a.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    {a.user_id && onViewEmployee ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewEmployee(a.user_id!); }}
                        className="hover:text-white hover:underline"
                      >
                        {a.user_name || a.user_email}
                      </button>
                    ) : (
                      <span>{a.user_name || a.user_email || "System"}</span>
                    )}
                    <span>·</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ClickableTile>
      </div>

      <ClickableTile onClick={() => showInfo(metricInfos.recent_queries)} className="panel w-full overflow-hidden text-left">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Recent Employee Queries</p>
          <p className="mt-1 text-sm text-ink-500">Latest questions with performance metrics · click for details</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900/50">
            <tr>
              <th className="mono-label px-6 py-3">Employee</th>
              <th className="mono-label px-6 py-3">Question</th>
              <th className="mono-label px-6 py-3">Rows</th>
              <th className="mono-label px-6 py-3">Latency</th>
              <th className="mono-label px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(analytics?.recent_queries ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-ink-500">No employee queries yet.</td></tr>
            )}
            {(analytics?.recent_queries ?? []).slice(0, 5).map((q, i) => (
              <tr key={i} className="border-b border-ink-900">
                <td className="px-6 py-3 text-ink-400">
                  {q.user_id && onViewEmployee ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onViewEmployee(q.user_id!); }}
                      className="text-left hover:underline"
                    >
                      <p className="text-ink-200">{q.full_name}</p>
                      <p className="font-mono text-xs text-ink-600">{q.employee_id}</p>
                    </button>
                  ) : (
                    <>
                      <p className="text-ink-200">{q.full_name}</p>
                      <p className="font-mono text-xs text-ink-600">{q.employee_id}</p>
                    </>
                  )}
                </td>
                <td className="max-w-xs truncate px-6 py-3 text-white">{q.question}</td>
                <td className="px-6 py-3 font-mono text-xs text-ink-400">{q.row_count ?? "—"}</td>
                <td className="px-6 py-3 font-mono text-xs text-ink-400">{q.execution_ms != null ? `${q.execution_ms}ms` : "—"}</td>
                <td className="px-6 py-3">
                  <span className={`tag ${q.success ? "border-white text-white" : "text-ink-600"}`}>
                    {q.success ? "OK" : "Failed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClickableTile>

      <div>
        <p className="mono-label">Quick Actions</p>
        <p className="mt-1 text-sm text-ink-500">Click to learn more, or use the button in the popup to go there</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ page, title, desc, Icon }) => (
            <button
              key={page}
              type="button"
              onClick={() => showInfo({
                id: page,
                category: "Quick Action",
                title,
                description: desc,
                action: { label: `Open ${title}`, page },
              })}
              className="shortcut-card group"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center border border-ink-700 bg-black transition-colors group-hover:border-white">
                  <Icon />
                </span>
                <p className="mono-label">{title}</p>
              </div>
              <p className="mt-3 text-sm text-ink-400">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <DashboardInfoModal
        info={infoModal}
        onClose={() => setInfoModal(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
