"""TOTP (RFC 6238) secrets and verification, mandatory for administrators."""

import base64
import hashlib
import hmac
import secrets
import struct
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlencode

from app.config import settings


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _secret_bytes(secret: str) -> bytes:
    padded = secret.strip().replace(" ", "").upper()
    padded += "=" * (-len(padded) % 8)
    return base64.b32decode(padded)


def generate_code(secret: str, at: datetime | None = None) -> str:
    counter = int((at or datetime.now(UTC)).timestamp()) // settings.totp_period_seconds
    digest = hmac.new(_secret_bytes(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10**settings.totp_digits)).zfill(settings.totp_digits)


def verify_code(secret: str, code: str, at: datetime | None = None) -> bool:
    cleaned = code.strip().replace(" ", "")
    if len(cleaned) != settings.totp_digits or not cleaned.isdigit():
        return False
    moment = at or datetime.now(UTC)
    window = range(-settings.totp_valid_window, settings.totp_valid_window + 1)
    expected = {
        generate_code(secret, moment + timedelta(seconds=step * settings.totp_period_seconds))
        for step in window
    }
    return any(hmac.compare_digest(cleaned, candidate) for candidate in expected)


def provisioning_uri(secret: str, email: str) -> str:
    label = quote(f"{settings.totp_issuer}:{email}", safe="")
    query = urlencode(
        {
            "secret": secret,
            "issuer": settings.totp_issuer,
            "algorithm": "SHA1",
            "digits": settings.totp_digits,
            "period": settings.totp_period_seconds,
        }
    )
    return f"otpauth://totp/{label}?{query}"
