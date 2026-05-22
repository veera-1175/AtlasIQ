import { useEffect, useState } from "react";
import { DesignationList, EmployeeItem, updateEmployee } from "../../api";
import { suggestTablesForDesignation } from "../../designations";
import { useNotification } from "../../notification";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../Modal";

interface FormState {
  employeeId: string;
  fullName: string;
  designation: string;
  selectedTables: string[];
  password: string;
  isActive: boolean;
  securityNote: string;
}

interface Props {
  open: boolean;
  employee: EmployeeItem | null;
  designations: DesignationList;
  availableTables: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function EditEmployeeModal({
  open,
  employee,
  designations,
  availableTables,
  onClose,
  onSaved,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();
  const [form, setForm] = useState<FormState>({
    employeeId: "",
    fullName: "",
    designation: "",
    selectedTables: [],
    password: "",
    isActive: true,
    securityNote: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setForm({
      employeeId: employee.employee_id || "",
      fullName: employee.full_name || "",
      designation: employee.designation || designations.designations[0] || "",
      selectedTables: employee.allowed_tables || [],
      password: "",
      isActive: employee.is_active !== false,
      securityNote: employee.security_note || "",
    });
    setError(null);
  }, [open, employee, designations.designations]);

  if (!open || !employee) return null;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId.trim()) {
      setError("Enter an employee ID");
      return;
    }
    if (!form.designation) {
      setError("Select a designation");
      return;
    }
    if (availableTables.length > 0 && form.selectedTables.length === 0) {
      setError("Select at least one table for this employee");
      return;
    }
    if (!employee) return;
    setSaving(true);
    setError(null);
    try {
      await updateEmployee(employee.id, {
        full_name: form.fullName,
        employee_id: form.employeeId.trim(),
        designation: form.designation,
        allowed_tables: form.selectedTables,
        password: form.password || undefined,
        is_active: form.isActive,
        security_note: form.securityNote.trim() || undefined,
      });
      notifySuccess("Employee updated successfully");
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update employee";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="2xl" titleId="edit-employee-title">
      <ModalHeader
        label="Edit Employee"
        title={employee.full_name || employee.email}
        subtitle={employee.email}
        titleId="edit-employee-title"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ModalBody className="min-h-0 flex-1">
          <div className="grid h-full min-h-0 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-4">
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
              <div>
                <label className="mono-label mb-2 block">Full name</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Full name"
                  className="input-ink"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mono-label mb-1 block">Designation</label>
                {designations.industry && (
                  <p className="mb-3 text-xs text-ink-500">Roles for {designations.industry} industry</p>
                )}
                <select
                  value={form.designation}
                  onChange={(e) => handleDesignationChange(e.target.value)}
                  className="input-ink w-full"
                >
                  <option value="">Select designation</option>
                  {designations.designations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono-label mb-2 block">New password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Leave blank to keep current password (min 8 chars)"
                  className="input-ink"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mono-label mb-2 block">Security note (shown on employee profile)</label>
                <textarea
                  value={form.securityNote}
                  onChange={(e) => setForm({ ...form, securityNote: e.target.value })}
                  placeholder="e.g. Use VPN when working remotely. Report suspicious login activity."
                  className="input-ink min-h-[72px] w-full text-sm"
                  maxLength={500}
                />
              </div>
              <div className="flex items-center justify-between border border-ink-800 bg-black px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Account status</p>
                  <p className="text-xs text-ink-500">
                    {form.isActive ? "Employee can sign in" : "Deactivated — cannot sign in"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={form.isActive ? "btn-ghost text-xs" : "btn-ink text-xs"}
                >
                  {form.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <label className="mono-label">Allowed Tables</label>
                {availableTables.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, selectedTables: [...availableTables] }))}
                      className="btn-ghost px-2 py-1 text-[10px]"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, selectedTables: [] }))}
                      className="btn-ghost px-2 py-1 text-[10px]"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {availableTables.length === 0 ? (
                <p className="border border-ink-800 bg-black px-4 py-3 text-sm text-ink-500">
                  Connect a database under Data Sources first.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border border-ink-800 bg-black p-3">
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {availableTables.map((table) => (
                      <label
                        key={table}
                        className="flex cursor-pointer items-center gap-2 rounded border border-ink-900 px-2 py-2 text-sm text-ink-300 hover:border-ink-600 hover:bg-ink-900"
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedTables.includes(table)}
                          onChange={() => toggleTable(table)}
                          className="h-4 w-4 shrink-0 accent-white"
                        />
                        <span className="truncate font-mono text-[11px]">{table}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-6 border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
          )}
        </ModalBody>

        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-ink flex-1" disabled={saving}>
            {saving ? "Saving…" : "Update Employee"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
