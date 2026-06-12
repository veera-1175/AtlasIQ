interface ResultsTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
}

export default function ResultsTable({ columns, rows }: ResultsTableProps) {
  if (!columns.length) return null;

  return (
    <div className="overflow-hidden border border-ink-800">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-ink-800 bg-ink-950">
              {columns.map((col) => (
                <th key={col} className="mono-label px-6 py-4 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="table-row">
                {columns.map((col) => (
                  <td key={col} className="px-6 py-4 font-mono text-sm text-ink-200">
                    {String(row[col] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
