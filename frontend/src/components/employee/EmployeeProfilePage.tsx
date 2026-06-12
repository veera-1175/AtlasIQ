import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  deleteEmployeeAvatar,
  EmployeeProfile,
  fetchEmployeeProfile,
  fetchEmployeeTableAccessRequests,
  fetchEmployeeWorkspaceHints,
  requestEmployeePasswordChange,
  requestTableAccess,
  TableAccessRequest,
  updateEmployeeProfile,
  uploadEmployeeAvatar,
  UserProfile,
} from "../../api";
import { useNotification } from "../../notification";
import UserAvatar from "../UserAvatar";

interface Props {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onOpenTable?: (tableName: string) => void;
}

export default function EmployeeProfilePage({ user, onUserUpdated, onOpenTable }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [requestTables, setRequestTables] = useState<string[]>([]);
  const [accessReason, setAccessReason] = useState("");
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessHistory, setAccessHistory] = useState<TableAccessRequest[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeeProfile();
      setProfile(data);
      setFullName(data.full_name || "");
      try {
        const [hints, requests] = await Promise.all([
          fetchEmployeeWorkspaceHints(),
          fetchEmployeeTableAccessRequests().catch(() => []),
        ]);
        setAvailableTables(hints.available_tables || []);
        setAccessHistory(requests);
      } catch {
        setAvailableTables([]);
        setAccessHistory([]);
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateEmployeeProfile({ full_name: fullName.trim() || undefined });
      setProfile(updated);
      onUserUpdated({ ...user, full_name: updated.full_name, avatar_url: updated.avatar_url });
      notifySuccess("Profile updated");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadEmployeeAvatar(file);
      setAvatarKey((k) => k + 1);
      onUserUpdated({ ...user, avatar_url: result.avatar_url });
      await load();
      notifySuccess("Profile picture updated");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setRemovingAvatar(true);
    try {
      await deleteEmployeeAvatar();
      setAvatarKey((k) => k + 1);
      onUserUpdated({ ...user, avatar_url: null });
      await load();
      notifySuccess("Profile picture removed");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to remove profile picture");
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function handlePasswordRequest(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notifyError("New passwords do not match");
      return;
    }
    setPasswordSubmitting(true);
    try {
      await requestEmployeePasswordChange(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await load();
      notifySuccess("Password change submitted — awaiting company admin approval");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to submit password change");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
        Could not load your profile.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="mono-label">Account</p>
        <h3 className="mt-2 text-3xl font-bold text-white">My Profile</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Update your display name and profile picture. Work access (designation, tables) is managed by your company admin.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="panel p-8 lg:col-span-1">
          <p className="mono-label">Profile Picture</p>
          <div className="mt-6 flex flex-col items-center gap-4">
            <UserAvatar
              avatarUrl={profile.avatar_url}
              label={profile.full_name || profile.email}
              className="h-24 w-24"
              cacheKey={avatarKey}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading || removingAvatar}
                onClick={() => fileRef.current?.click()}
                className="btn-ghost text-xs"
              >
                {uploading ? "Uploading…" : "Upload photo"}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  disabled={uploading || removingAvatar}
                  onClick={handleAvatarRemove}
                  className="btn-ghost text-xs text-ink-400 hover:text-white"
                >
                  {removingAvatar ? "Removing…" : "Remove photo"}
                </button>
              )}
            </div>
          </div>

          <dl className="mt-8 space-y-4 border-t border-ink-800 pt-6 text-sm">
            {[
              ["Email", profile.email],
              ["Role", "Employee"],
              ["Company", profile.company_name || "—"],
              ["Member since", new Date(profile.created_at).toLocaleDateString()],
              ["Last login", profile.last_login_at ? new Date(profile.last_login_at).toLocaleString() : "Never"],
            ].map(([label, value]) => (
              <div key={label as string} className="border-b border-ink-900 pb-3">
                <dt className="mono-label text-[9px]">{label}</dt>
                <dd className="mt-1 text-ink-200">{value}</dd>
              </div>
            ))}
          </dl>

          {profile.security_note && (
            <div className="mt-6 border border-ink-700 bg-ink-900/50 p-4">
              <p className="mono-label text-[9px]">Security note from your admin</p>
              <p className="mt-2 text-sm text-ink-200">{profile.security_note}</p>
            </div>
          )}

          <div className="mt-6 border-t border-ink-800 pt-6">
            <p className="mono-label">Password</p>
            {profile.password_change_pending ? (
              <p className="mt-3 border border-ink-600 bg-ink-900 px-3 py-3 text-sm text-ink-200">
                A password change request is pending company admin approval. Keep using your current password until approved.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-ink-500">
                  Password changes require approval from your company administrator.
                </p>
                <form onSubmit={handlePasswordRequest} className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mono-label text-[9px]">Current password</span>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-ink mt-2 w-full text-sm" required autoComplete="current-password" />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">New password</span>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-ink mt-2 w-full text-sm" required minLength={8} autoComplete="new-password" />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">Confirm new password</span>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-ink mt-2 w-full text-sm" required minLength={8} autoComplete="new-password" />
                  </label>
                  <button type="submit" disabled={passwordSubmitting} className="btn-ghost text-sm">
                    {passwordSubmitting ? "Submitting…" : "Request password change"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8 lg:col-span-2">
          <div className="panel p-8">
            <p className="mono-label">Your Details</p>
            <label className="mt-6 block">
              <span className="mono-label text-[9px]">Display name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-ink mt-2 w-full text-sm" required minLength={2} />
            </label>
          </div>

          <div className="panel p-8">
            <p className="mono-label">My Access</p>
            <p className="mt-2 text-xs text-ink-500">Read-only — contact your company admin to change designation or table permissions.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[9px]">Employee ID</span>
                <input value={profile.employee_id || "—"} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Designation</span>
                <input value={profile.designation || "—"} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Department</span>
                <input value={profile.department || profile.designation || "—"} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
            </div>
            <div className="mt-6">
              <p className="mono-label text-[9px]">Allowed tables ({profile.allowed_tables.length})</p>
              {profile.allowed_tables.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">No tables assigned yet.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.allowed_tables.map((table) => (
                    <button
                      key={table}
                      type="button"
                      onClick={() => onOpenTable?.(table)}
                      className="tag border-ink-600 font-mono text-[11px] hover:border-white hover:text-white"
                    >
                      {table}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(profile.pending_table_access?.length ?? 0) > 0 && (
              <p className="mt-4 text-xs text-ink-500">
                Pending approval: {profile.pending_table_access?.join(", ")}
              </p>
            )}
            {availableTables.length > 0 && (
              <div className="mt-8 border-t border-ink-800 pt-6">
                <p className="mono-label">Request more table access</p>
                <p className="mt-2 text-xs text-ink-500">Your company admin will review and approve additional tables.</p>
                <div className="mt-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {availableTables.map((table) => {
                    const selected = requestTables.includes(table);
                    return (
                      <button
                        key={table}
                        type="button"
                        onClick={() =>
                          setRequestTables((prev) =>
                            selected ? prev.filter((t) => t !== table) : [...prev, table],
                          )
                        }
                        className={`tag font-mono text-[11px] ${selected ? "border-white text-white" : "border-ink-600"}`}
                      >
                        {table}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  placeholder="Optional reason for your request"
                  className="input-ink mt-4 w-full text-sm"
                  rows={2}
                  maxLength={500}
                />
                <button
                  type="button"
                  disabled={accessSubmitting || requestTables.length === 0}
                  className="btn-ghost mt-4 text-sm"
                  onClick={async () => {
                    setAccessSubmitting(true);
                    try {
                      await requestTableAccess(requestTables, accessReason.trim() || undefined);
                      notifySuccess("Access request submitted to your company admin");
                      setRequestTables([]);
                      setAccessReason("");
                      await load();
                      setAccessHistory(await fetchEmployeeTableAccessRequests().catch(() => []));
                    } catch (e) {
                      notifyError(e instanceof Error ? e.message : "Failed to submit request");
                    } finally {
                      setAccessSubmitting(false);
                    }
                  }}
                >
                  {accessSubmitting ? "Submitting…" : "Submit access request"}
                </button>
              </div>
            )}
            {accessHistory.length > 0 && (
              <div className="mt-8 border-t border-ink-800 pt-6">
                <p className="mono-label">Access request history</p>
                <ul className="mt-4 space-y-3">
                  {accessHistory.map((req) => (
                    <li key={req.id} className="border border-ink-800 bg-black p-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`tag ${req.status === "approved" ? "border-white text-white" : ""}`}>{req.status}</span>
                        <span className="font-mono text-[10px] text-ink-600">{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-ink-300">{req.table_names.join(", ")}</p>
                      {req.reason && <p className="mt-1 text-ink-500">{req.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-ink min-w-[160px]">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
