import { useCallback, useEffect, useState } from "react";
import {
  approvePasswordRequest,
  fetchPasswordRequests,
  PasswordChangeRequest,
  rejectPasswordRequest,
} from "../../api";
import { useNotification } from "../../notification";
import PasswordRequestsPanel from "../PasswordRequestsPanel";
import PlatformSectionHeader from "./PlatformSectionHeader";

export default function PlatformPasswordRequests() {
  const { notifySuccess, notifyError } = useNotification();
  const [requests, setRequests] = useState<PasswordChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchPasswordRequests("pending"));
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
      await approvePasswordRequest(id);
      notifySuccess("Password change approved");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to approve request");
    } finally {
      setActing(null);
    }
  }

  async function handleReject(id: string) {
    const note = window.prompt("Optional note for the company admin:");
    if (note === null) return;
    setActing(id);
    try {
      await rejectPasswordRequest(id, note || undefined);
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
      userColumnLabel="Admin"
      showCompanyColumn
      onApprove={handleApprove}
      onReject={handleReject}
      sectionHeader={
        <PlatformSectionHeader
          label="Security"
          description="Review company admin password change requests before they take effect."
        />
      }
    />
  );
}
