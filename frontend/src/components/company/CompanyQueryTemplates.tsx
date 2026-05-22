import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  createCompanyQueryTemplate,
  deleteCompanyQueryTemplate,
  DesignationList,
  fetchCompanyQueryTemplates,
  QueryTemplateItem,
} from "../../api";
import { useNotification } from "../../notification";

interface Props {
  designations: DesignationList;
}

export default function CompanyQueryTemplates({ designations }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const [templates, setTemplates] = useState<QueryTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await fetchCompanyQueryTemplates());
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !question.trim()) return;
    setSaving(true);
    try {
      await createCompanyQueryTemplate({
        title: title.trim(),
        question: question.trim(),
        designation: designation || undefined,
      });
      notifySuccess("Query template published");
      setTitle("");
      setQuestion("");
      setDesignation("");
      await load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this template?")) return;
    try {
      await deleteCompanyQueryTemplate(id);
      notifySuccess("Template removed");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to delete template");
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-ink-800 px-6 py-4">
        <p className="mono-label">Shared query templates</p>
        <p className="mt-1 text-xs text-ink-500">Starter questions employees can use in Query Studio</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 border-b border-ink-800 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mono-label text-[9px]">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-ink mt-2 w-full text-sm" required />
          </label>
          <label className="block">
            <span className="mono-label text-[9px]">For designation (optional)</span>
            <select value={designation} onChange={(e) => setDesignation(e.target.value)} className="input-ink mt-2 w-full text-sm">
              <option value="">All employees</option>
              {designations.designations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mono-label text-[9px]">Question</span>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="input-ink mt-2 w-full text-sm" rows={2} required />
        </label>
        <button type="submit" disabled={saving} className="btn-ink text-sm">
          {saving ? "Publishing…" : "Publish template"}
        </button>
      </form>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin border-2 border-ink-800 border-t-white" />
        </div>
      ) : templates.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-500">No templates yet.</p>
      ) : (
        <ul className="divide-y divide-ink-900">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-white">{t.title}</p>
                <p className="mt-1 text-sm text-ink-400">{t.question}</p>
                {t.designation && <p className="mt-1 text-[10px] text-ink-600">Role: {t.designation}</p>}
              </div>
              <button type="button" onClick={() => handleDelete(t.id)} className="btn-ghost shrink-0 text-xs">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
