import { QueryHistoryItem } from "../api";

interface QueryHistoryProps {
  items: QueryHistoryItem[];
  onRerun: (item: QueryHistoryItem) => void;
  onView: (id: string) => void;
}

export default function QueryHistory({ items, onRerun, onView }: QueryHistoryProps) {
  if (!items.length) {
    return (
      <div className="flex h-72 flex-col items-center justify-center border border-ink-800 bg-ink-950">
        <p className="mono-label">Empty</p>
        <p className="mt-3 text-lg font-semibold text-ink-400">No query history</p>
      </div>
    );
  }

  return (
    <div className="space-y-px bg-ink-800">
      {items.map((item) => (
        <div key={item.id} className="history-row flex items-start justify-between gap-6 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className={`h-1.5 w-1.5 ${item.success ? "bg-white" : "bg-ink-600"}`} />
              <p className="text-base font-medium text-white">{item.question}</p>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-600">
              {new Date(item.created_at).toLocaleString()}
              {item.row_count != null && ` · ${item.row_count} rows`}
              {item.execution_ms != null && ` · ${item.execution_ms}ms`}
            </p>
            {item.generated_sql && (
              <pre className="mt-4 overflow-x-auto border border-ink-900 bg-ink-950 p-4 font-mono text-xs text-ink-400">
                {item.generated_sql}
              </pre>
            )}
            {item.explanation && <p className="mt-3 text-sm text-ink-500">{item.explanation}</p>}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {item.success && (
              <button type="button" onClick={() => onView(item.id)} className="btn-ghost text-xs">View</button>
            )}
            <button type="button" onClick={() => onRerun(item)} className="btn-ghost text-xs">Re-run</button>
          </div>
        </div>
      ))}
    </div>
  );
}
