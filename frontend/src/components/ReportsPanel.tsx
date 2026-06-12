import { useState } from "react";
import { deleteReport, exportCsv, fetchReportRuns, ReportItem, ReportRunItem, runReportNow } from "../api";
import { useNotification } from "../notification";
import { SECTION_IDS } from "../sections";
import EditReportModal from "./EditReportModal";

interface ReportsPanelProps {
  reports: ReportItem[];
  onCreate: () => void;
  onRefresh?: () => void;
  showRunActions?: boolean;
}

export default function ReportsPanel({ reports, onCreate, onRefresh, showRunActions }: ReportsPanelProps) {
  const { notifySuccess, notifyError } = useNotification();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<ReportRunItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);

  async function loadRuns(reportId: string) {
    setLoadingRuns(true);
    try {
      setRuns(await fetchReportRuns(reportId));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load run history");
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }

  async function toggleHistory(reportId: string) {
    if (expandedId === reportId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(reportId);
    await loadRuns(reportId);
  }

  async function handleRunNow(reportId: string) {
    setRunningId(reportId);
    try {
      await runReportNow(reportId);
      notifySuccess("Report run queued");
      onRefresh?.();
      if (expandedId === reportId) await loadRuns(reportId);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to run report");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(reportId: string, name: string) {
    if (!window.confirm(`Delete report "${name}"? This cannot be undone.`)) return;
    setDeletingId(reportId);
    try {
      await deleteReport(reportId);
      notifySuccess("Report deleted");
      if (expandedId === reportId) setExpandedId(null);
      onRefresh?.();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  }

  if (!reports.length) {
    return (
      <div id={SECTION_IDS.reportsList} className="scroll-mt-28 flex flex-col items-center justify-center border border-ink-800 py-20">
        <p className="mono-label">Scheduled</p>
        <p className="mt-4 text-2xl font-bold text-white">No reports yet</p>
        <p className="mt-2 max-w-sm text-center text-sm text-ink-500">
          Schedule recurring queries and review results in-app.
        </p>
        <button type="button" onClick={onCreate} className="btn-ink mt-8">
          Create Report
        </button>
      </div>
    );
  }

  return (
    <div id={SECTION_IDS.reportsList} className="scroll-mt-28 space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={onCreate} className="btn-ink text-sm">New Report</button>
      </div>
      <div className="grid gap-px bg-ink-800 md:grid-cols-2">
        {reports.map((r) => (
          <div key={r.id} className="bg-black p-8">
            <div className="flex items-start justify-between">
              <h4 className="text-lg font-bold text-white">{r.name}</h4>
              <span className={`tag ${r.last_status === "success" ? "border-white text-white" : ""}`}>
                {r.last_status ?? "pending"}
              </span>
            </div>
            <p className="mt-3 text-sm text-ink-500">{r.question}</p>
            <p className="mt-4 font-mono text-xs text-ink-600">
              {r.schedule}
              {r.last_run_at && ` · ${new Date(r.last_run_at).toLocaleString()}`}
            </p>
            {r.last_result && (
              <p className="mt-3 line-clamp-2 text-xs text-ink-400">{r.last_result}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {showRunActions && (
                <button
                  type="button"
                  disabled={runningId === r.id}
                  onClick={() => handleRunNow(r.id)}
                  className="btn-ghost text-xs"
                >
                  {runningId === r.id ? "Running…" : "Run now"}
                </button>
              )}
              <button type="button" onClick={() => toggleHistory(r.id)} className="btn-ghost text-xs">
                {expandedId === r.id ? "Hide history" : "Run history"}
              </button>
              <button type="button" onClick={() => setEditingReport(r)} className="btn-ghost text-xs">
                Edit
              </button>
              {r.last_result && (
                <button
                  type="button"
                  onClick={() => {
                    exportCsv(
                      ["report", "question", "status", "last_run_at", "result"],
                      [{
                        report: r.name,
                        question: r.question,
                        status: r.last_status ?? "",
                        last_run_at: r.last_run_at ?? "",
                        result: r.last_result,
                      }],
                      `${r.name.replace(/\s+/g, "-").toLowerCase()}-result.csv`,
                    );
                    notifySuccess("Result exported");
                  }}
                  className="btn-ghost text-xs"
                >
                  Export result
                </button>
              )}
              <button
                type="button"
                disabled={deletingId === r.id}
                onClick={() => handleDelete(r.id, r.name)}
                className="btn-ghost text-xs text-ink-500 hover:text-white"
              >
                {deletingId === r.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            {expandedId === r.id && (
              <div className="mt-4 border-t border-ink-800 pt-4">
                {loadingRuns ? (
                  <p className="text-xs text-ink-500">Loading…</p>
                ) : runs.length === 0 ? (
                  <p className="text-xs text-ink-500">No runs recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {runs.map((run) => (
                      <li key={run.id} className="text-xs text-ink-400">
                        <span className={run.status === "success" ? "text-white" : "text-ink-500"}>{run.status}</span>
                        {" · "}
                        {new Date(run.ran_at).toLocaleString()}
                        {run.result_summary && (
                          <p className="mt-1 line-clamp-2 text-ink-500">{run.result_summary}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <EditReportModal
        open={!!editingReport}
        report={editingReport}
        onClose={() => setEditingReport(null)}
        onUpdated={() => {
          notifySuccess("Report updated");
          onRefresh?.();
        }}
      />
    </div>
  );
}
