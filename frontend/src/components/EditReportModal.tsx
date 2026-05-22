import { useEffect, useState } from "react";
import { ReportItem, updateReport } from "../api";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./Modal";

interface Props {
  open: boolean;
  report: ReportItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditReportModal({ open, report, onClose, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [schedule, setSchedule] = useState<"daily" | "weekly">("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !report) return;
    setName(report.name);
    setQuestion(report.question);
    setSchedule(report.schedule === "daily" ? "daily" : "weekly");
    setError(null);
  }, [open, report]);

  if (!open || !report) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await updateReport(report!.id, {
        name: name.trim(),
        question: question.trim(),
        schedule,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" titleId="edit-report-title">
      <form onSubmit={handleSubmit}>
        <ModalHeader label="Scheduled" title="Edit Report" titleId="edit-report-title" onClose={onClose} />
        <ModalBody className="space-y-4">
          <label className="block">
            <span className="mono-label text-[9px]">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-ink mt-2 w-full text-sm" required />
          </label>
          <label className="block">
            <span className="mono-label text-[9px]">Question</span>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="input-ink mt-2 w-full text-sm" rows={3} required />
          </label>
          <label className="block">
            <span className="mono-label text-[9px]">Schedule</span>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value as "daily" | "weekly")} className="input-ink mt-2 w-full text-sm">
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
          {error && <p className="text-sm text-ink-300">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="btn-ink text-sm">{loading ? "Saving…" : "Save changes"}</button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
