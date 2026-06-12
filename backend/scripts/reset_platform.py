"""Wipe all tenant data and recreate a fresh database with only the super admin."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
from app.core.database import init_app_db


def reset_platform() -> None:
    settings = get_settings()
    data_dir = settings.data_dir.resolve()
    db_path = data_dir / "app.db"

    if db_path.exists():
        db_path.unlink()
        print(f"Deleted {db_path}")

    for folder in (data_dir / "companies", data_dir / "uploads"):
        if folder.exists():
            shutil.rmtree(folder)
            print(f"Removed {folder}")

    data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    init_app_db()

    print()
    print("Platform reset complete.")
    print(f"  Super admin: {settings.atlasiq_super_admin_email}")
    print(f"  Password:    {settings.atlasiq_super_admin_password}")
    print("  Restart the backend if it is already running.")


if __name__ == "__main__":
    reset_platform()
