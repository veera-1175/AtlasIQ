"""Per-tenant encryption for connection URLs and secrets at rest."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _derive_fernet_key(company_id: str) -> bytes:
    settings = get_settings()
    raw = f"{settings.company_data_key}:{company_id}".encode()
    digest = hashlib.sha256(raw).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(plaintext: str, company_id: str) -> str:
    if not plaintext:
        return ""
    f = Fernet(_derive_fernet_key(company_id))
    return f.encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str, company_id: str) -> str:
    if not ciphertext:
        return ""
    f = Fernet(_derive_fernet_key(company_id))
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # Legacy plaintext URLs stored before encryption was enabled
        return ciphertext
