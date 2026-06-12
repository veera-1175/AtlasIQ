import { useEffect, useState } from "react";
import { CompanyDetail, CompanyQuotaPayload, CompanyUpdatePayload } from "../../api";
import Modal, { ModalBody, ModalHeader } from "../Modal";
import { SECTION_IDS } from "../../sections";

const EMPTY_ADMIN = { email: "", fullName: "", password: "" };

interface Props {
  open: boolean;
  detail: CompanyDetail | null;
  loading: boolean;
  adminForm: typeof EMPTY_ADMIN;
  setAdminForm: (f: typeof EMPTY_ADMIN) => void;
  onClose: () => void;
  onAssignAdmin: () => void;
  onDeleteAdmin: (adminId: string, email: string) => void;
  onToggleStatus: (active: boolean) => void;
  onSaveCompany: (payload: CompanyUpdatePayload) => Promise<void>;
  onSaveQuotas: (payload: CompanyQuotaPayload) => Promise<void>;
  assigning: boolean;
  saving: boolean;
}

function StatusTag({ active }: { active: boolean }) {
  return (
    <span className={`tag ${active ? "border-white text-white" : ""}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function CompanyDetailModal({
  open,
  detail,
  loading,
  adminForm,
  setAdminForm,
  onClose,
  onAssignAdmin,
  onDeleteAdmin,
  onToggleStatus,
  onSaveCompany,
  onSaveQuotas,
  assigning,
  saving,
}: Props) {
  const [profileForm, setProfileForm] = useState<CompanyUpdatePayload>({});
  const [quotaForm, setQuotaForm] = useState<CompanyQuotaPayload>({});

  useEffect(() => {
    if (!detail) return;
    setProfileForm({
      name: detail.name,
      contact_name: detail.contact_name || "",
      contact_email: detail.contact_email || "",
      contact_phone: detail.contact_phone || "",
      industry: detail.industry || "",
      website: detail.website || "",
      address: detail.address || "",
      plan_tier: (detail.plan_tier as CompanyUpdatePayload["plan_tier"]) || "professional",
      notes: detail.notes || "",
    });
    setQuotaForm({
      quota_queries_per_day: detail.quota_queries_per_day ?? undefined,
      quota_max_rows: detail.quota_max_rows ?? undefined,
      quota_max_databases: detail.quota_max_databases ?? undefined,
      quota_concurrent_jobs: detail.quota_concurrent_jobs ?? undefined,
    });
  }, [detail]);

  return (
    <Modal open={open} onClose={onClose} size="3xl" titleId="company-detail-title">
      {loading || !detail ? (
        <ModalBody>
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
          </div>
        </ModalBody>
      ) : (
        <>
          <ModalHeader
            label="Client Account"
            title={detail.name}
            titleId="company-detail-title"
            onClose={onClose}
          />
          <ModalBody className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusTag active={detail.is_active} />
              <span className="tag capitalize">{detail.plan_tier || "starter"}</span>
              {detail.industry && <span className="tag">{detail.industry}</span>}
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="mono-label">Business Profile</p>
                <div className="mt-4 space-y-3">
                  <input value={profileForm.name || ""} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Company name" className="input-ink text-sm" />
                  <input value={profileForm.contact_name || ""} onChange={(e) => setProfileForm({ ...profileForm, contact_name: e.target.value })} placeholder="Contact name" className="input-ink text-sm" />
                  <input value={profileForm.contact_email || ""} onChange={(e) => setProfileForm({ ...profileForm, contact_email: e.target.value })} placeholder="Contact email" className="input-ink text-sm" />
                  <input value={profileForm.contact_phone || ""} onChange={(e) => setProfileForm({ ...profileForm, contact_phone: e.target.value })} placeholder="Phone" className="input-ink text-sm" />
                  <input value={profileForm.industry || ""} onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })} placeholder="Industry" className="input-ink text-sm" />
                  <input value={profileForm.website || ""} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="Website" className="input-ink text-sm" />
                  <input value={profileForm.address || ""} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} placeholder="Address" className="input-ink text-sm" />
                  <select value={profileForm.plan_tier || "professional"} onChange={(e) => setProfileForm({ ...profileForm, plan_tier: e.target.value as CompanyUpdatePayload["plan_tier"] })} className="input-ink text-sm">
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <textarea value={profileForm.notes || ""} onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })} placeholder="Internal notes" rows={3} className="input-ink resize-y text-sm" />
                  <button type="button" disabled={saving} onClick={() => onSaveCompany(profileForm)} className="btn-ink text-sm">
                    {saving ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </div>

              <div>
                <p className="mono-label">Usage Snapshot</p>
                <div className="mt-4 grid grid-cols-3 gap-px bg-ink-800">
                  {[
                    { l: "Admins", v: detail.admin_count },
                    { l: "Employees", v: detail.employee_count },
                    { l: "Databases", v: detail.database_count },
                  ].map(({ l, v }) => (
                    <div key={l} className="bg-ink-950 p-4 text-center">
                      <p className="text-2xl font-bold text-white">{v}</p>
                      <p className="mono-label mt-1 text-[9px]">{l}</p>
                    </div>
                  ))}
                </div>
                <p className="mono-label mt-8">Quota overrides</p>
                <p className="mt-2 text-xs text-ink-500">Leave blank to use platform defaults.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <input type="number" value={quotaForm.quota_queries_per_day ?? ""} onChange={(e) => setQuotaForm({ ...quotaForm, quota_queries_per_day: e.target.value ? Number(e.target.value) : undefined })} placeholder="Queries / day" className="input-ink text-sm" />
                  <input type="number" value={quotaForm.quota_max_rows ?? ""} onChange={(e) => setQuotaForm({ ...quotaForm, quota_max_rows: e.target.value ? Number(e.target.value) : undefined })} placeholder="Max rows" className="input-ink text-sm" />
                  <input type="number" value={quotaForm.quota_max_databases ?? ""} onChange={(e) => setQuotaForm({ ...quotaForm, quota_max_databases: e.target.value ? Number(e.target.value) : undefined })} placeholder="Max databases" className="input-ink text-sm" />
                  <input type="number" value={quotaForm.quota_concurrent_jobs ?? ""} onChange={(e) => setQuotaForm({ ...quotaForm, quota_concurrent_jobs: e.target.value ? Number(e.target.value) : undefined })} placeholder="Concurrent jobs" className="input-ink text-sm" />
                </div>
                <button type="button" disabled={saving} onClick={() => onSaveQuotas(quotaForm)} className="btn-ghost mt-4 w-full text-sm">
                  {saving ? "Saving…" : "Save quotas"}
                </button>
                <button type="button" onClick={() => onToggleStatus(!detail.is_active)} className="btn-ghost mt-4 w-full text-sm">
                  {detail.is_active ? "Deactivate Client" : "Reactivate Client"}
                </button>
                <p className="mt-4 font-mono text-[10px] text-ink-600">
                  Onboarded {new Date(detail.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div id={SECTION_IDS.companyAdmins} className="scroll-mt-8 border-t border-ink-800 pt-8">
              <p className="mono-label">Company Administrators</p>
              <p className="mt-2 text-sm text-ink-500">Assign multiple admins. Each can manage data sources, employees, and permissions.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {detail.admins.length === 0 ? (
                  <p className="text-sm text-ink-600 sm:col-span-2">No admins yet — add the first account below.</p>
                ) : (
                  detail.admins.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between border border-ink-800 bg-black px-5 py-4">
                      <div>
                        <p className="font-medium text-white">{admin.full_name || admin.email}</p>
                        <p className="text-sm text-ink-500">{admin.email}</p>
                        <p className="mt-1 font-mono text-[10px] text-ink-600">
                          Added {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button type="button" onClick={() => onDeleteAdmin(admin.id, admin.email)} className="btn-ghost text-xs text-ink-500 hover:text-white">
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-8 border border-ink-700 bg-ink-950 p-6">
                <p className="mono-label">Add Company Admin</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input value={adminForm.fullName} onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })} placeholder="Full name" className="input-ink text-sm" />
                  <input value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="Work email" className="input-ink text-sm" />
                  <input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Password (min 8)" className="input-ink text-sm sm:col-span-2" />
                </div>
                <button type="button" onClick={onAssignAdmin} disabled={assigning || !adminForm.email || !adminForm.password} className="btn-ink mt-4 text-sm">
                  {assigning ? "Creating…" : "Create Admin Account"}
                </button>
              </div>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
