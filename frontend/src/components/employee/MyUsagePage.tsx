import { useCallback, useEffect, useMemo, useState } from "react";
import { EmployeeUsage, exportCsv, fetchEmployeeUsage, QueryHistoryItem } from "../../api";
import { useNotification } from "../../notification";

interface Props {
  onViewQuery: (id: string) => void;
  onRerunQuery: (item: QueryHistoryItem) => void;
}

export default function MyUsagePage({ onViewQuery, onRerunQuery }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const [data, setData] = useState<EmployeeUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchEmployeeUsage(200));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const items = data?.recent_queries ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        (item.generated_sql || "").toLowerCase().includes(q),
    );
  }, [data, search]);

  function handleExport() {
    const cols = ["created_at", "question", "success", "row_count", "execution_ms", "generated_sql"];
    exportCsv(
      cols,
      filtered.map((item) => ({
        created_at: item.created_at,
        question: item.question,
        success: item.success ? "yes" : "no",
        row_count: item.row_count ?? "",
        execution_ms: item.execution_ms ?? "",
        generated_sql: item.generated_sql ?? "",
      })),
      "my-query-history.csv",
    );
    notifySuccess("Query history exported");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-800 pb-8">
        <div>
          <p className="mono-label">Personal Analytics</p>
          <h3 className="mt-2 text-3xl font-bold text-white">My Usage</h3>
          <p className="section-desc mt-2">Your query activity, performance, and history across assigned data.</p>
        </div>
        <button type="button" onClick={load} className="btn-ghost text-sm">Refresh</button>
      </div>

      <div className="grid gap-px bg-ink-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Queries", value: stats?.total_queries ?? 0 },
          { label: "Success Rate", value: `${stats?.success_rate ?? 0}%` },
          { label: "Avg Latency", value: `${stats?.avg_latency_ms ?? 0} ms` },
          { label: "Data Sources", value: stats?.database_count ?? 0 },
        ].map((m) => (
          <div key={m.label} className="stat-card">
            <p className="mono-label">{m.label}</p>
            <p className="stat-value mt-4 text-4xl">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="panel flex flex-wrap gap-3 p-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions or SQL…"
          className="input-ink min-w-[200px] flex-1 text-sm"
        />
        <button type="button" onClick={handleExport} className="btn-ghost text-sm" disabled={filtered.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">Query history</p>
          <p className="mt-1 text-xs text-ink-500">{filtered.length} queries</p>
        </div>
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-500">No queries yet — start in Query Studio.</p>
        ) : (
          <ul className="divide-y divide-ink-900">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 ${item.success ? "bg-white" : "bg-ink-600"}`} />
                    <p className="font-medium text-white">{item.question}</p>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-ink-600">
                    {new Date(item.created_at).toLocaleString()}
                    {item.row_count != null && ` · ${item.row_count} rows`}
                    {item.execution_ms != null && ` · ${item.execution_ms}ms`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.success && (
                    <button type="button" onClick={() => onViewQuery(item.id)} className="btn-ghost text-xs">View</button>
                  )}
                  <button type="button" onClick={() => onRerunQuery(item)} className="btn-ghost text-xs">Re-run</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
