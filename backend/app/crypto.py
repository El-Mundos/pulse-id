import base64
import json
import os

from cryptography.fernet import Fernet

# 32 bytes → valid Fernet key for local dev. Override via CREDENTIAL_ENCRYPTION_KEY in prod.
_DEV_KEY: bytes = base64.urlsafe_b64encode(b"pulse-id-dev-key-32bytes-fill!!!")


def _fernet() -> Fernet:
    raw = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
    key = raw.encode() if raw else _DEV_KEY
    return Fernet(key)


def encrypt_data(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_data(token: str) -> dict:
    return json.loads(_fernet().decrypt(token.encode()).decode())
