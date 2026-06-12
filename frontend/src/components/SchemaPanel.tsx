import { useEffect, useMemo, useRef, useState } from "react";
import { DatabaseItem, DatabaseSchema, fetchTablePreview, TablePreview } from "../api";
import { SECTION_IDS } from "../sections";
import ResultsTable from "./ResultsTable";

export interface SchemaTableFocus {
  table: string;
  showData: boolean;
  nonce: number;
}

interface SchemaPanelProps {
  schema: DatabaseSchema | null;
  loading: boolean;
  databaseId: string;
  databases: DatabaseItem[];
  onSelectDatabase: (id: string) => void;
  canBrowseData: boolean;
  canManageDataSources?: boolean;
  tableFocus?: SchemaTableFocus | null;
}

export default function SchemaPanel({
  schema,
  loading,
  databaseId,
  databases,
  onSelectDatabase,
  canBrowseData,
  canManageDataSources = false,
  tableFocus,
}: SchemaPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const dataRef = useRef<HTMLDivElement>(null);
  const skipDataResetRef = useRef(false);
  const appliedFocusNonceRef = useRef(0);

  const filteredTables = useMemo(() => {
    if (!schema?.tables.length) return [];
    const q = search.trim().toLowerCase();
    const tables = [...schema.tables].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [schema, search]);

  const table = schema?.tables.find((t) => t.name === selectedTable);
  const relatedKeys = schema?.relationships.filter(
    (r) => r.from_table === selectedTable || r.to_table === selectedTable,
  ) ?? [];

  useEffect(() => {
    setSearch("");
    setSelectedTable(null);
    setShowData(false);
    setPreview(null);
    appliedFocusNonceRef.current = 0;
  }, [databaseId]);

  useEffect(() => {
    if (skipDataResetRef.current) {
      skipDataResetRef.current = false;
      return;
    }
    setShowData(false);
    setPreview(null);
    setPreviewError(null);
  }, [selectedTable]);

  useEffect(() => {
    if (!tableFocus?.table || !schema?.tables.length || loading) return;
    if (appliedFocusNonceRef.current === tableFocus.nonce) return;

    const match = schema.tables.find(
      (t) => t.name.toLowerCase() === tableFocus.table.trim().toLowerCase(),
    );
    if (!match) return;

    appliedFocusNonceRef.current = tableFocus.nonce;
    skipDataResetRef.current = true;
    setSelectedTable(match.name);
    if (tableFocus.showData && canBrowseData) {
      setShowData(true);
    }
  }, [tableFocus, schema, canBrowseData, loading]);

  useEffect(() => {
    if (!canBrowseData || !showData || !databaseId || !selectedTable) return;
    setPreviewLoading(true);
    setPreviewError(null);
    fetchTablePreview(databaseId, selectedTable)
      .then((data) => {
        setPreview(data);
        window.setTimeout(() => {
          dataRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      })
      .catch((e) => {
        setPreview(null);
        setPreviewError(e instanceof Error ? e.message : "Failed to load table data");
      })
      .finally(() => setPreviewLoading(false));
  }, [canBrowseData, showData, databaseId, selectedTable]);

  function scrollToData() {
    if (!selectedTable || !canBrowseData) return;
    setShowData(true);
    requestAnimationFrame(() => {
      dataRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin border-2 border-ink-700 border-t-white" />
      </div>
    );
  }

  if (!databaseId || !schema?.tables.length) {
    return (
      <div className="flex h-72 flex-col items-center justify-center border border-ink-800">
        <p className="mono-label">No data</p>
        <p className="mt-3 text-lg text-ink-500">
          {databases.length === 0
            ? canManageDataSources
              ? "Upload a database to explore schema"
              : "No databases connected yet — ask your company admin"
            : "Select a database to explore schema"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">Schema Explorer</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="tag border-white text-white">{schema.dialect}</span>
            <span className="font-mono text-sm text-ink-500">
              {schema.tables.length} tables · {schema.relationships.length} relations
            </span>
          </div>
        </div>
        {databases.length > 1 && (
          <select
            value={databaseId}
            onChange={(e) => onSelectDatabase(e.target.value)}
            className="input-ink min-w-[240px] text-sm"
          >
            {databases.map((db) => (
              <option key={db.id} value={db.id}>
                {db.filename} — {db.table_count} tables
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="text-sm text-ink-500">
        Select a table to view its structure.
        {canBrowseData && " Click the schema panel to view table data below."}
      </p>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="panel flex max-h-[calc(100vh-14rem)] flex-col overflow-hidden">
          <div className="shrink-0 border-b border-ink-800 bg-ink-950 px-5 py-4">
            <p className="mono-label">Tables</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables…"
              className="input-ink mt-3 w-full text-sm"
            />
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-ink-900 overflow-y-auto overscroll-contain">
            {filteredTables.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-ink-500">No tables match.</li>
            ) : (
              filteredTables.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedTable(t.name)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-ink-900/60 ${
                      selectedTable === t.name ? "bg-ink-900/80" : ""
                    }`}
                  >
                    <span className={`truncate font-mono text-sm ${selectedTable === t.name ? "text-white" : "text-ink-300"}`}>
                      {t.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      {t.columns.length} cols
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel flex max-h-[calc(100vh-14rem)] flex-col overflow-hidden">
          {!table ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <p className="mono-label">Table Schema</p>
              <p className="mt-3 text-sm text-ink-500">Select a table from the list to view its columns.</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={scrollToData}
              disabled={!canBrowseData}
              className={`flex min-h-0 flex-1 flex-col overflow-hidden text-left transition-colors ${
                canBrowseData ? "cursor-pointer hover:bg-ink-900/30" : "cursor-default"
              }`}
            >
              <div className="shrink-0 border-b border-ink-800 px-5 py-4">
                <p className="mono-label">Table Schema</p>
                <h3 className="mt-2 font-mono text-xl font-bold text-white">{table.name}</h3>
                <p className="mt-1 text-sm text-ink-500">
                  {table.columns.length} columns
                  {relatedKeys.length > 0 && ` · ${relatedKeys.length} related keys`}
                  {canBrowseData && (
                    <span className="ml-2 text-ink-400">· Click to view data ↓</span>
                  )}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="divide-y divide-ink-900 border border-ink-800">
                  {table.columns.map((col) => (
                    <div key={col.name} className="flex items-center justify-between bg-black px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-ink-200">{col.name}</span>
                        {col.is_primary_key && <span className="tag text-[9px]">PK</span>}
                      </div>
                      <span className="font-mono text-xs text-ink-600">{col.type}</span>
                    </div>
                  ))}
                </div>
                {relatedKeys.length > 0 && (
                  <div className="mt-6 border border-ink-800 p-4">
                    <p className="mono-label">Related Foreign Keys</p>
                    <div className="mt-3 space-y-2">
                      {relatedKeys.map((r, i) => (
                        <p key={i} className="font-mono text-sm text-ink-400">
                          <span className="text-white">{r.from_table}</span>.{r.from_column}
                          <span className="text-ink-600"> → </span>
                          <span className="text-white">{r.to_table}</span>.{r.to_column}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </button>
          )}
        </div>
      </div>

      {canBrowseData && showData && selectedTable && (
        <div
          id={SECTION_IDS.tableDataResults}
          ref={dataRef}
          className="panel w-full scroll-mt-28 p-8"
        >
          <div className="mb-6">
            <p className="mono-label">Table Data</p>
            <h3 className="mt-2 font-mono text-2xl font-bold text-white">{selectedTable}</h3>
            <p className="mt-1 text-sm text-ink-500">
              {preview ? `Showing ${preview.row_count} of up to ${preview.limit} rows` : "Loading…"}
            </p>
          </div>

          {previewLoading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin border-2 border-ink-700 border-t-white" />
            </div>
          )}

          {previewError && (
            <div className="border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">{previewError}</div>
          )}

          {!previewLoading && preview && preview.columns.length > 0 && (
            <ResultsTable columns={preview.columns} rows={preview.rows} />
          )}

          {!previewLoading && preview && preview.columns.length === 0 && (
            <p className="text-sm text-ink-500">This table has no rows.</p>
          )}
        </div>
      )}
    </div>
  );
}
