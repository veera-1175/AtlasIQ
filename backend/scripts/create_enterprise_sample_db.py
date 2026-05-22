"""Create a large enterprise sample SQLite database for AtlasIQ demos."""
from __future__ import annotations

import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

SAMPLE_PATH = Path(__file__).resolve().parents[2] / "sample_data" / "enterprise_sample.db"
NUM_TABLES = 100
ROWS_PER_TABLE = 100

REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East"]
DEPARTMENTS = ["Sales", "HR", "Finance", "Operations", "Marketing", "Engineering", "Support"]
STATUSES = ["active", "pending", "completed", "cancelled", "on_hold"]
SEGMENTS = ["enterprise", "mid_market", "smb", "startup", "government"]
QUARTERS = ["Q1", "Q2", "Q3", "Q4"]

TABLE_STEMS = [
    "sales",
    "orders",
    "customers",
    "products",
    "invoices",
    "payments",
    "employees",
    "departments",
    "payroll",
    "attendance",
    "leave_requests",
    "inventory",
    "warehouses",
    "shipments",
    "suppliers",
    "purchase_orders",
    "marketing_campaigns",
    "leads",
    "channels",
    "promotions",
    "ledger_entries",
    "expenses",
    "budgets",
    "accounts",
    "support_tickets",
    "issues",
    "feedback",
    "patients",
    "appointments",
    "prescriptions",
    "diagnoses",
    "projects",
    "tasks",
    "milestones",
    "timesheets",
    "assets",
    "maintenance_logs",
    "facilities",
    "contracts",
    "vendors",
    "returns",
    "refunds",
    "subscriptions",
    "usage_metrics",
    "audit_events",
    "compliance_checks",
    "training_sessions",
    "certifications",
    "performance_reviews",
    "job_postings",
]


def table_names(count: int) -> list[str]:
    names: list[str] = []
    for index in range(count):
        stem = TABLE_STEMS[index % len(TABLE_STEMS)]
        cycle = index // len(TABLE_STEMS) + 1
        name = stem if cycle == 1 else f"{stem}_{cycle:02d}"
        names.append(name)
    return names


def create_table_sql(table: str) -> str:
    stem = table.split("_")[0]
    if stem in {"sales", "orders", "invoices", "payments", "refunds"}:
        return f"""
            CREATE TABLE {table} (
                id INTEGER PRIMARY KEY,
                region TEXT NOT NULL,
                department TEXT NOT NULL,
                revenue REAL NOT NULL,
                quantity INTEGER NOT NULL,
                quarter TEXT NOT NULL,
                status TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                record_date TEXT NOT NULL
            )
        """
    if stem in {"customers", "leads", "patients", "vendors", "suppliers"}:
        return f"""
            CREATE TABLE {table} (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                region TEXT NOT NULL,
                segment TEXT NOT NULL,
                lifetime_value REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """
    if stem in {"employees", "payroll", "attendance", "performance"}:
        return f"""
            CREATE TABLE {table} (
                id INTEGER PRIMARY KEY,
                full_name TEXT NOT NULL,
                department TEXT NOT NULL,
                designation TEXT NOT NULL,
                salary REAL NOT NULL,
                region TEXT NOT NULL,
                status TEXT NOT NULL,
                hire_date TEXT NOT NULL
            )
        """
    if stem in {"inventory", "warehouses", "shipments", "products", "assets"}:
        return f"""
            CREATE TABLE {table} (
                id INTEGER PRIMARY KEY,
                item_name TEXT NOT NULL,
                sku TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_cost REAL NOT NULL,
                warehouse TEXT NOT NULL,
                region TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """
    return f"""
        CREATE TABLE {table} (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            region TEXT NOT NULL,
            department TEXT NOT NULL,
            amount REAL NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT NOT NULL,
            record_date TEXT NOT NULL
        )
    """


def row_for_table(table: str, row_id: int) -> tuple:
    stem = table.split("_")[0]
    base_date = date(2023, 1, 1) + timedelta(days=random.randint(0, 730))
    region = random.choice(REGIONS)
    department = random.choice(DEPARTMENTS)
    status = random.choice(STATUSES)

    if stem in {"sales", "orders", "invoices", "payments", "refunds"}:
        return (
            row_id,
            region,
            department,
            round(random.uniform(500, 250000), 2),
            random.randint(1, 500),
            random.choice(QUARTERS),
            status,
            f"Customer {row_id:04d}",
            base_date.isoformat(),
        )
    if stem in {"customers", "leads", "patients", "vendors", "suppliers"}:
        return (
            row_id,
            f"{stem.title()} Contact {row_id:04d}",
            f"user{row_id:04d}@example.com",
            region,
            random.choice(SEGMENTS),
            round(random.uniform(1000, 500000), 2),
            status,
            base_date.isoformat(),
        )
    if stem in {"employees", "payroll", "attendance", "performance"}:
        return (
            row_id,
            f"Employee {row_id:04d}",
            department,
            random.choice(["Analyst", "Manager", "Specialist", "Coordinator", "Director"]),
            round(random.uniform(45000, 180000), 2),
            region,
            status,
            base_date.isoformat(),
        )
    if stem in {"inventory", "warehouses", "shipments", "products", "assets"}:
        return (
            row_id,
            f"Item {row_id:04d}",
            f"SKU-{row_id:05d}",
            random.randint(0, 5000),
            round(random.uniform(5, 2500), 2),
            f"WH-{random.randint(1, 12):02d}",
            region,
            status,
            base_date.isoformat(),
        )
    return (
        row_id,
        f"{table.replace('_', ' ').title()} {row_id:04d}",
        random.choice(SEGMENTS),
        region,
        department,
        round(random.uniform(100, 100000), 2),
        random.randint(1, 1000),
        status,
        base_date.isoformat(),
    )


def insert_sql(table: str) -> str:
    stem = table.split("_")[0]
    if stem in {"sales", "orders", "invoices", "payments", "refunds"}:
        cols = "id, region, department, revenue, quantity, quarter, status, customer_name, record_date"
    elif stem in {"customers", "leads", "patients", "vendors", "suppliers"}:
        cols = "id, name, email, region, segment, lifetime_value, status, created_at"
    elif stem in {"employees", "payroll", "attendance", "performance"}:
        cols = "id, full_name, department, designation, salary, region, status, hire_date"
    elif stem in {"inventory", "warehouses", "shipments", "products", "assets"}:
        cols = "id, item_name, sku, quantity, unit_cost, warehouse, region, status, updated_at"
    else:
        cols = "id, title, category, region, department, amount, quantity, status, record_date"
    placeholders = ", ".join("?" for _ in cols.split(", "))
    return f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"


def main() -> None:
    SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SAMPLE_PATH.exists():
        SAMPLE_PATH.unlink()

    conn = sqlite3.connect(SAMPLE_PATH)
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = OFF")
        tables = table_names(NUM_TABLES)
        for table in tables:
            conn.execute(create_table_sql(table))

        for table in tables:
            rows = [row_for_table(table, row_id) for row_id in range(1, ROWS_PER_TABLE + 1)]
            conn.executemany(insert_sql(table), rows)

        conn.commit()
        table_count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        total_rows = sum(
            conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] for table in tables
        )
        size_mb = SAMPLE_PATH.stat().st_size / (1024 * 1024)
        print(f"Created {SAMPLE_PATH}")
        print(f"Tables: {table_count}, Rows: {total_rows}, Size: {size_mb:.2f} MB")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
