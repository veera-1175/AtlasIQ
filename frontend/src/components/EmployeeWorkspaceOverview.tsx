import { useEffect, useState } from "react";
import { DashboardStats, DatabaseItem, EmployeeWorkspaceHints, fetchEmployeeWorkspaceHints, QueryHistoryItem, QueryTemplateItem, UserProfile } from "../api";
import { Page } from "../roles";
import { IconDatabase, IconHistory, IconQuery, IconReport } from "./Icons";

const SHORTCUTS: { page: Page; title: string; desc: string; Icon: () => JSX.Element }[] = [
  { page: "analytics", title: "Query Studio", desc: "Ask questions in plain English", Icon: IconQuery },
  { page: "schema", title: "Schema Explorer", desc: "Browse tables you can access", Icon: IconDatabase },
  { page: "history", title: "Query History", desc: "Re-run and review past queries", Icon: IconHistory },
  { page: "reports", title: "Scheduled Reports", desc: "Automate recurring questions", Icon: IconReport },
];

interface Props {
  stats: DashboardStats | null;
  history: QueryHistoryItem[];
  user: UserProfile;
  databases: DatabaseItem[];
  onNavigate: (page: Page) => void;
  onViewQuery: (id: string) => void;
  onRerunQuery: (item: QueryHistoryItem) => void;
  onOpenTable: (tableName: string) => void;
  onTryQuestion?: (question: string) => void;
  onTryTemplate?: (template: QueryTemplateItem) => void;
}

export default function EmployeeWorkspaceOverview({
  stats,
  history,
  user,
  databases,
  onNavigate,
  onViewQuery,
  onRerunQuery,
  onOpenTable,
  onTryQuestion,
  onTryTemplate,
}: Props) {
  const allowedTables = user.allowed_tables ?? [];
  const recent = history.slice(0, 5);
  const [hints, setHints] = useState<EmployeeWorkspaceHints | null>(null);

  useEffect(() => {
    fetchEmployeeWorkspaceHints().then(setHints).catch(() => setHints(null));
  }, []);

  return (
    <div className="animate-fade-in space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-800 pb-8">
        <div>
          <p className="mono-label">Workspace</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-white lg:text-5xl">
            {user.company_name || "Your"} Overview
          </h2>
          <p className="section-desc mt-3 max-w-2xl">
            Same Query Studio tools as your company admin — scoped to the tables assigned to you.
          </p>
        </div>
        <button type="button" onClick={() => onNavigate("analytics")} className="btn-ink">
          Open Query Studio
        </button>
      </div>

      <div className="grid gap-px bg-ink-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Your Queries", value: stats?.total_queries ?? 0, hint: "All time" },
          { label: "Success Rate", value: `${stats?.success_rate ?? 0}%`, hint: "Your runs" },
          { label: "Avg Latency", value: `${stats?.avg_latency_ms ?? 0} ms`, hint: "Successful queries" },
          { label: "Tables Access", value: allowedTables.length, hint: `${databases.length} data source${databases.length === 1 ? "" : "s"}` },
        ].map((m) => (
          <div key={m.label} className="stat-card">
            <p className="mono-label">{m.label}</p>
            <p className="stat-value mt-4 text-5xl lg:text-6xl">{m.value}</p>
            <p className="mt-2 text-xs text-ink-500">{m.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SHORTCUTS.map(({ page, title, desc, Icon }) => (
          <button
            key={page}
            type="button"
            onClick={() => onNavigate(page)}
            className="dashboard-tile text-left"
          >
            <span className="nav-icon mb-4 inline-block text-ink-400">
              <Icon />
            </span>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-ink-500">{desc}</p>
          </button>
        ))}
      </div>

      {(hints?.suggested_questions?.length || hints?.query_templates?.length) ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {hints?.designation && hints.suggested_questions.length > 0 && (
            <div className="panel p-8">
              <p className="mono-label">Suggested for {hints.designation}</p>
              <p className="mt-1 text-sm text-ink-500">Role-based starter questions</p>
              <ul className="mt-6 space-y-2">
                {hints.suggested_questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => onTryQuestion?.(q)}
                      className="w-full border border-ink-800 bg-black px-4 py-3 text-left text-sm text-ink-200 hover:border-ink-500 hover:text-white"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hints?.query_templates && hints.query_templates.length > 0 && (
            <div className="panel p-8">
              <p className="mono-label">Team templates</p>
              <p className="mt-1 text-sm text-ink-500">Published by your company admin</p>
              <ul className="mt-6 space-y-2">
                {hints.query_templates.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onTryTemplate?.(t)}
                      className="w-full border border-ink-800 bg-black px-4 py-3 text-left hover:border-ink-500"
                    >
                      <p className="text-sm font-medium text-white">{t.title}</p>
                      <p className="mt-1 text-xs text-ink-500">{t.question}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="panel p-8">
          <p className="mono-label">Your Tables</p>
          <p className="mt-1 text-sm text-ink-500">Click a table to open it in Schema Explorer with data preview</p>
          {allowedTables.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">No tables assigned yet. Contact your company admin.</p>
          ) : (
            <div className="mt-6 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {allowedTables.map((table) => (
                <button
                  key={table}
                  type="button"
                  onClick={() => onOpenTable(table)}
                  className="tag border-ink-600 font-mono text-[11px] hover:border-white hover:text-white"
                >
                  {table}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-ink-800 px-6 py-4">
            <p className="mono-label">Recent Queries</p>
            <p className="mt-1 text-xs text-ink-500">Your latest Query Studio activity</p>
          </div>
          {recent.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-500">No queries yet — start in Query Studio.</p>
          ) : (
            <ul className="divide-y divide-ink-900">
              {recent.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.question}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink-600">
                      {new Date(item.created_at).toLocaleString()}
                      {item.row_count != null && ` · ${item.row_count} rows`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.success && (
                      <button type="button" onClick={() => onViewQuery(item.id)} className="btn-ghost text-xs">
                        View
                      </button>
                    )}
                    <button type="button" onClick={() => onRerunQuery(item)} className="btn-ghost text-xs">
                      Re-run
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div className="border-t border-ink-800 px-6 py-3">
              <button type="button" onClick={() => onNavigate("history")} className="btn-ghost text-xs">
                View full history
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
