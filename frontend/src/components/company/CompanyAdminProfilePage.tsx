import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CompanyAdminProfile,
  deleteAdminAvatar,
  fetchAdminProfile,
  requestAdminPasswordChange,
  updateAdminProfile,
  uploadAdminAvatar,
  UserProfile,
} from "../../api";
import { useNotification } from "../../notification";
import UserAvatar from "../UserAvatar";

interface Props {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
}

export default function CompanyAdminProfilePage({ user, onUserUpdated }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<CompanyAdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);

  const [fullName, setFullName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProfile();
      setProfile(data);
      setFullName(data.full_name || "");
      setContactName(data.company.contact_name || "");
      setContactEmail(data.company.contact_email || "");
      setContactPhone(data.company.contact_phone || "");
      setWebsite(data.company.website || "");
      setAddress(data.company.address || "");
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
      const updated = await updateAdminProfile({
        full_name: fullName.trim() || undefined,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        website: website.trim(),
        address: address.trim(),
      });
      setProfile(updated);
      onUserUpdated({
        ...user,
        full_name: updated.full_name,
        avatar_url: updated.avatar_url,
      });
      notifySuccess("Profile updated");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarRemove() {
    setRemovingAvatar(true);
    try {
      await deleteAdminAvatar();
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

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadAdminAvatar(file);
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

  async function handlePasswordRequest(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notifyError("New passwords do not match");
      return;
    }
    setPasswordSubmitting(true);
    try {
      await requestAdminPasswordChange(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await load();
      notifySuccess("Password change submitted — awaiting platform admin approval");
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

  const { company } = profile;

  return (
    <div className="space-y-10">
      <div>
        <p className="mono-label">Account</p>
        <h3 className="mt-2 text-3xl font-bold text-white">Admin Profile</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Manage your personal details and company contact information. Plan, quotas, and security-sensitive
          settings are managed by AtlasIQ platform administrators.
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
            <p className="text-center text-[10px] text-ink-500">JPG, PNG, WebP or GIF · max 5 MB</p>
          </div>

          <dl className="mt-8 space-y-4 border-t border-ink-800 pt-6 text-sm">
            {[
              ["Email", profile.email],
              ["Role", "Company Admin"],
              ["Member since", new Date(profile.created_at).toLocaleDateString()],
              ["Last login", profile.last_login_at ? new Date(profile.last_login_at).toLocaleString() : "Never"],
            ].map(([label, value]) => (
              <div key={label as string} className="border-b border-ink-900 pb-3">
                <dt className="mono-label text-[9px]">{label}</dt>
                <dd className="mt-1 text-ink-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-ink-800 pt-6">
            <p className="mono-label">Password</p>
            {profile.password_change_pending ? (
              <p className="mt-3 border border-ink-600 bg-ink-900 px-3 py-3 text-sm text-ink-200">
                A password change request is pending platform admin approval. You will be able to sign in with your
                current password until it is approved.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-ink-500">
                  For security, company admin password changes require approval from an AtlasIQ platform administrator.
                </p>
                <form onSubmit={handlePasswordRequest} className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mono-label text-[9px]">Current password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">Confirm new password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
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
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-ink mt-2 w-full text-sm"
                  required
                  minLength={2}
                />
              </label>
            </div>
          </div>

          <div className="panel p-8">
            <p className="mono-label">Company Contact</p>
            <p className="mt-2 text-xs text-ink-500">
              Company name, industry, and plan are read-only. Update contact details your team shares externally.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Company name</span>
                <input value={company.name} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Industry</span>
                <input value={company.industry || "—"} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Plan</span>
                <input value={company.plan_tier} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Contact name</span>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-ink mt-2 w-full text-sm" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Contact email</span>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input-ink mt-2 w-full text-sm" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Contact phone</span>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="input-ink mt-2 w-full text-sm" />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Website</span>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className="input-ink mt-2 w-full text-sm" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Address</span>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="input-ink mt-2 w-full text-sm" />
              </label>
            </div>

            <div className="mt-6 grid gap-px bg-ink-800 sm:grid-cols-3">
              <div className="bg-ink-950 p-4">
                <p className="mono-label text-[9px]">Daily queries</p>
                <p className="mt-1 text-lg font-bold text-white">{company.quota_queries_per_day ?? "Default"}</p>
              </div>
              <div className="bg-ink-950 p-4">
                <p className="mono-label text-[9px]">Max rows</p>
                <p className="mt-1 text-lg font-bold text-white">{company.quota_max_rows ?? "Default"}</p>
              </div>
              <div className="bg-ink-950 p-4">
                <p className="mono-label text-[9px]">Data sources</p>
                <p className="mt-1 text-lg font-bold text-white">{company.quota_max_databases ?? "Default"}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-ink min-w-[160px]">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
