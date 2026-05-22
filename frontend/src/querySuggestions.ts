import { DatabaseSchema } from "./api";

type TableInfo = DatabaseSchema["tables"][number];

const FALLBACK = [
  "Which region had the highest revenue in Q1?",
  "Total revenue by quarter",
  "How many records per region?",
];

const BUSINESS_TABLE_STEMS = [
  "sales",
  "orders",
  "customers",
  "employees",
  "attendance",
  "invoices",
  "payments",
  "inventory",
  "products",
];

function tableStem(name: string): string {
  return name.toLowerCase().replace(/_\d+$/, "");
}

function cols(table: TableInfo): Set<string> {
  return new Set(table.columns.map((c) => c.name.toLowerCase()));
}

function has(table: TableInfo, ...names: string[]): boolean {
  const set = cols(table);
  return names.some((n) => set.has(n.toLowerCase()));
}

function pickTables(schema: DatabaseSchema, focusTables: string[]): TableInfo[] {
  if (focusTables.length > 0) {
    const focus = new Set(focusTables.map((t) => t.toLowerCase()));
    return schema.tables.filter((t) => focus.has(t.name.toLowerCase()));
  }
  const business = schema.tables.filter((t) => BUSINESS_TABLE_STEMS.includes(tableStem(t.name)));
  if (business.length > 0) return business.slice(0, 4);
  return schema.tables.slice(0, 3);
}

function scopeLabel(table: TableInfo, tables: TableInfo[]): string {
  if (tables.length === 1) return "";
  return ` in ${table.name}`;
}

function suggestionsForTable(table: TableInfo, tables: TableInfo[]): string[] {
  const out: string[] = [];
  const scope = scopeLabel(table, tables);

  if (has(table, "revenue")) {
    if (has(table, "region") && has(table, "quarter")) {
      out.push(`Which region had the highest revenue in Q1${scope}?`);
    } else if (has(table, "region")) {
      out.push(`Which region had the highest total revenue${scope}?`);
    }
    if (has(table, "quarter")) {
      out.push(`Total revenue by quarter${scope}`);
    }
    if (has(table, "department")) {
      out.push(`Revenue by department${scope}`);
    }
    if (has(table, "status") && has(table, "department") && has(table, "region")) {
      out.push(
        `For completed records${scope}, show revenue and order count by region and department — top 5 only with share of total revenue`,
      );
    } else if (has(table, "status")) {
      out.push(`Total revenue by status${scope}`);
    }
  }

  if (has(table, "amount") && !has(table, "revenue")) {
    if (has(table, "region")) out.push(`Total amount by region${scope}`);
    if (has(table, "department")) out.push(`Total amount by department${scope}`);
    if (has(table, "category")) out.push(`Top categories by total amount${scope}`);
    if (has(table, "status")) out.push(`Total amount by status${scope}`);
  }

  if (has(table, "salary") && has(table, "department")) {
    out.push(`Average salary by department${scope}`);
    if (has(table, "region")) out.push(`Which region has the highest average salary${scope}?`);
    if (has(table, "status")) out.push(`How many active employees per department${scope}?`);
  }

  if (has(table, "lifetime_value") && has(table, "segment")) {
    out.push(`Average lifetime value by customer segment${scope}`);
  }

  if (has(table, "region") && has(table, "name") && !has(table, "revenue")) {
    out.push(`How many records per region${scope}?`);
  }

  if (has(table, "quantity") && has(table, "warehouse")) {
    out.push(`Total quantity on hand by warehouse${scope}`);
  }

  if (out.length === 0) {
    out.push(`How many rows are in ${table.name}?`);
    const textCol = table.columns.find((c) => /name|title|category|status|region/i.test(c.name));
    if (textCol) {
      out.push(`Count of records grouped by ${textCol.name}${scope}`);
    }
  }

  return out;
}

function compareSuggestion(tables: TableInfo[]): string | null {
  if (tables.length < 2) return null;

  const metric = tables.every((t) => has(t, "revenue"))
    ? "revenue"
    : tables.every((t) => has(t, "amount"))
      ? "amount"
      : null;
  if (!metric || !tables.every((t) => has(t, "region"))) return null;

  const names = tables.map((t) => t.name).join(" and ");
  return `Compare total ${metric} by region across ${names}`;
}

export function buildQuerySuggestions(
  schema: DatabaseSchema | null,
  focusTables: string[],
): string[] {
  if (!schema?.tables.length) return FALLBACK;

  const tables = pickTables(schema, focusTables);
  if (!tables.length) return FALLBACK;

  const suggestions: string[] = [];
  const compare = compareSuggestion(tables);
  if (compare) suggestions.push(compare);

  const perTableLimit = tables.length > 1 ? Math.max(2, Math.ceil(5 / tables.length)) : 3;
  for (const table of tables) {
    suggestions.push(...suggestionsForTable(table, tables).slice(0, perTableLimit));
  }

  if (tables.length > 1) {
    const names = tables.map((t) => t.name).join(", ");
    suggestions.push(`What are the row counts for ${names}?`);
  }

  const unique = [...new Set(suggestions)];
  return unique.length > 0 ? unique.slice(0, 5) : FALLBACK;
}
