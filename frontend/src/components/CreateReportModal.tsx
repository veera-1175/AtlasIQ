import { useEffect, useState } from "react";
import { createReport, DatabaseItem } from "../api";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./Modal";

interface Props {
  open: boolean;
  databases: DatabaseItem[];
  initialDatabaseId?: string;
  initialQuestion?: string;
  onClose: () => void;
  onCreated: (reportName: string) => void;
}

export default function CreateReportModal({
  open,
  databases,
  initialDatabaseId = "",
  initialQuestion = "",
  onClose,
  onCreated,
}: Props) {
  const [databaseId, setDatabaseId] = useState(initialDatabaseId);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState(initialQuestion);
  const [schedule, setSchedule] = useState<"daily" | "weekly">("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDatabaseId(initialDatabaseId || databases[0]?.id || "");
    setQuestion(initialQuestion);
    setName(
      initialQuestion.trim()
        ? `Weekly: ${initialQuestion.trim().slice(0, 40)}`
        : "",
    );
    setSchedule("weekly");
    setError(null);
  }, [open, initialDatabaseId, initialQuestion, databases]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!databaseId) {
      setError("Select a database");
      return;
    }
    if (!name.trim()) {
      setError("Enter a report name");
      return;
    }
    if (question.trim().length < 3) {
      setError("Question must be at least 3 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const reportName = name.trim();
      await createReport(databaseId, reportName, question.trim(), schedule);
      onCreated(reportName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" titleId="create-report-title">
      <ModalHeader
        label="Automation"
        title="Schedule Report"
        subtitle="Run a saved question on a daily or weekly schedule and track delivery status."
        titleId="create-report-title"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-5">
          {databases.length === 0 ? (
            <p className="border border-ink-800 bg-black px-4 py-3 text-sm text-ink-500">
              Connect a database first under Data Sources.
            </p>
          ) : (
            <div>
              <label className="mono-label mb-2 block">Database</label>
              <select
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                className="input-ink w-full text-sm"
              >
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.filename} — {db.table_count} tables
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mono-label mb-2 block">Report Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly revenue summary"
              className="input-ink w-full"
            />
          </div>

          <div>
            <label className="mono-label mb-2 block">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should this report answer?"
              rows={4}
              className="input-ink w-full resize-none"
            />
          </div>

          <div>
            <label className="mono-label mb-2 block">Schedule</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as "daily" | "weekly")}
              className="input-ink w-full text-sm"
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>

          {error && (
            <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
          )}
        </ModalBody>

        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-ink flex-1"
            disabled={loading || databases.length === 0}
          >
            {loading ? "Creating…" : "Create Report"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
