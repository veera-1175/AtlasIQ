import { useMemo, useState } from "react";
import { CompanyCreatePayload, CompanyItem } from "../../api";
import { SECTION_IDS } from "../../sections";
import PlatformSectionHeader from "./PlatformSectionHeader";

const PLAN_STYLES: Record<string, string> = {
  starter: "border-ink-600 text-ink-400",
  professional: "border-ink-400 text-ink-200",
  enterprise: "border-white text-white",
};

const INDUSTRY_OPTIONS = [
  "Healthcare",
  "Finance",
  "Banking",
  "Retail",
  "E-commerce",
  "Technology",
  "SaaS",
  "Manufacturing",
  "Logistics",
  "Education",
  "Hospitality",
  "Real Estate",
  "Consulting",
  "Insurance",
  "Media",
];

interface Props {
  tab: "directory" | "onboard";
  onTabChange: (tab: "directory" | "onboard") => void;
  companies: CompanyItem[];
  createForm: CompanyCreatePayload;
  setCreateForm: (f: CompanyCreatePayload) => void;
  creating: boolean;
  onCreate: () => void;
  onManage: (c: CompanyItem) => void;
  onToggleStatus: (id: string, active: boolean) => void;
}

export default function PlatformClients({
  tab, onTabChange, companies, createForm, setCreateForm, creating,
  onCreate, onManage, onToggleStatus,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (filterStatus === "active" && !c.is_active) return false;
      if (filterStatus === "inactive" && c.is_active) return false;
      if (filterPlan && c.plan_tier !== filterPlan) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.industry || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [companies, search, filterPlan, filterStatus]);

  const plans = [...new Set(companies.map((c) => c.plan_tier).filter(Boolean))];

  return (
    <div className="animate-fade-in space-y-10">
      <PlatformSectionHeader
        label="Client Management"
        description="AtlasIQ clients are tenant organizations. Create the company first with full business details, then assign one or more company administrators who manage data and employees."
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onTabChange("directory")} className={tab === "directory" ? "btn-tab btn-tab-active" : "btn-tab"}>
          Client Directory ({companies.length})
        </button>
        <button type="button" onClick={() => onTabChange("onboard")} className={tab === "onboard" ? "btn-tab btn-tab-active" : "btn-tab"}>
          Onboard New Client
        </button>
      </div>

      {tab === "directory" && (
        <>
          <div className="panel flex flex-wrap gap-4 p-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or industry…"
              className="input-ink min-w-[200px] flex-1 text-sm"
            />
            <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="input-ink text-sm">
              <option value="">All plans</option>
              {plans.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="input-ink text-sm">
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div id={SECTION_IDS.clientDirectory} className="panel scroll-mt-28 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-800 bg-ink-900">
                <tr>
                  <th className="mono-label px-6 py-4">Company</th>
                  <th className="mono-label px-6 py-4">Contact</th>
                  <th className="mono-label px-6 py-4">Plan</th>
                  <th className="mono-label px-6 py-4">Admins</th>
                  <th className="mono-label px-6 py-4">Users</th>
                  <th className="mono-label px-6 py-4">DBs</th>
                  <th className="mono-label px-6 py-4">Status</th>
                  <th className="mono-label px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-ink-500">No clients match your filters.</td></tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b border-ink-900 transition-colors hover:bg-ink-900/50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{c.name}</p>
                        <p className="text-xs text-ink-600">{c.industry || "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-400">
                        {c.contact_email || c.admin_email || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`tag capitalize ${PLAN_STYLES[c.plan_tier || "starter"] || ""}`}>
                          {c.plan_tier || "starter"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-ink-300">{c.admin_count}</td>
                      <td className="px-6 py-4 text-ink-300">{c.employee_count}</td>
                      <td className="px-6 py-4 text-ink-300">{c.database_count}</td>
                      <td className="px-6 py-4">
                        <span className={`tag ${c.is_active ? "border-white text-white" : ""}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => onManage(c)} className="btn-ink px-3 py-1.5 text-[10px]">Manage</button>
                          <button type="button" onClick={() => onToggleStatus(c.id, !c.is_active)} className="btn-ghost px-3 py-1.5 text-[10px]">
                            {c.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "onboard" && (
        <div className="grid items-start gap-8 xl:grid-cols-12">
          <div className="panel-elevated p-8 xl:col-span-8">
            <p className="mono-label">Step 1 — Company profile</p>
            <p className="mt-2 text-sm text-ink-500">Required: company name. After creation, open the client to add administrators (Step 2).</p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mono-label mb-2 block">Company Name *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="input-ink" placeholder="Acme Corporation" />
              </div>
              <div>
                <label className="mono-label mb-2 block">Primary Contact</label>
                <input value={createForm.contact_name ?? ""} onChange={(e) => setCreateForm({ ...createForm, contact_name: e.target.value })} className="input-ink" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="mono-label mb-2 block">Contact Email</label>
                <input value={createForm.contact_email ?? ""} onChange={(e) => setCreateForm({ ...createForm, contact_email: e.target.value })} className="input-ink" placeholder="jane@acme.com" />
              </div>
              <div>
                <label className="mono-label mb-2 block">Phone</label>
                <input value={createForm.contact_phone ?? ""} onChange={(e) => setCreateForm({ ...createForm, contact_phone: e.target.value })} className="input-ink" placeholder="+1 555 0100" />
              </div>
              <div>
                <label className="mono-label mb-2 block">Industry</label>
                <select
                  value={createForm.industry ?? ""}
                  onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                  className="input-ink w-full"
                >
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono-label mb-2 block">Website</label>
                <input value={createForm.website ?? ""} onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })} className="input-ink" placeholder="https://acme.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="mono-label mb-2 block">Address</label>
                <input value={createForm.address ?? ""} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} className="input-ink" placeholder="HQ address" />
              </div>
              <div>
                <label className="mono-label mb-2 block">Subscription Plan</label>
                <select value={createForm.plan_tier ?? "starter"} onChange={(e) => setCreateForm({ ...createForm, plan_tier: e.target.value as CompanyCreatePayload["plan_tier"] })} className="input-ink w-full">
                  <option value="starter">Starter — small teams</option>
                  <option value="professional">Professional — growing orgs</option>
                  <option value="enterprise">Enterprise — warehouse scale</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mono-label mb-2 block">Internal Notes</label>
                <textarea value={createForm.notes ?? ""} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} rows={4} className="input-ink resize-y" placeholder="Contract details, SLA, account manager…" />
              </div>
            </div>
            <button type="button" onClick={onCreate} disabled={creating || !createForm.name.trim()} className="btn-ink mt-8">
              {creating ? "Onboarding…" : "Create Client Company"}
            </button>
          </div>

          <div className="space-y-6 xl:col-span-4 xl:sticky xl:top-6">
            <div className="panel p-6">
              <p className="mono-label">After creation</p>
              <ol className="mt-4 list-decimal space-y-3 pl-4 text-sm text-ink-400">
                <li>Click <strong className="text-white">Manage</strong> on the new client</li>
                <li>Add one or more company admins</li>
                <li>Admin connects databases & creates employees</li>
                <li>Employees query within table permissions</li>
              </ol>
            </div>
            <div className="panel border-l-2 border-white p-6">
              <p className="mono-label">Privacy boundary</p>
              <p className="mt-3 text-sm text-ink-500">
                Platform admins never see client query results or database contents. You manage accounts and metadata only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
