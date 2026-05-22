"""Resolve repo / app root for scripts in local dev vs production Docker."""
from pathlib import Path


def app_root() -> Path:
    """Directory containing `app/` and `scripts/` (backend root or /app in Docker)."""
    script_parent = Path(__file__).resolve().parents[2]  # .../app/core -> backend
    if (script_parent / "scripts").is_dir():
        return script_parent
    return Path(__file__).resolve().parents[1]


def repo_root() -> Path:
    """Monorepo root locally; same as app_root in single-container deploy."""
    root = app_root()
    if (root.parent / "frontend").is_dir():
        return root.parent
    return root


def sample_data_dir() -> Path:
    return repo_root() / "sample_data"
