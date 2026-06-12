"""Seed a demo tenant: company, admin, employee, and sample sales database."""
from __future__ import annotations

import shutil
import sys
import uuid
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.paths import sample_data_dir  # noqa: E402

from app.core.database import (  # noqa: E402
    company_uploads_dir,
    create_company,
    create_company_admin,
    create_employee,
    get_user_by_email,
    init_app_db,
    list_companies,
    list_databases,
    save_database,
)
from app.services.aggregates import seed_aggregates_for_database  # noqa: E402
from app.services.schema_extractor import extract_sqlite_schema  # noqa: E402

DEMO_COMPANY = "Acme Demo"
ADMIN_EMAIL = "admin@demo.acme.com"
ADMIN_PASSWORD = "Demo@2026"
EMPLOYEE_EMAIL = "analyst@demo.acme.com"
EMPLOYEE_PASSWORD = "Demo@2026"
SAMPLE_DB = sample_data_dir() / "sales.db"


def seed_demo(*, force: bool = False) -> None:
    init_app_db()

    if list_companies() and not force:
        print("Demo tenant already exists — skipping seed (use --force to recreate).")
        _print_credentials()
        return

    super_admin = get_user_by_email("admin@atlasiq.io")
    if not super_admin:
        print("Super admin not found. Start the API once, then re-run seed_demo.")
        sys.exit(1)

    if not SAMPLE_DB.exists():
        print(f"Sample database missing at {SAMPLE_DB}. Run create_sample_db.py first.")
        sys.exit(1)

    created_by = super_admin["id"]
    company = create_company(
        DEMO_COMPANY,
        created_by,
        contact_name="Jane Demo",
        contact_email=ADMIN_EMAIL,
        industry="Retail",
        plan_tier="professional",
        notes="Auto-seeded demo tenant for college presentations and local testing.",
    )
    company_id = company["id"]

    admin = create_company_admin(
        company_id,
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        "Jane Demo",
        created_by,
    )

    if not list_databases(company_id):
        upload_dir = company_uploads_dir(company_id)
        dest = upload_dir / f"{uuid.uuid4()}_sales.db"
        shutil.copy2(SAMPLE_DB, dest)
        schema = extract_sqlite_schema(dest)
        save_database(
            "sales.db",
            schema,
            company_id=company_id,
            uploaded_by=admin["id"],
            file_path=dest,
            source_type="sqlite_file",
        )
        db_id = list_databases(company_id)[0]["id"]
        seed_aggregates_for_database(db_id, company_id, schema)

    tables = [t.name for t in extract_sqlite_schema(SAMPLE_DB).tables]
    create_employee(
        company_id,
        EMPLOYEE_EMAIL,
        EMPLOYEE_PASSWORD,
        "Alex Analyst",
        "EMP-001",
        "Analyst",
        tables,
        admin["id"],
    )

    print()
    print("Demo tenant ready.")
    _print_credentials()


def _print_credentials() -> None:
    print()
    print("  Company admin:")
    print(f"    {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print("  Employee:")
    print(f"    {EMPLOYEE_EMAIL} / {EMPLOYEE_PASSWORD}")
    print("  Platform super admin:")
    print("    admin@atlasiq.io / AtlasIQ@2026")
    print()


if __name__ == "__main__":
    seed_demo(force="--force" in sys.argv)
