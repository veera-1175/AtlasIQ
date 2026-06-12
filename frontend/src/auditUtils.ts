export function formatAuditDetails(details: string | null | undefined): string {
  if (!details) return "—";
  try {
    const data = JSON.parse(details);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Object.entries(data)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => {
          const label = k.replace(/_/g, " ");
          if (Array.isArray(v)) return `${label}: ${v.join(", ")}`;
          return `${label}: ${String(v)}`;
        })
        .join(" · ");
    }
  } catch {
    /* plain text */
  }
  return details;
}

export function auditCategory(action: string): "Team" | "Security" | "Data" | "Profile" | "Query" | "System" {
  if (action.startsWith("employee.")) return "Team";
  if (action.startsWith("admin.password") || action.includes("avatar")) return "Security";
  if (action.startsWith("database.")) return "Data";
  if (action.startsWith("admin.profile")) return "Profile";
  if (action.startsWith("query.")) return "Query";
  return "System";
}

export function categoryBadgeClass(category: ReturnType<typeof auditCategory>): string {
  const map: Record<string, string> = {
    Team: "border-ink-400 text-ink-200",
    Security: "border-white text-white",
    Data: "border-ink-500 text-ink-300",
    Profile: "border-ink-500 text-ink-300",
    Query: "border-ink-600 text-ink-400",
    System: "border-ink-700 text-ink-500",
  };
  return map[category] || map.System;
}
