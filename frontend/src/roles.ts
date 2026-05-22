export type Page =
  | "platform-dashboard"
  | "platform-clients"
  | "platform-analytics"
  | "platform-audit"
  | "overview"
  | "databases"
  | "analytics"
  | "schema"
  | "history"
  | "reports"
  | "admin-team"
  | "admin-activity"
  | "admin-analytics"
  | "admin-audit"
  | "admin-employee"
  | "admin-profile"
  | "employee-profile"
  | "my-usage";

export type PlatformRole = "super_admin" | "company_admin" | "employee";

export function roleLabel(role: string): string {
  if (role === "super_admin") return "Platform Admin";
  if (role === "company_admin") return "Company Admin";
  return "Employee";
}

export function defaultPage(role: string): Page {
  if (role === "super_admin") return "platform-dashboard";
  return "overview";
}

export function isPageAllowed(role: string, page: Page): boolean {
  if (role === "super_admin") {
    return ["platform-dashboard", "platform-clients", "platform-analytics", "platform-audit"].includes(page);
  }
  if (role === "company_admin") {
    return [
      "overview", "databases", "analytics", "schema", "history", "reports",
      "admin-team", "admin-activity", "admin-analytics", "admin-audit", "admin-employee", "admin-profile",
    ].includes(page);
  }
  return ["overview", "analytics", "schema", "history", "reports", "my-usage", "employee-profile"].includes(page);
}

export function pageTitle(page: Page, companyName?: string | null): string {
  const titles: Record<Page, string> = {
    "platform-dashboard": "Command Center",
    "platform-clients": "Client Companies",
    "platform-analytics": "Usage Analytics",
    "platform-audit": "Audit & Compliance",
    overview: companyName ? `${companyName} Dashboard` : "Dashboard",
    databases: "Data Sources",
    analytics: "Query Studio",
    schema: "Schema Explorer",
    history: "Query History",
    reports: "Scheduled Reports",
    "admin-team": "Team & Access",
    "admin-activity": "Employee Activity",
    "admin-analytics": "Usage Analytics",
    "admin-audit": "Audit Log",
    "admin-employee": "Employee Profile",
    "admin-profile": "Admin Profile",
    "employee-profile": "My Profile",
    "my-usage": "My Usage",
  };
  return titles[page];
}
