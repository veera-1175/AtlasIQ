const AUDIT_LABELS: Record<string, string> = {
  "company.created": "Client company onboarded",
  "company.updated": "Client company updated",
  "company.deactivated": "Client company deactivated",
  "company.reactivated": "Client company reactivated",
  "admin.created": "Company admin created",
  "admin.deleted": "Company admin removed",
  "admin.profile_updated": "Admin profile updated",
  "admin.avatar_updated": "Profile picture updated",
  "admin.avatar_removed": "Profile picture removed",
  "admin.password_change_requested": "Password change requested",
  "admin.password_change_approved": "Password change approved",
  "admin.password_change_rejected": "Password change rejected",
  "employee.created": "Employee account created",
  "employee.updated": "Employee account updated",
  "employee.deactivated": "Employee account deactivated",
  "employee.profile_updated": "Employee profile updated",
  "employee.avatar_updated": "Profile picture updated",
  "employee.avatar_removed": "Profile picture removed",
  "employee.password_change_requested": "Password change requested",
  "employee.password_change_approved": "Password change approved",
  "employee.password_change_rejected": "Password change rejected",
  "employee.table_access_requested": "Table access requested",
  "employee.table_access_approved": "Table access approved",
  "employee.table_access_rejected": "Table access rejected",
  "query_template.created": "Query template published",
  "database.uploaded": "Data source connected",
  "database.removed": "Data source removed",
  "query.executed": "Query executed",
  "query.failed": "Query failed",
};

export function suggestTablesForDesignation(
  designation: string,
  availableTables: string[],
  hints: Record<string, string[]>,
): string[] {
  const patterns = hints[designation] || [];
  if (designation === "Manager") return [...availableTables];
  if (!patterns.length) return [];

  return availableTables.filter((table) => {
    const lower = table.toLowerCase();
    return patterns.some((hint: string) => lower.includes(hint));
  });
}

export function formatAuditAction(action: string): string {
  return AUDIT_LABELS[action] || action.replace(/\./g, " ");
}
