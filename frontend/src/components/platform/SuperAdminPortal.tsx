import { useCallback, useEffect, useState } from "react";
import {
  assignCompanyAdmin,
  CompanyCreatePayload,
  CompanyDetail,
  CompanyItem,
  createCompany,
  deleteCompanyAdmin,
  fetchAdminAnalytics,
  fetchAdminAudit,
  fetchAdminCompanies,
  fetchAdminStats,
  fetchCompanyDetail,
  fetchPlatformFeatures,
  PlatformAnalytics as PlatformAnalyticsData,
  PlatformFeatures,
  PlatformStats,
  setCompanyStatus,
  updateCompany,
  updateCompanyQuotas,
} from "../../api";
import { useNotification } from "../../notification";
import { Page } from "../../roles";
import { SECTION_IDS } from "../../sections";
import CompanyDetailModal from "./CompanyDetailModal";
import PlatformAnalytics from "./PlatformAnalytics";
import PlatformAudit from "./PlatformAudit";
import PlatformPasswordRequests from "./PlatformPasswordRequests";
import PlatformClients from "./PlatformClients";
import PlatformDashboard from "./PlatformDashboard";

type Section = "platform-dashboard" | "platform-clients" | "platform-analytics" | "platform-audit";

const EMPTY_CREATE: CompanyCreatePayload = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  website: "",
  address: "",
  plan_tier: "starter",
  notes: "",
};

const EMPTY_ADMIN = { email: "", fullName: "", password: "" };

function buildCreatePayload(form: CompanyCreatePayload): CompanyCreatePayload {
  const payload: CompanyCreatePayload = { name: form.name.trim() };
  if (form.contact_name?.trim()) payload.contact_name = form.contact_name.trim();
  if (form.contact_email?.trim()) payload.contact_email = form.contact_email.trim();
  if (form.contact_phone?.trim()) payload.contact_phone = form.contact_phone.trim();
  if (form.industry?.trim()) payload.industry = form.industry.trim();
  if (form.website?.trim()) payload.website = form.website.trim();
  if (form.address?.trim()) payload.address = form.address.trim();
  if (form.plan_tier) payload.plan_tier = form.plan_tier;
  if (form.notes?.trim()) payload.notes = form.notes.trim();
  return payload;
}

interface Props {
  section: string;
  onNavigate: (page: Page) => void;
}

export default function SuperAdminPortal({ section, onNavigate }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const activeSection = section as Section;

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalyticsData | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof fetchAdminAudit>>>([]);
  const [features, setFeatures] = useState<PlatformFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientsTab, setClientsTab] = useState<"directory" | "onboard">("directory");
  const [createForm, setCreateForm] = useState<CompanyCreatePayload>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);

  const [manageCompany, setManageCompany] = useState<CompanyItem | null>(null);
  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminForm, setAdminForm] = useState({ ...EMPTY_ADMIN });
  const [assigning, setAssigning] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeSection === "platform-dashboard") {
        const [st, cos, an, feat] = await Promise.all([
          fetchAdminStats(),
          fetchAdminCompanies(),
          fetchAdminAnalytics(),
          fetchPlatformFeatures(),
        ]);
        setStats(st);
        setCompanies(cos);
        setAnalytics(an);
        setFeatures(feat);
      } else if (activeSection === "platform-clients") {
        setCompanies(await fetchAdminCompanies());
      } else if (activeSection === "platform-analytics") {
        setAnalytics(await fetchAdminAnalytics());
      } else if (activeSection === "platform-audit") {
        setAudit(await fetchAdminAudit());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platform data");
    } finally {
      setLoading(false);
    }
  }, [activeSection]);

  const refreshCompanyDetail = useCallback(async (companyId: string) => {
    setDetailLoading(true);
    try {
      setCompanyDetail(await fetchCompanyDetail(companyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company details");
      setManageCompany(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (manageCompany) {
      setAdminForm({ ...EMPTY_ADMIN });
      refreshCompanyDetail(manageCompany.id);
    } else {
      setCompanyDetail(null);
    }
  }, [manageCompany, refreshCompanyDetail]);

  async function handleCreate() {
    if (!createForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createCompany(buildCreatePayload(createForm));
      setCreateForm({ ...EMPTY_CREATE });
      setClientsTab("directory");
      await refresh();
      notifySuccess(`"${created.name}" onboarded — open Manage to add administrators`, {
        page: "platform-clients",
        scrollTo: SECTION_IDS.clientDirectory,
        onAfterNavigate: () => setClientsTab("directory"),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to onboard client";
      setError(message);
      notifyError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(companyId: string, active: boolean) {
    try {
      await setCompanyStatus(companyId, active);
      if (manageCompany?.id === companyId) await refreshCompanyDetail(companyId);
      await refresh();
      notifySuccess(`Client ${active ? "activated" : "deactivated"}`, {
        page: "platform-clients",
        scrollTo: SECTION_IDS.clientDirectory,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update company status";
      setError(message);
      notifyError(message);
    }
  }

  async function handleAssignAdmin() {
    if (!manageCompany || !adminForm.email || !adminForm.password) return;
    setAssigning(true);
    const email = adminForm.email;
    try {
      await assignCompanyAdmin(manageCompany.id, adminForm.email, adminForm.password, adminForm.fullName);
      setAdminForm({ ...EMPTY_ADMIN });
      await refreshCompanyDetail(manageCompany.id);
      await refresh();
      notifySuccess(`Admin ${email} created successfully`, { scrollTo: SECTION_IDS.companyAdmins });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add admin";
      setError(message);
      notifyError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleSaveCompany(payload: Parameters<typeof updateCompany>[1]) {
    if (!manageCompany) return;
    setSavingCompany(true);
    try {
      setCompanyDetail(await updateCompany(manageCompany.id, payload));
      await refresh();
      notifySuccess("Company profile updated");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to update company");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveQuotas(payload: Parameters<typeof updateCompanyQuotas>[1]) {
    if (!manageCompany) return;
    setSavingCompany(true);
    try {
      setCompanyDetail(await updateCompanyQuotas(manageCompany.id, payload));
      notifySuccess("Quota overrides saved");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to update quotas");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleDeleteAdmin(adminId: string, email: string) {
    if (!manageCompany) return;
    if (!confirm(`Permanently remove admin ${email}?`)) return;
    try {
      await deleteCompanyAdmin(manageCompany.id, adminId);
      await refreshCompanyDetail(manageCompany.id);
      await refresh();
      notifySuccess(`Admin ${email} removed`, { scrollTo: SECTION_IDS.companyAdmins });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete admin";
      setError(message);
      notifyError(message);
    }
  }

  if (loading && !stats && !analytics && audit.length === 0 && companies.length === 0) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-center justify-between border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
          {error}
          <button type="button" onClick={() => setError(null)} className="mono-label hover:text-white">Dismiss</button>
        </div>
      )}

      {activeSection === "platform-dashboard" && stats && (
        <PlatformDashboard
          stats={stats}
          companies={companies}
          analytics={analytics}
          features={features}
          onNavigate={onNavigate}
        />
      )}

      {activeSection === "platform-clients" && (
        <PlatformClients
          tab={clientsTab}
          onTabChange={setClientsTab}
          companies={companies}
          createForm={createForm}
          setCreateForm={setCreateForm}
          creating={creating}
          onCreate={handleCreate}
          onManage={setManageCompany}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {activeSection === "platform-analytics" && analytics && (
        <PlatformAnalytics analytics={analytics} />
      )}

      {activeSection === "platform-audit" && (
        <div className="space-y-12">
          <PlatformPasswordRequests />
          <PlatformAudit audit={audit} />
        </div>
      )}

      {manageCompany && (
        <CompanyDetailModal
          open={!!manageCompany}
          detail={companyDetail}
          loading={detailLoading}
          adminForm={adminForm}
          setAdminForm={setAdminForm}
          onClose={() => setManageCompany(null)}
          onAssignAdmin={handleAssignAdmin}
          onDeleteAdmin={handleDeleteAdmin}
          onToggleStatus={(active) => handleToggleStatus(manageCompany.id, active)}
          onSaveCompany={handleSaveCompany}
          onSaveQuotas={handleSaveQuotas}
          assigning={assigning}
          saving={savingCompany}
        />
      )}
    </div>
  );
}
