import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

from app.core.config import get_settings
from app.core.designations import PLATFORM_AUDIT_ACTIONS
from app.core.encryption import decrypt_secret, encrypt_secret
from app.core.security import hash_password, verify_password
from app.models.schemas import DatabaseSchema


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _migrate(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            company_id TEXT,
            user_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            details TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    company_cols = {row[1] for row in conn.execute("PRAGMA table_info(companies)")}
    for col, sql in {
        "contact_name": "ALTER TABLE companies ADD COLUMN contact_name TEXT",
        "contact_email": "ALTER TABLE companies ADD COLUMN contact_email TEXT",
        "contact_phone": "ALTER TABLE companies ADD COLUMN contact_phone TEXT",
        "industry": "ALTER TABLE companies ADD COLUMN industry TEXT",
        "website": "ALTER TABLE companies ADD COLUMN website TEXT",
        "address": "ALTER TABLE companies ADD COLUMN address TEXT",
        "plan_tier": "ALTER TABLE companies ADD COLUMN plan_tier TEXT DEFAULT 'professional'",
        "notes": "ALTER TABLE companies ADD COLUMN notes TEXT",
        "quota_queries_per_day": "ALTER TABLE companies ADD COLUMN quota_queries_per_day INTEGER",
        "quota_max_rows": "ALTER TABLE companies ADD COLUMN quota_max_rows INTEGER",
        "quota_max_databases": "ALTER TABLE companies ADD COLUMN quota_max_databases INTEGER",
        "quota_concurrent_jobs": "ALTER TABLE companies ADD COLUMN quota_concurrent_jobs INTEGER",
    }.items():
        if col not in company_cols:
            conn.execute(sql)

    user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    migrations = {
        "password_hash": "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "company_id": "ALTER TABLE users ADD COLUMN company_id TEXT",
        "platform_role": "ALTER TABLE users ADD COLUMN platform_role TEXT DEFAULT 'employee'",
        "designation": "ALTER TABLE users ADD COLUMN designation TEXT",
        "department": "ALTER TABLE users ADD COLUMN department TEXT",
        "employee_id": "ALTER TABLE users ADD COLUMN employee_id TEXT",
        "allowed_tables": "ALTER TABLE users ADD COLUMN allowed_tables TEXT DEFAULT '[]'",
        "full_name": "ALTER TABLE users ADD COLUMN full_name TEXT",
        "is_active": "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1",
        "created_by": "ALTER TABLE users ADD COLUMN created_by TEXT",
        "last_login_at": "ALTER TABLE users ADD COLUMN last_login_at TEXT",
        "avatar_path": "ALTER TABLE users ADD COLUMN avatar_path TEXT",
        "security_note": "ALTER TABLE users ADD COLUMN security_note TEXT",
        "onboarding_completed_at": "ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT",
    }
    for col, sql in migrations.items():
        if col not in user_cols:
            conn.execute(sql)

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS password_change_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT,
            password_hash_pending TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by TEXT,
            review_note TEXT,
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            link_page TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC)"
    )
    notif_cols = {row[1] for row in conn.execute("PRAGMA table_info(notifications)")}
    if "resource_id" not in notif_cols:
        conn.execute("ALTER TABLE notifications ADD COLUMN resource_id TEXT")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_resource "
        "ON notifications(user_id, kind, resource_id)"
    )
    pw_cols = {row[1] for row in conn.execute("PRAGMA table_info(password_change_requests)")}
    if "requester_role" not in pw_cols:
        conn.execute("ALTER TABLE password_change_requests ADD COLUMN requester_role TEXT")
    conn.execute(
        """
        UPDATE password_change_requests
        SET requester_role = (
            SELECT platform_role FROM users WHERE users.id = password_change_requests.user_id
        )
        WHERE requester_role IS NULL
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS table_access_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT NOT NULL,
            table_names TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by TEXT,
            review_note TEXT,
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_queries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT NOT NULL,
            database_id TEXT NOT NULL,
            name TEXT,
            question TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON saved_queries(user_id, created_at DESC)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS query_templates (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            title TEXT NOT NULL,
            question TEXT NOT NULL,
            database_id TEXT,
            designation TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS report_runs (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            status TEXT NOT NULL,
            result_summary TEXT,
            ran_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs(report_id, ran_at DESC)"
    )

    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_employee_id
        ON users(company_id, employee_id)
        WHERE employee_id IS NOT NULL AND platform_role = 'employee'
        """
    )

    conn.execute(
        """
        UPDATE users SET department = designation
        WHERE platform_role = 'employee'
          AND designation IS NOT NULL AND designation != ''
          AND (department IS NULL OR department = '')
        """
    )

    db_cols = {row[1] for row in conn.execute("PRAGMA table_info(uploaded_databases)")}
    for col, sql in {
        "company_id": "ALTER TABLE uploaded_databases ADD COLUMN company_id TEXT",
        "uploaded_by": "ALTER TABLE uploaded_databases ADD COLUMN uploaded_by TEXT",
        "source_type": "ALTER TABLE uploaded_databases ADD COLUMN source_type TEXT DEFAULT 'sqlite_file'",
        "connection_url": "ALTER TABLE uploaded_databases ADD COLUMN connection_url TEXT",
        "dialect": "ALTER TABLE uploaded_databases ADD COLUMN dialect TEXT DEFAULT 'sqlite'",
        "read_replica_url": "ALTER TABLE uploaded_databases ADD COLUMN read_replica_url TEXT",
    }.items():
        if col not in db_cols:
            conn.execute(sql)

    qh_cols = {row[1] for row in conn.execute("PRAGMA table_info(query_history)")}
    for col, sql in {
        "user_id": "ALTER TABLE query_history ADD COLUMN user_id TEXT",
        "company_id": "ALTER TABLE query_history ADD COLUMN company_id TEXT",
        "result_json": "ALTER TABLE query_history ADD COLUMN result_json TEXT",
        "explanation": "ALTER TABLE query_history ADD COLUMN explanation TEXT",
    }.items():
        if col not in qh_cols:
            conn.execute(sql)

    sr_cols = {row[1] for row in conn.execute("PRAGMA table_info(scheduled_reports)")}
    for col, sql in {
        "company_id": "ALTER TABLE scheduled_reports ADD COLUMN company_id TEXT",
        "user_id": "ALTER TABLE scheduled_reports ADD COLUMN user_id TEXT",
    }.items():
        if col not in sr_cols:
            conn.execute(sql)


def init_app_db() -> None:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "avatars").mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(settings.data_dir / "app.db")
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                company_id TEXT,
                platform_role TEXT NOT NULL DEFAULT 'employee',
                designation TEXT,
                allowed_tables TEXT DEFAULT '[]',
                full_name TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_by TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            );

            CREATE TABLE IF NOT EXISTS uploaded_databases (
                id TEXT PRIMARY KEY,
                company_id TEXT,
                uploaded_by TEXT,
                filename TEXT NOT NULL,
                file_path TEXT,
                schema_json TEXT NOT NULL,
                source_type TEXT DEFAULT 'sqlite_file',
                connection_url TEXT,
                dialect TEXT DEFAULT 'sqlite',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS query_history (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                company_id TEXT,
                database_id TEXT NOT NULL,
                question TEXT NOT NULL,
                generated_sql TEXT,
                execution_ms INTEGER,
                row_count INTEGER,
                success INTEGER NOT NULL,
                error TEXT,
                feedback INTEGER,
                result_json TEXT,
                explanation TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scheduled_reports (
                id TEXT PRIMARY KEY,
                company_id TEXT,
                user_id TEXT,
                database_id TEXT NOT NULL,
                name TEXT NOT NULL,
                question TEXT NOT NULL,
                schedule TEXT NOT NULL,
                last_run_at TEXT,
                last_status TEXT,
                last_result TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                company_id TEXT,
                user_id TEXT,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id TEXT,
                details TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        _migrate(conn)
        conn.commit()
    finally:
        conn.close()

    seed_super_admin()
    try:
        sync_password_request_notifications()
    except Exception:
        pass


def seed_super_admin() -> None:
    settings = get_settings()
    email = settings.atlasiq_super_admin_email.strip().lower()
    password_hash = hash_password(settings.atlasiq_super_admin_password)
    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?",
                (password_hash, email),
            )
            return
        conn.execute(
            "INSERT INTO users (id, email, password_hash, platform_role, full_name, is_active, created_at) "
            "VALUES (?, ?, ?, ?, ?, 1, ?)",
            (
                str(uuid.uuid4()),
                email,
                password_hash,
                "super_admin",
                "AtlasIQ Platform Admin",
                _utcnow(),
            ),
        )


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    settings = get_settings()
    conn = sqlite3.connect(settings.data_dir / "app.db")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("allowed_tables") and isinstance(data["allowed_tables"], str):
        try:
            data["allowed_tables"] = json.loads(data["allowed_tables"])
        except json.JSONDecodeError:
            data["allowed_tables"] = []
    data["is_active"] = bool(data.get("is_active", 1))
    data["company_is_active"] = bool(data.get("company_is_active", 1))
    return data


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT u.*, c.name AS company_name, COALESCE(c.is_active, 1) AS company_is_active
            FROM users u LEFT JOIN companies c ON u.company_id = c.id
            WHERE lower(u.email) = lower(?)
            """,
            (email.strip(),),
        ).fetchone()
    return _row_to_user(row) if row else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT u.*, c.name AS company_name, COALESCE(c.is_active, 1) AS company_is_active
            FROM users u LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
    return _row_to_user(row) if row else None


def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    user = get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    if not user.get("is_active"):
        return None
    if user.get("platform_role") != "super_admin" and user.get("company_id") and not user.get("company_is_active", True):
        return None
    with get_db() as conn:
        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (_utcnow(), user["id"]))
    user["last_login_at"] = _utcnow()
    return user


def log_audit(
    action: str,
    user_id: str | None = None,
    company_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO audit_logs (id, company_id, user_id, action, resource_type, resource_id, details, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                company_id,
                user_id,
                action,
                resource_type,
                resource_id,
                json.dumps(details or {}),
                _utcnow(),
            ),
        )


def create_company(
    name: str,
    created_by: str,
    *,
    contact_name: str = "",
    contact_email: str = "",
    contact_phone: str = "",
    industry: str = "",
    website: str = "",
    address: str = "",
    plan_tier: str = "professional",
    notes: str = "",
) -> dict[str, Any]:
    company_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO companies (
                id, name, is_active, contact_name, contact_email, contact_phone,
                industry, website, address, plan_tier, notes, created_at
            ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                company_id, name.strip(), contact_name, contact_email, contact_phone,
                industry, website, address, plan_tier, notes, _utcnow(),
            ),
        )
    log_audit(
        "company.created",
        user_id=created_by,
        company_id=company_id,
        resource_type="company",
        resource_id=company_id,
        details={"name": name, "industry": industry, "plan_tier": plan_tier},
    )
    return get_company(company_id)


def get_company(company_id: str) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    return dict(row) if row else {}


def list_companies() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.*,
                   (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.platform_role = 'employee' AND u.is_active = 1) AS employee_count,
                   (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.platform_role = 'company_admin' AND u.is_active = 1) AS admin_count,
                   (SELECT COUNT(*) FROM uploaded_databases d WHERE d.company_id = c.id) AS database_count,
                   (SELECT email FROM users u WHERE u.company_id = c.id AND u.platform_role = 'company_admin' AND u.is_active = 1 LIMIT 1) AS admin_email
            FROM companies c ORDER BY c.is_active DESC, c.created_at DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def list_company_admins(company_id: str) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, email, full_name, is_active, created_at FROM users "
            "WHERE company_id = ? AND platform_role = 'company_admin' ORDER BY created_at",
            (company_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def _company_employee_id_taken(company_id: str, badge: str, exclude_user_id: str | None = None) -> bool:
    sql = (
        "SELECT 1 FROM users WHERE company_id = ? AND employee_id = ? "
        "AND platform_role = 'employee'"
    )
    params: list[Any] = [company_id, badge]
    if exclude_user_id:
        sql += " AND id != ?"
        params.append(exclude_user_id)
    with get_db() as conn:
        return conn.execute(sql, params).fetchone() is not None


def company_has_admin(company_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE company_id = ? AND platform_role = 'company_admin' AND is_active = 1",
            (company_id,),
        ).fetchone()
    return row is not None


def create_company_admin(
    company_id: str,
    email: str,
    password: str,
    full_name: str,
    created_by: str,
) -> dict[str, Any]:
    company = get_company(company_id)
    if not company:
        raise ValueError("Company not found")
    user_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO users (id, email, password_hash, company_id, platform_role, full_name, is_active, created_by, created_at) "
            "VALUES (?, ?, ?, ?, 'company_admin', ?, 1, ?, ?)",
            (user_id, email.strip().lower(), hash_password(password), company_id, full_name, created_by, _utcnow()),
        )
    log_audit("admin.created", user_id=created_by, company_id=company_id, resource_type="user", resource_id=user_id, details={"email": email})
    return get_user_by_id(user_id)


def get_company_admin_by_id(admin_id: str, company_id: str) -> dict[str, Any] | None:
    user = get_user_by_id(admin_id)
    if not user or user.get("company_id") != company_id or user.get("platform_role") != "company_admin":
        return None
    return user


def delete_company_admin(company_id: str, deleted_by: str, admin_id: str | None = None) -> None:
    if admin_id:
        admin = get_company_admin_by_id(admin_id, company_id)
    else:
        admin = get_company_admin(company_id, active_only=True) or get_company_admin(company_id, active_only=False)
    if not admin:
        raise ValueError("Company admin not found")
    email = admin["email"]
    aid = admin["id"]
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (aid,))
    log_audit(
        "admin.deleted",
        user_id=deleted_by,
        company_id=company_id,
        resource_type="user",
        resource_id=aid,
        details={"email": email},
    )


def get_company_admin(company_id: str, *, active_only: bool = True) -> dict[str, Any] | None:
    sql = "SELECT * FROM users WHERE company_id = ? AND platform_role = 'company_admin'"
    if active_only:
        sql += " AND is_active = 1"
    sql += " LIMIT 1"
    with get_db() as conn:
        row = conn.execute(sql, (company_id,)).fetchone()
    return _row_to_user(row) if row else None


def create_employee(
    company_id: str,
    email: str,
    password: str,
    full_name: str,
    employee_id: str,
    designation: str,
    allowed_tables: list[str],
    created_by: str,
) -> dict[str, Any]:
    badge = employee_id.strip()
    if not badge:
        raise ValueError("Employee ID is required")
    if _company_employee_id_taken(company_id, badge):
        raise ValueError("Employee ID already exists for this company")
    user_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO users (id, email, password_hash, company_id, platform_role, designation, department, "
            "employee_id, allowed_tables, full_name, is_active, created_by, created_at) "
            "VALUES (?, ?, ?, ?, 'employee', ?, ?, ?, ?, ?, 1, ?, ?)",
            (
                user_id,
                email.strip().lower(),
                hash_password(password),
                company_id,
                designation,
                designation,
                badge,
                json.dumps(allowed_tables),
                full_name,
                created_by,
                _utcnow(),
            ),
        )
    log_audit(
        "employee.created",
        user_id=created_by,
        company_id=company_id,
        resource_type="user",
        resource_id=user_id,
        details={"email": email, "employee_id": badge, "designation": designation, "allowed_tables": allowed_tables},
    )
    emp = get_user_by_id(user_id)
    for admin in list_company_admins(company_id):
        if admin.get("is_active") and admin["id"] != created_by:
            create_notification(
                admin["id"],
                company_id=company_id,
                kind="employee.created",
                title="New employee onboarded",
                message=f"{full_name or email} ({badge}) was added to your team.",
                link_page="admin-team",
            )
    try:
        from app.services.email_service import send_welcome_email

        send_welcome_email(email, full_name or email, password)
    except Exception:
        pass
    return emp


def update_employee(
    employee_id: str,
    company_id: str,
    full_name: str | None = None,
    employee_badge: str | None = None,
    designation: str | None = None,
    allowed_tables: list[str] | None = None,
    password: str | None = None,
    is_active: bool | None = None,
    security_note: str | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    user = get_user_by_id(employee_id)
    if not user or user.get("company_id") != company_id or user.get("platform_role") != "employee":
        raise ValueError("Employee not found")
    fields: list[str] = []
    values: list[Any] = []
    if employee_badge is not None:
        badge = employee_badge.strip()
        if not badge:
            raise ValueError("Employee ID is required")
        if _company_employee_id_taken(company_id, badge, exclude_user_id=employee_id):
            raise ValueError("Employee ID already exists for this company")
        fields.append("employee_id = ?")
        values.append(badge)
    if full_name is not None:
        fields.append("full_name = ?")
        values.append(full_name)
    if designation is not None:
        fields.append("designation = ?")
        values.append(designation)
        fields.append("department = ?")
        values.append(designation)
    if allowed_tables is not None:
        fields.append("allowed_tables = ?")
        values.append(json.dumps(allowed_tables))
        prev_tables = user.get("allowed_tables") or []
        if sorted(prev_tables) != sorted(allowed_tables):
            create_notification(
                employee_id,
                company_id=company_id,
                kind="access.tables_updated",
                title="Table access updated",
                message=f"Your company admin updated your allowed tables ({len(allowed_tables)} table{'s' if len(allowed_tables) != 1 else ''}).",
                link_page="employee-profile",
                resource_id=employee_id,
            )
    if password:
        fields.append("password_hash = ?")
        values.append(hash_password(password))
    if is_active is not None:
        fields.append("is_active = ?")
        values.append(int(is_active))
    if security_note is not None:
        fields.append("security_note = ?")
        values.append(security_note.strip() or None)
    if not fields:
        return user
    values.append(employee_id)
    with get_db() as conn:
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
    log_audit("employee.updated", user_id=updated_by, company_id=company_id, resource_type="user", resource_id=employee_id)
    return get_user_by_id(employee_id)


def delete_employee(employee_id: str, company_id: str, deleted_by: str) -> None:
    user = get_user_by_id(employee_id)
    if not user or user.get("company_id") != company_id or user.get("platform_role") != "employee":
        raise ValueError("Employee not found")
    with get_db() as conn:
        conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (employee_id,))
    log_audit("employee.deactivated", user_id=deleted_by, company_id=company_id, resource_type="user", resource_id=employee_id)


def list_company_users(
    company_id: str,
    *,
    department: str | None = None,
    employee_id: str | None = None,
    search: str | None = None,
    platform_role: str | None = None,
    active_only: bool = False,
) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, email, full_name, employee_id, platform_role, designation, department, "
        "allowed_tables, is_active, created_at, last_login_at, security_note FROM users WHERE company_id = ?"
    )
    params: list[Any] = [company_id]
    if active_only:
        sql += " AND is_active = 1"
    if platform_role:
        sql += " AND platform_role = ?"
        params.append(platform_role)
    if department:
        sql += " AND department = ?"
        params.append(department)
    if employee_id:
        sql += " AND employee_id LIKE ?"
        params.append(f"%{employee_id}%")
    if search:
        sql += " AND (full_name LIKE ? OR email LIKE ? OR employee_id LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
    sql += " ORDER BY platform_role, created_at"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        if item.get("allowed_tables"):
            item["allowed_tables"] = json.loads(item["allowed_tables"])
        result.append(item)
    return result


def list_company_table_names(company_id: str) -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT schema_json FROM uploaded_databases WHERE company_id = ?",
            (company_id,),
        ).fetchall()
    names: set[str] = set()
    for row in rows:
        schema = DatabaseSchema.model_validate_json(row["schema_json"])
        names.update(t.name for t in schema.tables)
    return sorted(names, key=str.lower)


def find_database_for_table(company_id: str, table_name: str) -> dict[str, str] | None:
    """Return database id and canonical table name for a table across company data sources."""
    key = table_name.strip().lower()
    if not key:
        return None
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, schema_json FROM uploaded_databases WHERE company_id = ?",
            (company_id,),
        ).fetchall()
    for row in rows:
        schema = DatabaseSchema.model_validate_json(row["schema_json"])
        for table in schema.tables:
            if table.name.lower() == key:
                return {"database_id": row["id"], "table_name": table.name}
    return None


def list_audit_logs(company_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    with get_db() as conn:
        if company_id:
            rows = conn.execute(
                """
                SELECT a.*, u.email AS user_email, u.full_name AS user_name, u.employee_id AS employee_id,
                       u.platform_role AS platform_role
                FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
                WHERE a.company_id = ? ORDER BY a.created_at DESC LIMIT ?
                """,
                (company_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT a.*, u.email AS user_email, c.name AS company_name
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN companies c ON a.company_id = c.id
                ORDER BY a.created_at DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def company_uploads_dir(company_id: str) -> Path:
    settings = get_settings()
    path = settings.data_dir / "companies" / company_id / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_database(
    filename: str,
    schema: DatabaseSchema,
    company_id: str,
    uploaded_by: str,
    file_path: Path | None = None,
    source_type: str = "sqlite_file",
    connection_url: str | None = None,
    read_replica_url: str | None = None,
) -> str:
    db_id = str(uuid.uuid4())
    enc_url = encrypt_secret(connection_url, company_id) if connection_url else None
    enc_replica = encrypt_secret(read_replica_url, company_id) if read_replica_url else None
    with get_db() as conn:
        conn.execute(
            "INSERT INTO uploaded_databases "
            "(id, company_id, uploaded_by, filename, file_path, schema_json, source_type, connection_url, "
            "read_replica_url, dialect, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                db_id,
                company_id,
                uploaded_by,
                filename,
                str(file_path) if file_path else None,
                schema.model_dump_json(),
                source_type,
                enc_url,
                enc_replica,
                schema.dialect,
                _utcnow(),
            ),
        )
    log_audit("database.uploaded", user_id=uploaded_by, company_id=company_id, resource_type="database", resource_id=db_id, details={"filename": filename, "source_type": source_type})
    return db_id


def list_databases(company_id: str) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, filename, schema_json, source_type, dialect, created_at "
            "FROM uploaded_databases WHERE company_id = ? ORDER BY created_at DESC",
            (company_id,),
        ).fetchall()
    result = []
    for row in rows:
        schema = DatabaseSchema.model_validate_json(row["schema_json"])
        result.append(
            {
                "id": row["id"],
                "filename": row["filename"],
                "table_count": len(schema.tables),
                "source_type": row["source_type"] or "sqlite_file",
                "dialect": row["dialect"] or "sqlite",
                "created_at": row["created_at"],
            }
        )
    return result


def get_database(db_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM uploaded_databases WHERE id = ?",
            (db_id,),
        ).fetchone()
    if not row:
        return None
    data = dict(row)
    company_id = data["company_id"]
    conn_url = data.get("connection_url")
    replica_url = data.get("read_replica_url")
    if conn_url and company_id:
        conn_url = decrypt_secret(conn_url, company_id)
    if replica_url and company_id:
        replica_url = decrypt_secret(replica_url, company_id)
    return {
        "id": data["id"],
        "company_id": company_id,
        "uploaded_by": data["uploaded_by"],
        "filename": data["filename"],
        "file_path": Path(data["file_path"]) if data["file_path"] else None,
        "schema": DatabaseSchema.model_validate_json(data["schema_json"]),
        "source_type": data["source_type"] or "sqlite_file",
        "connection_url": conn_url,
        "read_replica_url": replica_url,
        "dialect": data["dialect"] or "sqlite",
        "created_at": data["created_at"],
    }


def delete_database(database_id: str, company_id: str, deleted_by: str) -> None:
    record = get_database(database_id)
    if not record or record["company_id"] != company_id:
        raise ValueError("Database not found")
    filename = record.get("filename")
    file_path = record.get("file_path")
    with get_db() as conn:
        conn.execute("DELETE FROM database_aggregates WHERE database_id = ?", (database_id,))
        conn.execute(
            "DELETE FROM uploaded_databases WHERE id = ? AND company_id = ?",
            (database_id, company_id),
        )
    if file_path and file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass
    log_audit(
        "database.removed",
        user_id=deleted_by,
        company_id=company_id,
        resource_type="database",
        resource_id=database_id,
        details={"filename": filename},
    )


def save_query_history(
    database_id: str,
    company_id: str,
    user_id: str,
    question: str,
    generated_sql: str | None,
    success: bool,
    execution_ms: int | None = None,
    row_count: int | None = None,
    error: str | None = None,
    result_json: str | None = None,
    explanation: str | None = None,
) -> str:
    query_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO query_history "
            "(id, user_id, company_id, database_id, question, generated_sql, execution_ms, row_count, success, error, "
            "result_json, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                query_id, user_id, company_id, database_id, question, generated_sql,
                execution_ms, row_count, int(success), error, result_json, explanation, _utcnow(),
            ),
        )
    log_audit(
        "query.executed" if success else "query.failed",
        user_id=user_id,
        company_id=company_id,
        resource_type="query",
        resource_id=query_id,
        details={"question": question[:120], "success": success, "row_count": row_count},
    )
    if not success:
        actor = get_user_by_id(user_id)
        if actor and actor.get("platform_role") == "employee":
            for admin in list_company_admins(company_id):
                if admin.get("is_active"):
                    create_notification(
                        admin["id"],
                        company_id=company_id,
                        kind="query.failed",
                        title="Employee query failed",
                        message=f"{actor.get('full_name') or actor.get('email')}: {question[:80]}",
                        link_page="admin-activity",
                    )
    return query_id


def get_query_history(
    company_id: str,
    user_id: str | None = None,
    limit: int = 50,
    *,
    employees_only: bool = False,
) -> list[dict[str, Any]]:
    with get_db() as conn:
        employee_filter = " AND u.platform_role = 'employee'" if employees_only else ""
        if user_id:
            rows = conn.execute(
                f"""
                SELECT q.*, u.email AS user_email, u.full_name AS user_name, u.employee_id AS employee_id,
                       u.platform_role AS platform_role, u.designation AS designation, u.department AS department
                FROM query_history q LEFT JOIN users u ON q.user_id = u.id
                WHERE q.company_id = ? AND q.user_id = ?{employee_filter}
                ORDER BY q.created_at DESC LIMIT ?
                """,
                (company_id, user_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                f"""
                SELECT q.*, u.email AS user_email, u.full_name AS user_name, u.employee_id AS employee_id,
                       u.platform_role AS platform_role, u.designation AS designation, u.department AS department
                FROM query_history q LEFT JOIN users u ON q.user_id = u.id
                WHERE q.company_id = ?{employee_filter} ORDER BY q.created_at DESC LIMIT ?
                """,
                (company_id, limit),
            ).fetchall()
    return [dict(row) for row in rows]


def get_query_by_id(query_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM query_history WHERE id = ?", (query_id,)).fetchone()
    return dict(row) if row else None


def set_query_feedback(query_id: str, feedback: int) -> bool:
    with get_db() as conn:
        cursor = conn.execute("UPDATE query_history SET feedback = ? WHERE id = ?", (feedback, query_id))
    return cursor.rowcount > 0


def create_report(company_id: str, user_id: str, database_id: str, name: str, question: str, schedule: str) -> str:
    report_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO scheduled_reports (id, company_id, user_id, database_id, name, question, schedule, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (report_id, company_id, user_id, database_id, name, question, schedule, _utcnow()),
        )
    return report_id


def list_reports(company_id: str, *, user_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM scheduled_reports WHERE company_id = ?"
    params: list[Any] = [company_id]
    if user_id:
        sql += " AND user_id = ?"
        params.append(user_id)
    sql += " ORDER BY created_at DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def list_all_reports() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM scheduled_reports ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


def update_report_run(report_id: str, status: str, result: str | None = None) -> None:
    now = _utcnow()
    run_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "UPDATE scheduled_reports SET last_run_at = ?, last_status = ?, last_result = ? WHERE id = ?",
            (now, status, result, report_id),
        )
        conn.execute(
            "INSERT INTO report_runs (id, report_id, status, result_summary, ran_at) VALUES (?, ?, ?, ?, ?)",
            (run_id, report_id, status, result, now),
        )
    report = get_report(report_id)
    if report and report.get("user_id"):
        status_label = "completed" if status == "success" else "failed"
        create_notification(
            report["user_id"],
            company_id=report.get("company_id"),
            kind="report.run_finished",
            title=f"Report {status_label}",
            message=f'"{report.get("name", "Report")}" {status_label}.',
            link_page="reports",
            resource_id=report_id,
        )


def get_report(report_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM scheduled_reports WHERE id = ?", (report_id,)).fetchone()
    return dict(row) if row else None


def delete_report(report_id: str) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM report_runs WHERE report_id = ?", (report_id,))
        cursor = conn.execute("DELETE FROM scheduled_reports WHERE id = ?", (report_id,))
    if cursor.rowcount == 0:
        raise ValueError("Report not found")


def update_report(report_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {"name", "question", "schedule"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_report(report_id)
    sets = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [report_id]
    with get_db() as conn:
        cursor = conn.execute(f"UPDATE scheduled_reports SET {sets} WHERE id = ?", values)
    if cursor.rowcount == 0:
        return None
    return get_report(report_id)


def compute_satisfaction_rate(company_id: str, user_id: str | None = None) -> float:
    feedback_filter = "AND user_id = ?" if user_id else ""
    params: tuple[Any, ...] = (company_id, user_id) if user_id else (company_id,)
    with get_db() as conn:
        positive = conn.execute(
            f"SELECT COUNT(*) FROM query_history WHERE company_id = ? AND feedback = 1 {feedback_filter}",
            params,
        ).fetchone()[0]
        negative = conn.execute(
            f"SELECT COUNT(*) FROM query_history WHERE company_id = ? AND feedback = -1 {feedback_filter}",
            params,
        ).fetchone()[0]
    total = positive + negative
    return round((positive / total * 100), 1) if total else 0.0


def update_company_details(company_id: str, updated_by: str, **fields: Any) -> dict[str, Any]:
    allowed = {
        "name", "contact_name", "contact_email", "contact_phone",
        "industry", "website", "address", "plan_tier", "notes",
    }
    updates = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in fields.items()
        if k in allowed and v is not None
    }
    if not updates:
        company = get_company(company_id)
        if not company:
            raise ValueError("Company not found")
        return company
    sets = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [company_id]
    with get_db() as conn:
        cursor = conn.execute(f"UPDATE companies SET {sets} WHERE id = ?", values)
    if cursor.rowcount == 0:
        raise ValueError("Company not found")
    log_audit(
        "company.updated",
        user_id=updated_by,
        company_id=company_id,
        resource_type="company",
        resource_id=company_id,
        details={"fields": list(updates.keys())},
    )
    return get_company(company_id)


def update_company_quotas(company_id: str, updated_by: str, **fields: Any) -> dict[str, Any]:
    allowed = {"quota_queries_per_day", "quota_max_rows", "quota_max_databases", "quota_concurrent_jobs"}
    updates = {k: int(v) for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        company = get_company(company_id)
        if not company:
            raise ValueError("Company not found")
        return company
    sets = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [company_id]
    with get_db() as conn:
        cursor = conn.execute(f"UPDATE companies SET {sets} WHERE id = ?", values)
    if cursor.rowcount == 0:
        raise ValueError("Company not found")
    log_audit(
        "company.quotas_updated",
        user_id=updated_by,
        company_id=company_id,
        resource_type="company",
        resource_id=company_id,
        details=updates,
    )
    return get_company(company_id)


def get_company_stats(company_id: str) -> dict[str, Any]:
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM query_history WHERE company_id = ?", (company_id,)).fetchone()[0]
        success = conn.execute(
            "SELECT COUNT(*) FROM query_history WHERE company_id = ? AND success = 1", (company_id,)
        ).fetchone()[0]
        avg_ms = conn.execute(
            "SELECT AVG(execution_ms) FROM query_history WHERE company_id = ? AND success = 1", (company_id,)
        ).fetchone()[0]
        db_count = conn.execute("SELECT COUNT(*) FROM uploaded_databases WHERE company_id = ?", (company_id,)).fetchone()[0]
        emp_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE company_id = ? AND platform_role = 'employee' AND is_active = 1",
            (company_id,),
        ).fetchone()[0]
    return {
        "total_queries": total,
        "successful_queries": success,
        "success_rate": round((success / total * 100) if total else 0, 1),
        "avg_latency_ms": round(avg_ms or 0, 0),
        "database_count": db_count,
        "employee_count": emp_count,
    }


def update_query_history(
    query_id: str,
    *,
    generated_sql: str | None = None,
    success: bool,
    execution_ms: int | None = None,
    row_count: int | None = None,
    error: str | None = None,
    result_json: str | None = None,
    explanation: str | None = None,
) -> str:
    """Update an existing history row (retries/clarifications count as one query)."""
    with get_db() as conn:
        conn.execute(
            "UPDATE query_history SET generated_sql = ?, execution_ms = ?, row_count = ?, "
            "success = ?, error = ?, result_json = ?, explanation = ? WHERE id = ?",
            (
                generated_sql,
                execution_ms,
                row_count,
                int(success),
                error,
                result_json,
                explanation,
                query_id,
            ),
        )
    return query_id


def get_user_query_stats(company_id: str, user_id: str) -> dict[str, Any]:
    """Query metrics scoped to a single user (for employee dashboards)."""
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM query_history WHERE company_id = ? AND user_id = ?",
            (company_id, user_id),
        ).fetchone()[0]
        success = conn.execute(
            "SELECT COUNT(*) FROM query_history WHERE company_id = ? AND user_id = ? AND success = 1",
            (company_id, user_id),
        ).fetchone()[0]
        avg_ms = conn.execute(
            "SELECT AVG(execution_ms) FROM query_history WHERE company_id = ? AND user_id = ? AND success = 1",
            (company_id, user_id),
        ).fetchone()[0]
        db_count = conn.execute("SELECT COUNT(*) FROM uploaded_databases WHERE company_id = ?", (company_id,)).fetchone()[0]
    return {
        "total_queries": total,
        "successful_queries": success,
        "success_rate": round((success / total * 100) if total else 0, 1),
        "avg_latency_ms": round(avg_ms or 0, 0),
        "database_count": db_count,
    }


def get_platform_stats() -> dict[str, Any]:
    with get_db() as conn:
        companies = conn.execute("SELECT COUNT(*) FROM companies WHERE is_active = 1").fetchone()[0]
        users = conn.execute(
            """
            SELECT COUNT(*) FROM users u
            INNER JOIN companies c ON u.company_id = c.id
            WHERE c.is_active = 1 AND u.is_active = 1 AND u.platform_role != 'super_admin'
            """
        ).fetchone()[0]
        company_admins = conn.execute(
            """
            SELECT COUNT(*) FROM users u
            INNER JOIN companies c ON u.company_id = c.id
            WHERE c.is_active = 1 AND u.is_active = 1 AND u.platform_role = 'company_admin'
            """
        ).fetchone()[0]
        employees = conn.execute(
            """
            SELECT COUNT(*) FROM users u
            INNER JOIN companies c ON u.company_id = c.id
            WHERE c.is_active = 1 AND u.is_active = 1 AND u.platform_role = 'employee'
            """
        ).fetchone()[0]
        queries = conn.execute("SELECT COUNT(*) FROM query_history").fetchone()[0]
    return {
        "companies": companies,
        "users": users,
        "company_admins": company_admins,
        "employees": employees,
        "total_queries": queries,
    }


def get_platform_analytics() -> dict[str, Any]:
    with get_db() as conn:
        by_industry = conn.execute(
            """
            SELECT COALESCE(industry, 'Unspecified') AS industry, COUNT(*) AS count
            FROM companies WHERE is_active = 1 GROUP BY industry ORDER BY count DESC
            """
        ).fetchall()
        by_plan = conn.execute(
            "SELECT COALESCE(plan_tier, 'professional') AS plan, COUNT(*) AS count FROM companies WHERE is_active = 1 GROUP BY plan_tier"
        ).fetchall()
        recent_clients = conn.execute(
            "SELECT name, industry, plan_tier, created_at FROM companies ORDER BY created_at DESC LIMIT 5"
        ).fetchall()
        queries_7d = conn.execute(
            "SELECT COUNT(*) FROM query_history WHERE created_at >= datetime('now', '-7 days')"
        ).fetchone()[0]
    return {
        "clients_by_industry": [dict(r) for r in by_industry],
        "clients_by_plan": [dict(r) for r in by_plan],
        "recent_clients": [dict(r) for r in recent_clients],
        "queries_last_7_days": queries_7d,
    }


def get_company_analytics(company_id: str) -> dict[str, Any]:
    employee_join = """
        FROM query_history q
        INNER JOIN users u ON q.user_id = u.id
            AND u.platform_role = 'employee' AND u.company_id = ?
        WHERE q.company_id = ?
    """
    params = (company_id, company_id)

    with get_db() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) {employee_join}",
            params,
        ).fetchone()[0]
        successful = conn.execute(
            f"SELECT COUNT(*) {employee_join} AND q.success = 1",
            params,
        ).fetchone()[0]
        failed = total - successful
        avg_ms = conn.execute(
            f"SELECT AVG(q.execution_ms) {employee_join} AND q.success = 1",
            params,
        ).fetchone()[0]
        avg_rows = conn.execute(
            f"SELECT AVG(q.row_count) {employee_join} AND q.success = 1",
            params,
        ).fetchone()[0]
        active_employees = conn.execute(
            f"SELECT COUNT(DISTINCT q.user_id) {employee_join}",
            params,
        ).fetchone()[0]
        total_employees = conn.execute(
            """
            SELECT COUNT(*) FROM users
            WHERE company_id = ? AND platform_role = 'employee' AND is_active = 1
            """,
            (company_id,),
        ).fetchone()[0]
        queries_today = conn.execute(
            f"SELECT COUNT(*) {employee_join} AND date(q.created_at) = date('now')",
            params,
        ).fetchone()[0]
        queries_7d = conn.execute(
            f"SELECT COUNT(*) {employee_join} AND datetime(q.created_at) >= datetime('now', '-7 days')",
            params,
        ).fetchone()[0]
        queries_30d = conn.execute(
            f"SELECT COUNT(*) {employee_join} AND datetime(q.created_at) >= datetime('now', '-30 days')",
            params,
        ).fetchone()[0]

        department_usage = conn.execute(
            """
            SELECT COALESCE(NULLIF(u.department, ''), NULLIF(u.designation, ''), 'Unassigned') AS department,
                   COUNT(DISTINCT u.id) AS employee_count,
                   COUNT(q.id) AS query_count,
                   ROUND(
                       COALESCE(
                           SUM(CASE WHEN q.id IS NOT NULL AND q.success = 1 THEN 1.0 ELSE 0 END)
                           / NULLIF(COUNT(q.id), 0) * 100,
                           0
                       ),
                       1
                   ) AS success_rate
            FROM users u
            LEFT JOIN query_history q ON q.user_id = u.id AND q.company_id = ?
            WHERE u.company_id = ? AND u.platform_role = 'employee' AND u.is_active = 1
            GROUP BY 1
            ORDER BY query_count DESC, department ASC
            """,
            (company_id, company_id),
        ).fetchall()

        daily_activity = conn.execute(
            f"""
            SELECT date(q.created_at) AS date,
                   COUNT(*) AS query_count,
                   SUM(CASE WHEN q.success = 1 THEN 1 ELSE 0 END) AS successful
            {employee_join}
              AND datetime(q.created_at) >= datetime('now', '-14 days')
            GROUP BY date(q.created_at)
            ORDER BY date ASC
            """,
            params,
        ).fetchall()

        recent_queries = conn.execute(
            f"""
            SELECT q.question, q.success, q.created_at, q.execution_ms, q.row_count,
                   u.id AS user_id, u.full_name, u.employee_id, u.department
            {employee_join}
            ORDER BY q.created_at DESC LIMIT 15
            """,
            params,
        ).fetchall()

    adoption = round((active_employees / total_employees * 100) if total_employees else 0, 1)
    return {
        "summary": {
            "total_employee_queries": total,
            "successful_queries": successful,
            "failed_queries": failed,
            "success_rate": round((successful / total * 100) if total else 0, 1),
            "avg_latency_ms": round(avg_ms or 0, 0),
            "avg_rows_per_query": round(avg_rows or 0, 1),
            "active_employees": active_employees,
            "total_employees": total_employees,
            "adoption_rate": adoption,
            "queries_today": queries_today,
            "queries_last_7_days": queries_7d,
            "queries_last_30_days": queries_30d,
        },
        "department_usage": [dict(r) for r in department_usage],
        "daily_activity": [dict(r) for r in daily_activity],
        "recent_queries": [dict(r) for r in recent_queries],
    }


def _activity_summary_from_audit(a: dict[str, Any]) -> str:
    raw = a.get("details")
    if raw:
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(data, dict):
                if data.get("question"):
                    return str(data["question"])[:120]
                if data.get("email"):
                    return f"{a['action']}: {data.get('email')}"
        except (json.JSONDecodeError, TypeError):
            pass
        return str(raw)[:120]
    return a.get("action", "action")


def list_company_activity(
    company_id: str,
    limit: int = 100,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    queries = get_query_history(
        company_id,
        user_id=user_id,
        limit=limit,
        employees_only=not user_id,
    )
    audits = list_audit_logs(company_id=company_id, limit=limit * 3)
    activity: list[dict[str, Any]] = []
    for q in queries:
        if not user_id and q.get("platform_role") not in (None, "employee"):
            continue
        activity.append({
            "type": "query",
            "id": q["id"],
            "action": "query.executed" if q.get("success") else "query.failed",
            "summary": (q.get("question") or "")[:120],
            "user_id": q.get("user_id"),
            "user_name": q.get("user_name"),
            "user_email": q.get("user_email"),
            "employee_id": q.get("employee_id"),
            "department": q.get("department") or q.get("designation"),
            "execution_ms": q.get("execution_ms"),
            "row_count": q.get("row_count"),
            "created_at": q.get("created_at") or "",
            "success": bool(q.get("success")),
        })
    for a in audits:
        if user_id and a.get("user_id") != user_id:
            continue
        if a["action"] in PLATFORM_AUDIT_ACTIONS:
            continue
        if a.get("platform_role") == "super_admin":
            continue
        if a["action"].startswith("query."):
            continue
        activity.append({
            "type": "audit",
            "id": a["id"],
            "action": a["action"],
            "summary": _activity_summary_from_audit(a),
            "user_id": a.get("user_id"),
            "user_name": a.get("user_name"),
            "user_email": a.get("user_email"),
            "employee_id": a.get("employee_id"),
            "department": a.get("department") or a.get("designation"),
            "execution_ms": None,
            "row_count": None,
            "created_at": a.get("created_at") or "",
            "success": True,
        })
    activity.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return activity[:limit]


def get_employee_detail(employee_id: str, company_id: str) -> dict[str, Any]:
    user = get_user_by_id(employee_id)
    if not user or user.get("company_id") != company_id or user.get("platform_role") != "employee":
        raise ValueError("Employee not found")
    tables = user.get("allowed_tables") or []
    if isinstance(tables, str):
        tables = json.loads(tables) if tables else []
    employee = {
        "id": user["id"],
        "email": user["email"],
        "employee_id": user.get("employee_id"),
        "full_name": user.get("full_name"),
        "platform_role": user["platform_role"],
        "designation": user.get("designation"),
        "department": user.get("department"),
        "allowed_tables": tables,
        "is_active": bool(user.get("is_active", 1)),
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }
    stats = get_user_query_stats(company_id, employee_id)
    queries = get_query_history(company_id, user_id=employee_id, limit=50)
    activity = list_company_activity(company_id, limit=50, user_id=employee_id)
    audits = [
        a for a in list_audit_logs(company_id=company_id, limit=100)
        if a.get("user_id") == employee_id and a["action"] not in ("query.executed", "query.failed")
    ]
    return {
        "employee": employee,
        "stats": stats,
        "queries": queries,
        "activity": activity,
        "audit": audits,
    }


def user_avatars_dir() -> Path:
    settings = get_settings()
    path = settings.data_dir / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_user_avatar_file(user_id: str) -> Path | None:
    user = get_user_by_id(user_id)
    if not user or not user.get("avatar_path"):
        return None
    path = user_avatars_dir() / user["avatar_path"]
    return path if path.is_file() else None


def set_user_avatar(user_id: str, filename: str) -> None:
    with get_db() as conn:
        conn.execute("UPDATE users SET avatar_path = ? WHERE id = ?", (filename, user_id))


def clear_user_avatar(user_id: str) -> None:
    user = get_user_by_id(user_id)
    if not user:
        return
    avatars_dir = user_avatars_dir()
    if user.get("avatar_path"):
        stored = avatars_dir / user["avatar_path"]
        if stored.is_file():
            stored.unlink()
    for path in avatars_dir.glob(f"{user_id}.*"):
        if path.is_file():
            path.unlink()
    with get_db() as conn:
        conn.execute("UPDATE users SET avatar_path = NULL WHERE id = ?", (user_id,))


def update_company_contact_info(company_id: str, updated_by: str, **fields: Any) -> dict[str, Any]:
    allowed = {"contact_name", "contact_email", "contact_phone", "website", "address"}
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_company(company_id)
    sets = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [company_id]
    with get_db() as conn:
        conn.execute(f"UPDATE companies SET {sets} WHERE id = ?", values)
    log_audit(
        "admin.profile_updated",
        user_id=updated_by,
        company_id=company_id,
        resource_type="company",
        resource_id=company_id,
        details={"fields": list(updates.keys())},
    )
    return get_company(company_id)


def update_admin_full_name(user_id: str, company_id: str, full_name: str, updated_by: str) -> dict[str, Any]:
    admin = get_company_admin_by_id(user_id, company_id)
    if not admin:
        raise ValueError("Admin not found")
    with get_db() as conn:
        conn.execute("UPDATE users SET full_name = ? WHERE id = ?", (full_name.strip(), user_id))
    log_audit(
        "admin.profile_updated",
        user_id=updated_by,
        company_id=company_id,
        resource_type="user",
        resource_id=user_id,
        details={"full_name": full_name.strip()},
    )
    return get_user_by_id(user_id) or admin


def has_pending_password_request(user_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM password_change_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
            (user_id,),
        ).fetchone()
    return row is not None


def create_password_change_request(
    user_id: str,
    company_id: str,
    new_password_hash: str,
    requester_role: str,
) -> dict[str, Any]:
    if has_pending_password_request(user_id):
        raise ValueError("A password change request is already pending approval")
    if requester_role not in ("employee", "company_admin"):
        raise ValueError("Invalid requester role for password change")
    request_id = str(uuid.uuid4())
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO password_change_requests "
            "(id, user_id, company_id, password_hash_pending, status, requester_role, created_at) "
            "VALUES (?, ?, ?, ?, 'pending', ?, ?)",
            (request_id, user_id, company_id, new_password_hash, requester_role, now),
        )
    audit_action = (
        "employee.password_change_requested"
        if requester_role == "employee"
        else "admin.password_change_requested"
    )
    log_audit(
        audit_action,
        user_id=user_id,
        company_id=company_id,
        resource_type="password_change_request",
        resource_id=request_id,
    )
    requester = get_user_by_id(user_id)
    _notify_password_change_pending(request_id, requester, company_id, requester_role)
    sync_password_request_notifications()
    return {"id": request_id, "status": "pending", "created_at": now, "requester_role": requester_role}


def _notify_password_change_pending(
    request_id: str,
    requester: dict[str, Any] | None,
    company_id: str,
    requester_role: str,
) -> None:
    name = (requester or {}).get("full_name") or (requester or {}).get("email") or "A user"
    if requester_role == "employee":
        for admin in list_company_admins(company_id):
            if admin.get("is_active"):
                create_notification(
                    admin["id"],
                    company_id=company_id,
                    kind="password_change.pending.employee",
                    title="Employee password change pending",
                    message=f"{name} requested a password update.",
                    link_page="admin-team",
                    resource_id=request_id,
                )
    else:
        for admin in list_super_admin_users():
            create_notification(
                admin["id"],
                company_id=company_id,
                kind="password_change.pending.admin",
                title="Company admin password change pending",
                message=f"{name} requested a password update.",
                link_page="platform-audit",
                resource_id=request_id,
            )
        try:
            from app.services.email_service import send_password_request_pending_email

            if requester:
                send_password_request_pending_email(requester.get("email", ""), requester.get("full_name"))
        except Exception:
            pass
    if requester_role == "employee":
        try:
            from app.services.email_service import send_employee_password_request_pending_email

            send_employee_password_request_pending_email(company_id, name)
        except Exception:
            pass


def list_password_change_requests(
    status: str | None = "pending",
    *,
    company_id: str | None = None,
    requester_role: str | None = None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT r.*, u.email AS user_email, u.full_name AS user_name,
               c.name AS company_name
        FROM password_change_requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN companies c ON r.company_id = c.id
        WHERE 1=1
    """
    params: list[Any] = []
    if status:
        sql += " AND r.status = ?"
        params.append(status)
    if company_id:
        sql += " AND r.company_id = ?"
        params.append(company_id)
    if requester_role:
        sql += " AND r.requester_role = ?"
        params.append(requester_role)
    sql += " ORDER BY r.created_at DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def get_password_change_request(request_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT r.*, u.email AS user_email, u.full_name AS user_name,
                   c.name AS company_name
            FROM password_change_requests r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN companies c ON r.company_id = c.id
            WHERE r.id = ?
            """,
            (request_id,),
        ).fetchone()
    return dict(row) if row else None


def _assert_password_reviewer(req: dict[str, Any], reviewer: dict[str, Any]) -> None:
    target_role = req.get("requester_role") or "company_admin"
    reviewer_role = reviewer.get("platform_role")
    if target_role == "employee":
        if reviewer_role != "company_admin" or reviewer.get("company_id") != req.get("company_id"):
            raise ValueError("Only your company admin can approve employee password changes")
    elif reviewer_role != "super_admin":
        raise ValueError("Only platform administrators can approve company admin password changes")


def approve_password_change_request(request_id: str, reviewer: dict[str, Any]) -> dict[str, Any]:
    req = get_password_change_request(request_id)
    if not req:
        raise ValueError("Password change request not found")
    if req["status"] != "pending":
        raise ValueError("Request is no longer pending")
    _assert_password_reviewer(req, reviewer)
    reviewer_id = reviewer["id"]
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (req["password_hash_pending"], req["user_id"]),
        )
        conn.execute(
            "UPDATE password_change_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (reviewer_id, now, request_id),
        )
    approve_action = (
        "employee.password_change_approved"
        if req.get("requester_role") == "employee"
        else "admin.password_change_approved"
    )
    log_audit(
        approve_action,
        user_id=reviewer_id,
        company_id=req.get("company_id"),
        resource_type="password_change_request",
        resource_id=request_id,
        details={"user_id": req["user_id"], "user_email": req.get("user_email")},
    )
    for kind in ("password_change.pending", "password_change.pending.employee", "password_change.pending.admin"):
        mark_notifications_read_for_resource(kind, request_id)
    link_page = "employee-profile" if req.get("requester_role") == "employee" else "admin-profile"
    create_notification(
        req["user_id"],
        company_id=req.get("company_id"),
        kind="password_change.approved",
        title="Password change approved",
        message="Your new password is now active. Sign in with your updated credentials.",
        link_page=link_page,
        resource_id=request_id,
    )
    try:
        from app.services.email_service import send_password_change_result_email

        send_password_change_result_email(req.get("user_email", ""), approved=True)
    except Exception:
        pass
    return get_password_change_request(request_id) or req


def reject_password_change_request(request_id: str, reviewer: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    req = get_password_change_request(request_id)
    if not req:
        raise ValueError("Password change request not found")
    if req["status"] != "pending":
        raise ValueError("Request is no longer pending")
    _assert_password_reviewer(req, reviewer)
    reviewer_id = reviewer["id"]
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "UPDATE password_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
            (reviewer_id, now, note, request_id),
        )
    reject_action = (
        "employee.password_change_rejected"
        if req.get("requester_role") == "employee"
        else "admin.password_change_rejected"
    )
    log_audit(
        reject_action,
        user_id=reviewer_id,
        company_id=req.get("company_id"),
        resource_type="password_change_request",
        resource_id=request_id,
        details={"user_id": req["user_id"], "user_email": req.get("user_email"), "note": note},
    )
    for kind in ("password_change.pending", "password_change.pending.employee", "password_change.pending.admin"):
        mark_notifications_read_for_resource(kind, request_id)
    link_page = "employee-profile" if req.get("requester_role") == "employee" else "admin-profile"
    reject_msg = note or (
        "Your password change request was not approved."
        if req.get("requester_role") == "employee"
        else "Your password change request was not approved. Contact AtlasIQ support if you need help."
    )
    create_notification(
        req["user_id"],
        company_id=req.get("company_id"),
        kind="password_change.rejected",
        title="Password change declined",
        message=reject_msg,
        link_page=link_page,
        resource_id=request_id,
    )
    try:
        from app.services.email_service import send_password_change_result_email

        send_password_change_result_email(req.get("user_email", ""), approved=False, note=note)
    except Exception:
        pass
    return get_password_change_request(request_id) or req


def list_super_admin_users() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, email, full_name FROM users WHERE platform_role = 'super_admin' AND is_active = 1"
        ).fetchall()
    return [dict(r) for r in rows]


def create_notification(
    user_id: str,
    *,
    company_id: str | None = None,
    kind: str,
    title: str,
    message: str,
    link_page: str | None = None,
    resource_id: str | None = None,
) -> str:
    with get_db() as conn:
        if resource_id:
            existing = conn.execute(
                "SELECT id FROM notifications WHERE user_id = ? AND kind = ? AND resource_id = ?",
                (user_id, kind, resource_id),
            ).fetchone()
            if existing:
                return existing["id"]
    notification_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO notifications "
            "(id, user_id, company_id, kind, title, message, link_page, resource_id, is_read, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
            (notification_id, user_id, company_id, kind, title, message, link_page, resource_id, _utcnow()),
        )
    return notification_id


def sync_password_request_notifications() -> None:
    """Backfill in-app notifications for pending password requests."""
    pending = list_password_change_requests(status="pending")
    if not pending:
        return
    for req in pending:
        requester = get_user_by_id(req["user_id"])
        role = req.get("requester_role") or (requester or {}).get("platform_role") or "company_admin"
        _notify_password_change_pending(req["id"], requester, req.get("company_id"), role)


def update_member_full_name(user_id: str, company_id: str, full_name: str) -> dict[str, Any]:
    user = get_user_by_id(user_id)
    if not user or user.get("company_id") != company_id:
        raise ValueError("User not found")
    with get_db() as conn:
        conn.execute("UPDATE users SET full_name = ? WHERE id = ?", (full_name.strip(), user_id))
    log_audit(
        "employee.profile_updated" if user.get("platform_role") == "employee" else "admin.profile_updated",
        user_id=user_id,
        company_id=company_id,
        resource_type="user",
        resource_id=user_id,
        details={"full_name": full_name.strip()},
    )
    return get_user_by_id(user_id) or user


def mark_notifications_read_for_resource(kind: str, resource_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE kind = ? AND resource_id = ?",
            (kind, resource_id),
        )


def list_notifications(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [{**dict(r), "is_read": bool(r["is_read"])} for r in rows]


def count_unread_notifications(user_id: str) -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
            (user_id,),
        ).fetchone()
    return int(row[0]) if row else 0


def mark_notification_read(notification_id: str, user_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            (notification_id, user_id),
        )


def mark_all_notifications_read(user_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
            (user_id,),
        )


def complete_employee_onboarding(user_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET onboarding_completed_at = ? WHERE id = ? AND onboarding_completed_at IS NULL",
            (_utcnow(), user_id),
        )


def create_saved_query(
    user_id: str,
    company_id: str,
    database_id: str,
    question: str,
    name: str | None = None,
) -> dict[str, Any]:
    query_id = str(uuid.uuid4())
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO saved_queries (id, user_id, company_id, database_id, name, question, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (query_id, user_id, company_id, database_id, name or question[:80], question, now),
        )
    return {"id": query_id, "database_id": database_id, "name": name or question[:80], "question": question, "created_at": now}


def list_saved_queries(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM saved_queries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_saved_query(query_id: str, user_id: str) -> None:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM saved_queries WHERE id = ? AND user_id = ?", (query_id, user_id))
    if cursor.rowcount == 0:
        raise ValueError("Saved query not found")


def create_query_template(
    company_id: str,
    created_by: str,
    title: str,
    question: str,
    database_id: str | None = None,
    designation: str | None = None,
) -> dict[str, Any]:
    template_id = str(uuid.uuid4())
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO query_templates (id, company_id, created_by, title, question, database_id, designation, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (template_id, company_id, created_by, title, question, database_id, designation, now),
        )
    log_audit(
        "query_template.created",
        user_id=created_by,
        company_id=company_id,
        resource_type="query_template",
        resource_id=template_id,
        details={"title": title},
    )
    return {
        "id": template_id,
        "title": title,
        "question": question,
        "database_id": database_id,
        "designation": designation,
        "created_at": now,
    }


def list_query_templates(company_id: str, *, designation: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM query_templates WHERE company_id = ?"
    params: list[Any] = [company_id]
    if designation:
        sql += " AND (designation IS NULL OR designation = ?)"
        params.append(designation)
    sql += " ORDER BY created_at DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def delete_query_template(template_id: str, company_id: str) -> None:
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM query_templates WHERE id = ? AND company_id = ?",
            (template_id, company_id),
        )
    if cursor.rowcount == 0:
        raise ValueError("Query template not found")


def list_report_runs(report_id: str, *, limit: int = 20) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM report_runs WHERE report_id = ? ORDER BY ran_at DESC LIMIT ?",
            (report_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def _has_pending_table_access_request(user_id: str, table_names: list[str]) -> bool:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT table_names FROM table_access_requests WHERE user_id = ? AND status = 'pending'",
            (user_id,),
        ).fetchall()
    pending: set[str] = set()
    for row in rows:
        try:
            pending.update(json.loads(row["table_names"]))
        except (TypeError, json.JSONDecodeError):
            pass
    return bool(pending.intersection(table_names))


def create_table_access_request(
    user_id: str,
    company_id: str,
    table_names: list[str],
    reason: str | None = None,
) -> dict[str, Any]:
    tables = [t.strip() for t in table_names if t and t.strip()]
    if not tables:
        raise ValueError("Select at least one table")
    available = set(list_company_table_names(company_id))
    invalid = [t for t in tables if t not in available]
    if invalid:
        raise ValueError(f"Unknown tables: {', '.join(invalid)}")
    user = get_user_by_id(user_id) or {}
    allowed = set(user.get("allowed_tables") or [])
    new_tables = [t for t in tables if t not in allowed]
    if not new_tables:
        raise ValueError("You already have access to the selected tables")
    if _has_pending_table_access_request(user_id, new_tables):
        raise ValueError("A pending request already includes one or more of these tables")
    request_id = str(uuid.uuid4())
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO table_access_requests "
            "(id, user_id, company_id, table_names, reason, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, 'pending', ?)",
            (request_id, user_id, company_id, json.dumps(new_tables), reason, now),
        )
    log_audit(
        "employee.table_access_requested",
        user_id=user_id,
        company_id=company_id,
        resource_type="table_access_request",
        resource_id=request_id,
        details={"tables": new_tables, "reason": reason},
    )
    name = user.get("full_name") or user.get("email") or "An employee"
    for admin in list_company_admins(company_id):
        if admin.get("is_active"):
            create_notification(
                admin["id"],
                company_id=company_id,
                kind="access.request.pending",
                title="Table access request",
                message=f"{name} requested access to {len(new_tables)} table(s).",
                link_page="admin-team",
                resource_id=request_id,
            )
    try:
        from app.services.email_service import send_table_access_request_email

        send_table_access_request_email(company_id, name, new_tables)
    except Exception:
        pass
    return {"id": request_id, "status": "pending", "table_names": new_tables, "created_at": now}


def list_table_access_requests(
    *,
    status: str | None = "pending",
    company_id: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT r.*, u.email AS user_email, u.full_name AS user_name
        FROM table_access_requests r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE 1=1
    """
    params: list[Any] = []
    if status:
        sql += " AND r.status = ?"
        params.append(status)
    if company_id:
        sql += " AND r.company_id = ?"
        params.append(company_id)
    if user_id:
        sql += " AND r.user_id = ?"
        params.append(user_id)
    sql += " ORDER BY r.created_at DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        try:
            item["table_names"] = json.loads(item.get("table_names") or "[]")
        except (TypeError, json.JSONDecodeError):
            item["table_names"] = []
        out.append(item)
    return out


def get_table_access_request(request_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT r.*, u.email AS user_email, u.full_name AS user_name
            FROM table_access_requests r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
            """,
            (request_id,),
        ).fetchone()
    if not row:
        return None
    item = dict(row)
    try:
        item["table_names"] = json.loads(item.get("table_names") or "[]")
    except (TypeError, json.JSONDecodeError):
        item["table_names"] = []
    return item


def approve_table_access_request(request_id: str, reviewer: dict[str, Any]) -> dict[str, Any]:
    req = get_table_access_request(request_id)
    if not req:
        raise ValueError("Access request not found")
    if req["status"] != "pending":
        raise ValueError("Request is no longer pending")
    if reviewer.get("platform_role") != "company_admin" or reviewer.get("company_id") != req.get("company_id"):
        raise ValueError("Only your company admin can approve table access requests")
    employee = get_user_by_id(req["user_id"])
    if not employee:
        raise ValueError("Employee not found")
    tables = req.get("table_names") or []
    merged = sorted(set((employee.get("allowed_tables") or []) + tables))
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET allowed_tables = ? WHERE id = ?",
            (json.dumps(merged), req["user_id"]),
        )
        conn.execute(
            "UPDATE table_access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (reviewer["id"], now, request_id),
        )
    log_audit(
        "employee.table_access_approved",
        user_id=reviewer["id"],
        company_id=req.get("company_id"),
        resource_type="table_access_request",
        resource_id=request_id,
        details={"tables": tables, "user_id": req["user_id"]},
    )
    mark_notifications_read_for_resource("access.request.pending", request_id)
    create_notification(
        req["user_id"],
        company_id=req.get("company_id"),
        kind="access.request.approved",
        title="Table access approved",
        message=f"Your admin approved access to {len(tables)} table(s).",
        link_page="employee-profile",
        resource_id=request_id,
    )
    try:
        from app.services.email_service import send_table_access_result_email

        send_table_access_result_email(employee.get("email", ""), approved=True, tables=tables)
    except Exception:
        pass
    updated = get_table_access_request(request_id)
    return updated or req


def reject_table_access_request(request_id: str, reviewer: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    req = get_table_access_request(request_id)
    if not req:
        raise ValueError("Access request not found")
    if req["status"] != "pending":
        raise ValueError("Request is no longer pending")
    if reviewer.get("platform_role") != "company_admin" or reviewer.get("company_id") != req.get("company_id"):
        raise ValueError("Only your company admin can reject table access requests")
    now = _utcnow()
    with get_db() as conn:
        conn.execute(
            "UPDATE table_access_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
            (reviewer["id"], now, note, request_id),
        )
    log_audit(
        "employee.table_access_rejected",
        user_id=reviewer["id"],
        company_id=req.get("company_id"),
        resource_type="table_access_request",
        resource_id=request_id,
        details={"user_id": req["user_id"], "note": note},
    )
    mark_notifications_read_for_resource("access.request.pending", request_id)
    employee = get_user_by_id(req["user_id"]) or {}
    reject_msg = note or "Your table access request was not approved."
    create_notification(
        req["user_id"],
        company_id=req.get("company_id"),
        kind="access.request.rejected",
        title="Table access declined",
        message=reject_msg,
        link_page="employee-profile",
        resource_id=request_id,
    )
    try:
        from app.services.email_service import send_table_access_result_email

        send_table_access_result_email(employee.get("email", ""), approved=False, note=note)
    except Exception:
        pass
    updated = get_table_access_request(request_id)
    return updated or req
