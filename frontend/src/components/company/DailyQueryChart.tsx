interface DailyPoint {
  date: string;
  query_count: number;
  successful: number;
}

export default function DailyQueryChart({ data, emptyLabel = "No query activity in the last 14 days." }: {
  data: DailyPoint[];
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <p className="text-sm text-ink-500">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.query_count), 1);
  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-2">
      {data.map((d) => {
        const height = Math.max((d.query_count / max) * 100, 4);
        const label = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const rate = d.query_count > 0 ? Math.round((d.successful / d.query_count) * 100) : 0;
        return (
          <div key={d.date} className="group flex flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-ink-500 opacity-0 transition-opacity group-hover:opacity-100">
              {d.query_count}
            </span>
            <div
              className="relative w-full overflow-hidden bg-ink-800 transition-all group-hover:bg-ink-700"
              style={{ height: `${height}%`, minHeight: d.query_count > 0 ? "10px" : "2px" }}
              title={`${d.query_count} queries · ${rate}% success`}
            >
              {d.query_count > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-white/90"
                  style={{ height: `${rate}%` }}
                />
              )}
            </div>
            <span className="font-mono text-[9px] text-ink-600">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
