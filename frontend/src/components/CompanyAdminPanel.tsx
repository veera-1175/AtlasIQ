import { useCallback, useEffect, useState } from "react";
import {
  ActivityItem,
  AuditLogItem,
  CompanyAnalytics,
  CompanyStats,
  createEmployee,
  deleteEmployee,
  DesignationList,
  EmployeeItem,
  fetchCompanyActivity,
  fetchCompanyAnalytics,
  fetchCompanyAudit,
  fetchCompanyDesignations,
  fetchCompanyEmployees,
  fetchCompanyStats,
  fetchCompanyTables,
} from "../api";
import { suggestTablesForDesignation } from "../designations";
import { useNotification } from "../notification";
import { SECTION_IDS } from "../sections";
import CompanyAuditLog from "./company/CompanyAuditLog";
import CompanyPasswordRequests from "./company/CompanyPasswordRequests";
import CompanyTableAccessRequests from "./company/CompanyTableAccessRequests";
import CompanyQueryTemplates from "./company/CompanyQueryTemplates";
import CompanyEmployeeActivity from "./company/CompanyEmployeeActivity";
import CompanyUsageAnalytics from "./company/CompanyUsageAnalytics";
import EditEmployeeModal from "./company/EditEmployeeModal";

type Section = "admin-team" | "admin-activity" | "admin-analytics" | "admin-audit";

const EMPTY_FORM = {
  employeeId: "",
  email: "",
  password: "",
  fullName: "",
  designation: "",
  selectedTables: [] as string[],
};

const SECTION_META: Record<Section, { label: string; title: string; desc: string }> = {
  "admin-team": {
    label: "Team Management",
    title: "Team & Access Control",
    desc: "Create employee accounts, assign designations and table-level permissions. Only company admins can manage data sources.",
  },
  "admin-activity": {
    label: "Activity Monitor",
    title: "Employee Activity",
    desc: "Full visibility into every query, report, and action performed by your team.",
  },
  "admin-analytics": {
    label: "Usage Intelligence",
    title: "Usage Analytics",
    desc: "Team adoption, query performance, department breakdown, and daily usage trends.",
  },
  "admin-audit": {
    label: "Compliance",
    title: "Audit Log",
    desc: "Immutable record of administrative and user actions within your organization.",
  },
};

interface Props {
  section: Section;
  onViewEmployee?: (employeeId: string) => void;
}

export default function CompanyAdminPanel({ section, onViewEmployee }: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const meta = SECTION_META[section];
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [designations, setDesignations] = useState<DesignationList>({ designations: [], table_hints: {} });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("");
  const [filterEmpId, setFilterEmpId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filterSearch), 300);
    return () => window.clearTimeout(timer);
  }, [filterSearch]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        department: filterDept || undefined,
        employee_id: filterEmpId || undefined,
        search: debouncedSearch || undefined,
        includeInactive: showInactive,
      };
      if (section === "admin-team") {
        const [st, des, tables, emps] = await Promise.all([
          fetchCompanyStats(),
          fetchCompanyDesignations(),
          fetchCompanyTables(),
          fetchCompanyEmployees(filters),
        ]);
        setStats(st);
        setDesignations(des);
        setAvailableTables(tables);
        setEmployees(emps);
      } else if (section === "admin-activity") {
        const [st, act, an, emps] = await Promise.all([
          fetchCompanyStats(),
          fetchCompanyActivity(undefined, 200),
          fetchCompanyAnalytics(),
          fetchCompanyEmployees(),
        ]);
        setStats(st);
        setActivity(act);
        setAnalytics(an);
        setEmployees(emps);
      } else if (section === "admin-analytics") {
        setAnalytics(await fetchCompanyAnalytics());
      } else {
        const [st, logs] = await Promise.all([fetchCompanyStats(), fetchCompanyAudit(200)]);
        setStats(st);
        setAudit(logs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company admin data");
    } finally {
      setLoading(false);
    }
  }, [section, filterDept, filterEmpId, debouncedSearch, showInactive]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (section !== "admin-team") return;
    if (designations.designations.length && !form.designation) {
      setForm((prev) => ({ ...prev, designation: designations.designations[0] }));
    }
  }, [designations, form.designation, section]);

  function toggleTable(table: string) {
    setForm((prev) => ({
      ...prev,
      selectedTables: prev.selectedTables.includes(table)
        ? prev.selectedTables.filter((t) => t !== table)
        : [...prev.selectedTables, table],
    }));
  }

  function handleDesignationChange(designation: string) {
    const suggested = suggestTablesForDesignation(designation, availableTables, designations.table_hints);
    setForm((prev) => ({
      ...prev,
      designation,
      selectedTables: suggested.length ? suggested : prev.selectedTables,
    }));
  }

  async function handleSubmit() {
    if (!form.employeeId.trim()) { setError("Enter an employee ID"); return; }
    if (!form.designation) { setError("Select a designation"); return; }
    if (availableTables.length > 0 && form.selectedTables.length === 0) {
      setError("Select at least one table for this employee");
      return;
    }
    try {
      await createEmployee(
        form.email,
        form.password,
        form.fullName,
        form.employeeId.trim(),
        form.designation,
        form.selectedTables,
      );
      setForm({ ...EMPTY_FORM, designation: designations.designations[0] || "" });
      await refresh();
      notifySuccess("Employee created successfully", {
        page: "admin-team",
        scrollTo: SECTION_IDS.employeeList,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create employee";
      setError(message);
      notifyError(message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this employee account?")) return;
    try {
      await deleteEmployee(id);
      await refresh();
      notifySuccess("Employee deactivated", { page: "admin-team", scrollTo: SECTION_IDS.employeeList });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to deactivate employee";
      setError(message);
      notifyError(message);
    }
  }

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];

  return (
    <div className="space-y-10">
      <div>
        <p className="mono-label">{meta.label}</p>
        <h3 className="mt-2 text-3xl font-bold text-white">{meta.title}</h3>
        <p className="section-desc mt-2">{meta.desc}</p>
      </div>

      {error && (
        <div className="flex items-center justify-between border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
          {error}
          <button type="button" onClick={() => setError(null)} className="mono-label hover:text-white">Dismiss</button>
        </div>
      )}

      {stats && section === "admin-team" && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Employees", value: stats.employee_count },
            { label: "Databases", value: stats.database_count },
            { label: "Queries", value: stats.total_queries },
            { label: "Success Rate", value: `${stats.success_rate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="kpi-card">
              <p className="mono-label">{label}</p>
              <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {section === "admin-team" && (
        <>
          <CompanyPasswordRequests />
          <CompanyTableAccessRequests />
          <CompanyQueryTemplates designations={designations} />

          <div className="panel flex flex-wrap gap-4 p-6">
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search name, email, ID…"
              className="input-ink min-w-[200px] flex-1 text-sm"
            />
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-ink text-sm">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input
              value={filterEmpId}
              onChange={(e) => setFilterEmpId(e.target.value)}
              placeholder="Employee ID"
              className="input-ink w-40 text-sm"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-400">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              Show inactive
            </label>
          </div>

          <div className="grid gap-8 xl:grid-cols-12">
            <div className="panel p-8 xl:col-span-5">
              <p className="mono-label">New Employee</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mono-label mb-2 block">Employee ID</label>
                  <input
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="e.g. EMP-1042, A-007"
                    className="input-ink font-mono"
                    autoComplete="off"
                  />
                </div>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                  className="input-ink"
                  autoComplete="email"
                />
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Full name"
                  className="input-ink"
                  autoComplete="off"
                />
                <div>
                  <label className="mono-label mb-1 block">Designation</label>
                  {designations.industry && (
                    <p className="mb-3 text-xs text-ink-500">Roles for {designations.industry} industry</p>
                  )}
                  <select value={form.designation} onChange={(e) => handleDesignationChange(e.target.value)} className="input-ink w-full">
                    <option value="">Select designation</option>
                    {designations.designations.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="mono-label">Allowed Tables</label>
                    {availableTables.length > 0 && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setForm((p) => ({ ...p, selectedTables: [...availableTables] }))} className="btn-ghost px-2 py-1 text-[10px]">All</button>
                        <button type="button" onClick={() => setForm((p) => ({ ...p, selectedTables: [] }))} className="btn-ghost px-2 py-1 text-[10px]">Clear</button>
                      </div>
                    )}
                  </div>
                  {availableTables.length === 0 ? (
                    <p className="border border-ink-800 bg-black px-4 py-3 text-sm text-ink-500">
                      Connect a database under Data Sources first.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto border border-ink-800 bg-black p-4">
                      {availableTables.map((table) => (
                        <label key={table} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm text-ink-300 hover:bg-ink-900">
                          <input type="checkbox" checked={form.selectedTables.includes(table)} onChange={() => toggleTable(table)} className="h-4 w-4 accent-white" />
                          <span className="font-mono text-xs">{table}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password (min 8 chars)"
                  className="input-ink"
                  autoComplete="new-password"
                />
              </div>
              <div className="mt-6">
                <button type="button" onClick={handleSubmit} className="btn-ink w-full">Create Employee</button>
              </div>
            </div>

            <div id={SECTION_IDS.employeeList} className="panel scroll-mt-28 overflow-hidden xl:col-span-7">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-800 bg-ink-900">
                  <tr>
                    <th className="mono-label px-6 py-4">Employee</th>
                    <th className="mono-label px-6 py-4">ID / Dept</th>
                    <th className="mono-label px-6 py-4">Tables</th>
                    <th className="mono-label px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-ink-500">No employees match your filters.</td></tr>
                  )}
                  {employees.map((emp) => (
                    <tr key={emp.id} className={`border-b border-ink-900 ${emp.is_active === false ? "opacity-50" : ""}`}>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => onViewEmployee?.(emp.id)}
                          className="row-link"
                        >
                          <p className="font-medium text-white">
                            {emp.full_name || emp.email}
                            {emp.is_active === false && (
                              <span className="ml-2 text-[10px] uppercase text-ink-500">Inactive</span>
                            )}
                          </p>
                          <p className="text-xs text-ink-500">{emp.email}</p>
                          <p className="text-xs text-ink-600">{emp.designation || "—"}</p>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-400">
                        <p className="font-mono">{emp.employee_id || "—"}</p>
                        <p className="mt-1">{emp.department || "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-500">{(emp.allowed_tables || []).join(", ") || "None"}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => onViewEmployee?.(emp.id)} className="btn-ghost text-xs">View</button>
                          <button type="button" onClick={() => setEditingEmployee(emp)} className="btn-ghost text-xs">Edit</button>
                          <button type="button" onClick={() => handleDelete(emp.id)} className="btn-ghost text-xs">Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <EditEmployeeModal
            open={editingEmployee !== null}
            employee={editingEmployee}
            designations={designations}
            availableTables={availableTables}
            onClose={() => setEditingEmployee(null)}
            onSaved={refresh}
          />
        </>
      )}

      {section === "admin-activity" && loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
        </div>
      )}

      {section === "admin-activity" && !loading && (
        <CompanyEmployeeActivity
          activity={activity}
          stats={stats}
          analytics={analytics}
          employees={employees}
          onViewEmployee={onViewEmployee}
          onRefresh={refresh}
        />
      )}

      {section === "admin-analytics" && loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
        </div>
      )}

      {section === "admin-analytics" && !loading && (
        <CompanyUsageAnalytics analytics={analytics} onViewEmployee={onViewEmployee} />
      )}

      {section === "admin-audit" && loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
        </div>
      )}

      {section === "admin-audit" && !loading && (
        <CompanyAuditLog audit={audit} onRefresh={refresh} />
      )}
    </div>
  );
}
