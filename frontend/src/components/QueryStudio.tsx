import {
  DatabaseItem,
  DatabaseSchema,
  exportCsv,
  QueryQuota,
  QueryResult,
  QueryTemplateItem,
  SavedQueryItem,
  submitFeedback,
} from "../api";
import { useNotification } from "../notification";
import { SECTION_IDS } from "../sections";
import ActiveSchemaSummary from "./ActiveSchemaSummary";
import ChartView from "./ChartView";
import FocusTableSummary from "./FocusTableSummary";
import QueryBox from "./QueryBox";
import ResultsTable from "./ResultsTable";

export interface QueryRunOptions {
  clarification?: string;
  skip_cost_check?: boolean;
  previous_error?: string;
  previous_sql?: string;
}

interface Props {
  databases: DatabaseItem[];
  selectedDb: string;
  onSelectDatabase: (id: string) => void;
  canManageDataSources: boolean;
  schema: DatabaseSchema | null;
  schemaLoading: boolean;
  focusTables: string[];
  onFocusChange: (tables: string[]) => void;
  question: string;
  onQuestionChange: (q: string) => void;
  querySuggestions: string[];
  loading: boolean;
  loadingLabel?: string;
  llmConfigured?: boolean;
  queryQuota?: QueryQuota | null;
  onRunQuery: (opts?: QueryRunOptions) => void;
  result: QueryResult | null;
  clarification: string;
  onClarificationChange: (v: string) => void;
  onScheduleReport: (databaseId: string, question: string) => void;
  onNotify: (message: string) => void;
  savedQueries?: SavedQueryItem[];
  queryTemplates?: QueryTemplateItem[];
  onSaveQuery?: () => void;
  onDeleteSavedQuery?: (id: string) => void;
  onLoadQuestion?: (databaseId: string, question: string) => void;
}

export default function QueryStudio({
  databases,
  selectedDb,
  onSelectDatabase,
  canManageDataSources,
  schema,
  schemaLoading,
  focusTables,
  onFocusChange,
  question,
  onQuestionChange,
  querySuggestions,
  loading,
  loadingLabel,
  llmConfigured = true,
  queryQuota,
  onRunQuery,
  result,
  clarification,
  onClarificationChange,
  onScheduleReport,
  onNotify,
  savedQueries = [],
  queryTemplates = [],
  onSaveQuery,
  onDeleteSavedQuery,
  onLoadQuestion,
}: Props) {
  const { notifyError } = useNotification();

  return (
    <div className="space-y-10">
      <div className="grid gap-8 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <div className="panel p-8">
            <p className="mono-label">Data Source</p>
            <h3 className="mt-2 text-xl font-bold text-white">Select Database</h3>
            {databases.length === 0 ? (
              <p className="mt-6 text-sm text-ink-500">
                {canManageDataSources
                  ? "No databases yet. Go to Data Sources to upload or connect."
                  : "No databases available. Ask your company admin to connect data sources."}
              </p>
            ) : (
              <select
                value={selectedDb}
                onChange={(e) => onSelectDatabase(e.target.value)}
                className="input-ink mt-6 w-full text-sm"
              >
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.filename} — {db.table_count} tables
                  </option>
                ))}
              </select>
            )}
          </div>
          {schema && (
            <ActiveSchemaSummary
              schema={schema}
              loading={schemaLoading}
              focusTables={focusTables}
              onFocusChange={onFocusChange}
              focusDisabled={!selectedDb || loading}
            />
          )}
          {!schema && schemaLoading && selectedDb && (
            <div className="flex h-40 items-center justify-center border border-ink-800 bg-black">
              <div className="h-6 w-6 animate-spin border-2 border-ink-700 border-t-white" />
            </div>
          )}
          {(savedQueries.length > 0 || queryTemplates.length > 0) && (
            <div className="panel space-y-6 p-6">
              {savedQueries.length > 0 && (
                <div>
                  <p className="mono-label">Saved questions</p>
                  <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                    {savedQueries.map((sq) => (
                      <li key={sq.id} className="flex items-start justify-between gap-2 border border-ink-800 bg-black p-3">
                        <button
                          type="button"
                          onClick={() => onLoadQuestion?.(sq.database_id, sq.question)}
                          className="min-w-0 flex-1 text-left text-xs text-ink-200 hover:text-white"
                        >
                          {sq.name || sq.question}
                        </button>
                        {onDeleteSavedQuery && (
                          <button type="button" onClick={() => onDeleteSavedQuery(sq.id)} className="btn-ghost shrink-0 px-2 py-1 text-[10px]">
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {queryTemplates.length > 0 && (
                <div>
                  <p className="mono-label">Team templates</p>
                  <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                    {queryTemplates.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => onLoadQuestion?.(t.database_id || selectedDb, t.question)}
                          className="w-full border border-ink-800 bg-black p-3 text-left hover:border-ink-500"
                        >
                          <p className="text-xs font-medium text-white">{t.title}</p>
                          <p className="mt-1 text-[10px] text-ink-500">{t.question}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="panel-elevated p-10 xl:col-span-8">
          {!llmConfigured && (
            <div className="mb-6 border border-ink-600 bg-ink-950 px-4 py-3 text-sm text-ink-200">
              Set <span className="font-mono text-white">GROQ_API_KEY</span> in your <span className="font-mono">.env</span> file to enable natural-language queries.
            </div>
          )}
          {queryQuota && (
            <p className="mb-4 font-mono text-[10px] text-ink-500">
              Today: {queryQuota.queries_today}/{queryQuota.queries_limit} queries
              {queryQuota.concurrent_jobs > 0 && ` · ${queryQuota.concurrent_jobs} running`}
            </p>
          )}
          <p className="mono-label">Natural Language</p>
          <h3 className="mt-2 text-2xl font-bold text-white">What do you want to know?</h3>
          <FocusTableSummary
            selected={focusTables}
            disabled={!selectedDb || loading}
            onRemove={(table) => onFocusChange(focusTables.filter((t) => t !== table))}
          />
          <div className="mt-8">
            <QueryBox
              question={question}
              loading={loading}
              loadingLabel={loadingLabel}
              disabled={!selectedDb || !llmConfigured}
              suggestions={querySuggestions}
              onChange={onQuestionChange}
              onSubmit={() => onRunQuery()}
            />
          </div>
        </div>
      </div>

      {result && (
        <div id={SECTION_IDS.queryResults} className="scroll-mt-28 space-y-6">
          {result.clarification_needed && result.clarification_message && (
            <div className="result-block border border-ink-600 bg-ink-900 p-8">
              <p className="mono-label">Clarification Required</p>
              <p className="mt-2 text-lg text-white">{result.clarification_message}</p>
              <div className="mt-6 flex gap-3">
                <input
                  value={clarification}
                  onChange={(e) => onClarificationChange(e.target.value)}
                  placeholder="Add context…"
                  className="input-ink flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    onRunQuery({ clarification: clarification.trim() });
                    onClarificationChange("");
                  }}
                  className="btn-ink shrink-0"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {result.cost_estimate?.high_cost && !result.success && (
            <div className="result-block border border-ink-600 p-8">
              <p className="text-ink-300">{result.cost_estimate.warning}</p>
              <button type="button" onClick={() => onRunQuery({ skip_cost_check: true })} className="btn-ghost mt-4">
                Execute anyway
              </button>
            </div>
          )}
          {result.explanation && result.success && (
            <div className="result-block border-l-2 border-white bg-ink-900 p-8">
              {result.execution_ms != null && (
                <p className="mono-label text-ink-400">
                  Completed in {result.execution_ms}ms
                  {result.row_count != null && ` · ${result.row_count} row${result.row_count === 1 ? "" : "s"}`}
                </p>
              )}
              <p className="mono-label mt-4">Insight</p>
              <p className="mt-4 text-xl leading-relaxed text-white">{result.explanation}</p>
            </div>
          )}
          {result.generated_sql && (
            <div className="result-block panel p-8">
              <p className="mono-label">Generated SQL</p>
              <pre className="mt-4 overflow-x-auto border border-ink-800 bg-black p-6 font-mono text-sm leading-relaxed text-ink-200">
                {result.generated_sql}
              </pre>
              {result.sql_breakdown && <p className="mt-4 text-sm text-ink-500">{result.sql_breakdown}</p>}
              {result.confidence != null && (
                <p className="mono-label mt-4">Confidence {(result.confidence * 100).toFixed(0)}%</p>
              )}
            </div>
          )}
          {result.trends.length > 0 && (
            <div className="result-block panel p-8">
              <p className="mono-label">Trends</p>
              <ul className="mt-4 space-y-3">
                {result.trends.map((t) => (
                  <li key={t} className="flex gap-3 text-ink-300">
                    <span className="text-white">—</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.error && !result.success && (
            <div className="result-block border border-ink-600 p-8">
              <p className="mono-label">Error</p>
              <p className="mt-2 text-ink-300">{result.error}</p>
              {result.generated_sql && (
                <button
                  type="button"
                  onClick={() =>
                    onRunQuery({ previous_error: result.error!, previous_sql: result.generated_sql! })
                  }
                  className="btn-ghost mt-4"
                >
                  Auto-correct & retry
                </button>
              )}
            </div>
          )}
          {result.success && result.chart && result.chart.type !== "none" && (
            <ChartView chart={result.chart} rows={result.rows} />
          )}
          {result.success && result.columns.length > 0 && (
            <div className="panel p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="mono-label">Results</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {result.row_count} rows · {result.execution_ms}ms
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      exportCsv(result.columns, result.rows);
                      onNotify("Results exported to CSV");
                    }}
                    className="btn-ghost text-xs"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onScheduleReport(selectedDb, question)}
                    className="btn-ghost text-xs"
                  >
                    Schedule
                  </button>
                  {onSaveQuery && question.trim() && (
                    <button type="button" onClick={onSaveQuery} className="btn-ghost text-xs">
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void submitFeedback(result.id, 1)
                        .then(() => onNotify("Thanks for the feedback"))
                        .catch((e) => notifyError(e instanceof Error ? e.message : "Failed to submit feedback"));
                    }}
                    className="btn-ghost text-xs"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void submitFeedback(result.id, -1)
                        .then(() => onNotify("Feedback recorded — we'll improve"))
                        .catch((e) => notifyError(e instanceof Error ? e.message : "Failed to submit feedback"));
                    }}
                    className="btn-ghost text-xs"
                  >
                    -1
                  </button>
                </div>
              </div>
              <ResultsTable columns={result.columns} rows={result.rows} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
