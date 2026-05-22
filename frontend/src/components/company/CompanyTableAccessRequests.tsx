import { useCallback, useEffect, useState } from "react";
import {
  approveTableAccessRequest,
  fetchCompanyTableAccessRequests,
  rejectTableAccessRequest,
  TableAccessRequest,
} from "../../api";
import { useNotification } from "../../notification";

export default function CompanyTableAccessRequests() {
  const { notifySuccess, notifyError } = useNotification();
  const [requests, setRequests] = useState<TableAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchCompanyTableAccessRequests("pending"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load access requests");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setActing(id);
    try {
      await approveTableAccessRequest(id);
      notifySuccess("Table access approved");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to approve request");
    } finally {
      setActing(null);
    }
  }

  async function handleReject(id: string) {
    const note = window.prompt("Optional note for the employee:");
    if (note === null) return;
    setActing(id);
    try {
      await rejectTableAccessRequest(id, note || undefined);
      notifySuccess("Access request rejected");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-ink-800 px-6 py-4">
        <p className="mono-label">Table access requests</p>
        <p className="mt-1 text-xs text-ink-500">{requests.length} pending approval</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className="mono-label px-6 py-3">Requested</th>
            <th className="mono-label px-6 py-3">Employee</th>
            <th className="mono-label px-6 py-3">Tables</th>
            <th className="mono-label px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-b border-ink-900">
              <td className="px-6 py-4 text-ink-300">{new Date(req.created_at).toLocaleString()}</td>
              <td className="px-6 py-4">
                <p className="text-white">{req.user_name || req.user_email}</p>
                <p className="text-xs text-ink-500">{req.user_email}</p>
              </td>
              <td className="px-6 py-4">
                <p className="font-mono text-xs text-ink-300">{req.table_names.join(", ")}</p>
                {req.reason && <p className="mt-1 text-xs text-ink-500">{req.reason}</p>}
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <button type="button" disabled={acting === req.id} onClick={() => handleApprove(req.id)} className="btn-ink text-xs">
                    Approve
                  </button>
                  <button type="button" disabled={acting === req.id} onClick={() => handleReject(req.id)} className="btn-ghost text-xs">
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
