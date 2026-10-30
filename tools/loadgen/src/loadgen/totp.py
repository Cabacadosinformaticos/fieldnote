"""TOTP codes for the administrator account, using the same parameters as the API.

The load generator needs a code only while it enrols a fresh administrator or when the caller
passes ``--admin-totp-secret``. The API's own ``app.security.totp`` is not importable here, so the
standard RFC 6238 construction (HMAC-SHA1, six digits, thirty seconds) is repeated.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
from datetime import UTC, datetime

PERIOD_SECONDS = 30
DIGITS = 6


def _key(secret: str) -> bytes:
    padded = secret.strip().replace(" ", "").upper()
    padded += "=" * (-len(padded) % 8)
    return base64.b32decode(padded)


def generate_code(secret: str, at: datetime | None = None) -> str:
    """Return the six-digit code for ``secret`` at ``at`` (default: now, UTC)."""
    counter = int((at or datetime.now(UTC)).timestamp()) // PERIOD_SECONDS
    digest = hmac.new(_key(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


__all__ = ["generate_code"]
