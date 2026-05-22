import { PasswordChangeRequest } from "../api";

interface Props {
  requests: PasswordChangeRequest[];
  loading: boolean;
  acting: string | null;
  userColumnLabel: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  showCompanyColumn?: boolean;
  title?: string;
  description?: string;
  hideWhenEmpty?: boolean;
  sectionHeader?: React.ReactNode;
}

export default function PasswordRequestsPanel({
  requests,
  loading,
  acting,
  userColumnLabel,
  onApprove,
  onReject,
  showCompanyColumn,
  title,
  description,
  hideWhenEmpty,
  sectionHeader,
}: Props) {
  if (loading) {
    return (
      <div className={`flex justify-center ${sectionHeader ? "py-12" : "py-8"}`}>
        <div className={`${sectionHeader ? "h-8 w-8" : "h-6 w-6"} animate-spin border-2 border-ink-800 border-t-white`} />
      </div>
    );
  }

  if (requests.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="space-y-6">
        {sectionHeader}
        <div className="panel px-6 py-10 text-center text-sm text-ink-500">
          No pending password change requests.
        </div>
      </div>
    );
  }

  const table = (
    <div className="panel overflow-hidden">
      {title && (
        <div className="border-b border-ink-800 px-6 py-4">
          <p className="mono-label">{title}</p>
          {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className={`mono-label px-6 ${sectionHeader ? "py-4" : "py-3"}`}>Requested</th>
            <th className={`mono-label px-6 ${sectionHeader ? "py-4" : "py-3"}`}>{userColumnLabel}</th>
            {showCompanyColumn && <th className="mono-label px-6 py-4">Company</th>}
            <th className={`mono-label px-6 ${sectionHeader ? "py-4" : "py-3"}`}>Actions</th>
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
              {showCompanyColumn && (
                <td className="px-6 py-4 text-ink-300">{req.company_name || "—"}</td>
              )}
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={acting === req.id} onClick={() => onApprove(req.id)} className="btn-ink text-xs">
                    Approve
                  </button>
                  <button type="button" disabled={acting === req.id} onClick={() => onReject(req.id)} className="btn-ghost text-xs">
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

  if (sectionHeader) {
    return (
      <div className="space-y-6">
        {sectionHeader}
        {table}
      </div>
    );
  }

  return table;
}
