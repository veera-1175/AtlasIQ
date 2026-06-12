import { useCallback, useEffect, useState } from "react";
import {
  approveCompanyPasswordRequest,
  fetchCompanyEmployeePasswordRequests,
  PasswordChangeRequest,
  rejectCompanyPasswordRequest,
} from "../../api";
import { useNotification } from "../../notification";
import PasswordRequestsPanel from "../PasswordRequestsPanel";

export default function CompanyPasswordRequests() {
  const { notifySuccess, notifyError } = useNotification();
  const [requests, setRequests] = useState<PasswordChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchCompanyEmployeePasswordRequests("pending"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load password requests");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setActing(id);
    try {
      await approveCompanyPasswordRequest(id);
      notifySuccess("Employee password change approved");
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
      await rejectCompanyPasswordRequest(id, note || undefined);
      notifySuccess("Password change rejected");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setActing(null);
    }
  }

  return (
    <PasswordRequestsPanel
      requests={requests}
      loading={loading}
      acting={acting}
      userColumnLabel="Employee"
      onApprove={handleApprove}
      onReject={handleReject}
      hideWhenEmpty
      title="Employee password requests"
      description={requests.length > 0 ? `${requests.length} pending approval` : undefined}
    />
  );
}
