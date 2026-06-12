"""Authenticated smoke test against a running AtlasIQ API."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8000/api/v1"
SAMPLE = Path(__file__).resolve().parents[2] / "sample_data" / "sales.db"

DEMO_ADMIN = ("admin@demo.acme.com", "Demo@2026")
FALLBACK_ADMIN = ("admin@atlasiq.io", "AtlasIQ@2026")


def _request(method: str, path: str, *, token: str | None = None, data: bytes | None = None, headers: dict | None = None) -> dict:
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    h = dict(headers or {})
    if token:
        h["Authorization"] = f"Bearer {token}"
    if data is not None and "Content-Type" not in h:
        h["Content-Type"] = "application/json"
    for key, value in h.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def login(email: str, password: str) -> str:
    payload = json.dumps({"email": email, "password": password}).encode()
    data = _request("POST", "/auth/login", data=payload)
    return data["access_token"]


def try_login() -> tuple[str, str]:
    for email, password in (DEMO_ADMIN, FALLBACK_ADMIN):
        try:
            return login(email, password), email
        except urllib.error.HTTPError:
            continue
    raise RuntimeError("Could not log in — run seed_demo.py or check credentials")


def upload_db(token: str) -> dict:
    boundary = "----atlasiq"
    data = SAMPLE.read_bytes()
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; filename="sales.db"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}/databases/upload", data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def ask(token: str, db_id: str, question: str) -> dict:
    payload = json.dumps({"database_id": db_id, "question": question}).encode()
    return _request("POST", "/query", token=token, data=payload)


def main() -> None:
    if not SAMPLE.exists():
        print(f"Missing sample DB: {SAMPLE}")
        sys.exit(1)

    try:
        _request("GET", "/health")
    except Exception as exc:
        print(f"API not reachable at {API}: {exc}")
        sys.exit(1)

    token, email = try_login()
    print(f"Logged in as {email}")

    dbs = _request("GET", "/databases", token=token)
    if dbs:
        db_id = dbs[0]["id"]
        print(f"Using existing database: {dbs[0]['filename']} ({db_id})")
    else:
        if email == FALLBACK_ADMIN[0]:
            print("Super admin has no databases — run seed_demo.py for a full demo tenant.")
            sys.exit(0)
        db = upload_db(token)
        db_id = db["id"]
        print(f"Uploaded database: {db_id}")

    result = ask(token, db_id, "Which region had the highest revenue in Q1?")
    print(f"Success: {result['success']}")
    print(f"SQL: {result.get('generated_sql')}")
    print(f"Rows: {result.get('row_count')}")
    if not result["success"]:
        print(f"Error: {result.get('error')}")
        sys.exit(1)
    print("Smoke test passed.")


if __name__ == "__main__":
    main()
