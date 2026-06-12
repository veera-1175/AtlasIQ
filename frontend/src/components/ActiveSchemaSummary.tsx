import { useMemo, useState } from "react";
import { DatabaseSchema } from "../api";

interface Props {
  schema: DatabaseSchema;
  loading?: boolean;
  focusTables?: string[];
  onFocusChange?: (tables: string[]) => void;
  focusDisabled?: boolean;
}

export default function ActiveSchemaSummary({
  schema,
  loading,
  focusTables = [],
  onFocusChange,
  focusDisabled,
}: Props) {
  const [search, setSearch] = useState("");
  const canFocus = Boolean(onFocusChange) && !focusDisabled;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schema.tables;
    return schema.tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [schema.tables, search]);

  function toggleFocus(tableName: string) {
    if (!canFocus || !onFocusChange) return;
    if (focusTables.includes(tableName)) {
      onFocusChange(focusTables.filter((t) => t !== tableName));
    } else {
      onFocusChange([...focusTables, tableName]);
    }
  }

  return (
    <div className="border border-ink-800 bg-black p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono-label">Active Schema</p>
          <p className="mt-3 text-4xl font-bold text-white">{schema.tables.length}</p>
          <p className="mt-1 text-sm text-ink-500">
            tables · {schema.dialect}
            {schema.relationships.length > 0 && ` · ${schema.relationships.length} relations`}
          </p>
          {canFocus && (
            <p className="mt-2 text-xs text-ink-500">
              {focusTables.length === 0
                ? "Click tables below to focus the query, or leave empty to auto-detect."
                : `${focusTables.length} focused — query scoped to selected tables`}
            </p>
          )}
        </div>
        {canFocus && focusTables.length > 0 && (
          <button
            type="button"
            onClick={() => onFocusChange?.([])}
            className="btn-ghost shrink-0 px-2 py-1 text-[10px]"
          >
            Clear focus
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tables…"
        className="input-ink mt-5 w-full text-sm"
      />

      <div className="mt-4 max-h-64 overflow-y-auto border border-ink-800 bg-ink-950">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin border-2 border-ink-700 border-t-white" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">No tables match your search.</p>
        ) : (
          <ul className="divide-y divide-ink-900">
            {filtered.map((table) => {
              const focused = focusTables.includes(table.name);
              return (
                <li key={table.name}>
                  <button
                    type="button"
                    disabled={!canFocus}
                    onClick={() => toggleFocus(table.name)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      canFocus ? "cursor-pointer hover:bg-ink-900/60" : ""
                    } ${focused ? "border-l-2 border-white bg-white/[0.06]" : "border-l-2 border-transparent"}`}
                  >
                    <span className={`truncate font-mono text-sm ${focused ? "text-white" : "text-ink-200"}`}>
                      {table.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      {focused ? "focused" : `${table.columns.length} cols`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {search && (
        <p className="mt-2 text-xs text-ink-600">
          Showing {filtered.length} of {schema.tables.length} tables
        </p>
      )}
    </div>
  );
}
