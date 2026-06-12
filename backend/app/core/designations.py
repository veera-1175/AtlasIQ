EMPLOYEE_DESIGNATIONS: list[str] = [
    "Sales",
    "HR",
    "Finance",
    "Operations",
    "Marketing",
    "Analyst",
    "Manager",
]

INDUSTRY_DESIGNATIONS: dict[str, list[str]] = {
    "healthcare": [
        "Clinical Analyst", "Nurse", "Medical Records", "Compliance",
        "HR", "Finance", "Operations", "Manager",
    ],
    "finance": [
        "Financial Analyst", "Risk Analyst", "Accountant", "Compliance",
        "Sales", "Operations", "HR", "Manager",
    ],
    "banking": [
        "Financial Analyst", "Risk Analyst", "Relationship Manager", "Compliance",
        "Operations", "HR", "Finance", "Manager",
    ],
    "retail": [
        "Sales Associate", "Store Manager", "Inventory", "Marketing",
        "Finance", "HR", "Operations", "Manager",
    ],
    "e-commerce": [
        "Sales", "Marketing", "Customer Support", "Inventory",
        "Analyst", "Operations", "Finance", "Manager",
    ],
    "technology": [
        "Software Engineer", "Data Analyst", "Product Manager", "DevOps",
        "Sales", "Marketing", "HR", "Manager",
    ],
    "saas": [
        "Software Engineer", "Data Analyst", "Customer Success", "Sales",
        "Marketing", "HR", "Operations", "Manager",
    ],
    "manufacturing": [
        "Production", "Quality Control", "Supply Chain", "Safety Officer",
        "Operations", "Finance", "HR", "Manager",
    ],
    "logistics": [
        "Warehouse", "Fleet Coordinator", "Operations", "Analyst",
        "Finance", "HR", "Sales", "Manager",
    ],
    "education": [
        "Instructor", "Academic Analyst", "Administration", "Student Affairs",
        "HR", "Finance", "Operations", "Manager",
    ],
    "hospitality": [
        "Front Desk", "Guest Services", "Operations", "Sales",
        "Marketing", "Finance", "HR", "Manager",
    ],
    "real estate": [
        "Sales Agent", "Property Analyst", "Operations", "Marketing",
        "Finance", "HR", "Manager",
    ],
    "consulting": [
        "Consultant", "Analyst", "Project Manager", "Sales",
        "Operations", "HR", "Finance", "Manager",
    ],
    "insurance": [
        "Underwriter", "Claims Analyst", "Sales", "Compliance",
        "Operations", "Finance", "HR", "Manager",
    ],
    "media": [
        "Content Analyst", "Marketing", "Sales", "Operations",
        "Analyst", "HR", "Finance", "Manager",
    ],
}

# Substrings used to suggest table access when a database is connected.
DESIGNATION_TABLE_HINTS: dict[str, list[str]] = {
    "Sales": ["sales", "order", "customer", "product", "invoice", "deal"],
    "Sales Associate": ["sales", "order", "customer", "product", "invoice", "deal"],
    "Sales Agent": ["sales", "property", "client", "deal", "listing"],
    "HR": ["employee", "payroll", "department", "attendance", "leave", "staff"],
    "Finance": ["finance", "payment", "invoice", "ledger", "account", "expense", "budget"],
    "Financial Analyst": ["finance", "payment", "ledger", "account", "budget", "revenue"],
    "Accountant": ["finance", "ledger", "account", "expense", "invoice", "payment"],
    "Operations": ["inventory", "supply", "shipment", "warehouse", "operation", "logistics"],
    "Marketing": ["marketing", "campaign", "lead", "channel", "promotion"],
    "Analyst": ["report", "metric", "analytics", "summary"],
    "Data Analyst": ["report", "metric", "analytics", "summary", "data"],
    "Clinical Analyst": ["patient", "clinical", "medical", "diagnosis", "health", "treatment"],
    "Manager": [],
    "Store Manager": [],
    "Product Manager": ["product", "feature", "user", "customer"],
    "Project Manager": ["project", "task", "milestone", "client"],
    "Software Engineer": ["user", "product", "feature", "log", "event"],
    "DevOps": ["log", "server", "deploy", "metric", "incident"],
    "Inventory": ["inventory", "stock", "warehouse", "product", "supply"],
    "Supply Chain": ["supply", "inventory", "shipment", "vendor", "warehouse"],
    "Compliance": ["audit", "compliance", "policy", "risk", "regulation"],
    "Customer Support": ["customer", "ticket", "support", "issue", "feedback"],
    "Customer Success": ["customer", "account", "subscription", "usage"],
}

# Platform setup events — visible to AtlasIQ admin only, not company admins.
PLATFORM_AUDIT_ACTIONS: set[str] = {
    "company.created",
    "admin.created",
    "admin.deleted",
    "company.status_changed",
    "admin.password_change_requested",
    "admin.password_change_approved",
    "admin.password_change_rejected",
}


def designations_for_industry(industry: str | None) -> list[str]:
    if not industry or not str(industry).strip():
        return list(EMPLOYEE_DESIGNATIONS)
    key = str(industry).strip().lower()
    if key in INDUSTRY_DESIGNATIONS:
        return list(INDUSTRY_DESIGNATIONS[key])
    for pattern, roles in INDUSTRY_DESIGNATIONS.items():
        if pattern in key or key in pattern:
            return list(roles)
    return list(EMPLOYEE_DESIGNATIONS)


def validate_designation_for_industry(industry: str | None, designation: str) -> None:
    allowed = designations_for_industry(industry)
    if designation not in allowed:
        raise ValueError(f"Designation must be one of: {', '.join(allowed)}")


DESIGNATION_QUESTION_HINTS: dict[str, list[str]] = {
    "Sales": [
        "What were total sales last quarter?",
        "Who are our top 10 customers by revenue?",
        "How many orders were placed this month?",
    ],
    "HR": [
        "How many employees per department?",
        "What is the average attendance rate this month?",
        "List employees hired in the last 90 days",
    ],
    "Finance": [
        "Total revenue by month this year",
        "Outstanding invoices over 30 days",
        "Expense breakdown by category",
    ],
    "Operations": [
        "Current inventory levels by product",
        "Shipments completed this week",
        "Warehouse utilization summary",
    ],
    "Marketing": [
        "Campaign performance by channel",
        "Lead conversion rate this quarter",
        "Top marketing channels by ROI",
    ],
    "Analyst": [
        "Key metrics summary for last month",
        "Trend in daily active users",
        "Compare performance vs prior period",
    ],
    "Manager": [
        "Executive summary of key KPIs",
        "Department performance comparison",
        "What changed most vs last month?",
    ],
}


def suggest_questions_for_designation(designation: str) -> list[str]:
    if designation in DESIGNATION_QUESTION_HINTS:
        return list(DESIGNATION_QUESTION_HINTS[designation])
    lower = designation.lower()
    if "sales" in lower:
        return list(DESIGNATION_QUESTION_HINTS["Sales"])
    if "finance" in lower or "account" in lower:
        return list(DESIGNATION_QUESTION_HINTS["Finance"])
    if "analyst" in lower:
        return list(DESIGNATION_QUESTION_HINTS["Analyst"])
    if "manager" in lower:
        return list(DESIGNATION_QUESTION_HINTS["Manager"])
    return list(DESIGNATION_QUESTION_HINTS["Analyst"])


def suggest_tables_for_designation(designation: str, available_tables: list[str]) -> list[str]:
    hints = DESIGNATION_TABLE_HINTS.get(designation)
    if not hints:
        lower = designation.lower()
        if "analyst" in lower:
            hints = DESIGNATION_TABLE_HINTS.get("Analyst", [])
        elif "manager" in lower or designation.endswith("Manager"):
            return list(available_tables)
        elif "sales" in lower:
            hints = DESIGNATION_TABLE_HINTS.get("Sales", [])
        elif "finance" in lower or "account" in lower:
            hints = DESIGNATION_TABLE_HINTS.get("Finance", [])
        else:
            hints = []

    if not hints:
        return list(available_tables) if designation == "Manager" else []

    matched: list[str] = []
    for table in available_tables:
        lower = table.lower()
        if any(hint in lower for hint in hints):
            matched.append(table)
    return matched
