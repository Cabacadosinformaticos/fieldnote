"""Invite codes, study codes and device tokens, as security.md describes them.

Codes use the 32-symbol Crockford alphabet (no I, L, O or U), so they are easy to read aloud and
to type. A personal code has 12 symbols in three groups of four (about 60 bits) and is stored
only as its SHA-256 hash; a study code has 8 symbols in two groups of four and is stored
readable, because it is printed on a poster. Device tokens are 256 random bits, stored hashed.
"""

import hashlib
import hmac
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
PERSONAL_CODE_LENGTH = 12
STUDY_CODE_LENGTH = 8

# Symbols people confuse when they type a code read from paper.
_LOOKALIKES = str.maketrans({"I": "1", "L": "1", "O": "0", "U": "V"})


def _random_code(length: int) -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(length))
    return "-".join(raw[i : i + 4] for i in range(0, length, 4))


def generate_personal_code() -> str:
    return _random_code(PERSONAL_CODE_LENGTH)


def generate_study_code() -> str:
    return _random_code(STUDY_CODE_LENGTH)


def normalize_code(typed: str) -> str | None:
    """Return the canonical form (groups of four joined by hyphens) or None if it is not a code."""
    compact = "".join(ch for ch in typed.upper() if ch.isalnum()).translate(_LOOKALIKES)
    if len(compact) not in (PERSONAL_CODE_LENGTH, STUDY_CODE_LENGTH):
        return None
    if any(ch not in ALPHABET for ch in compact):
        return None
    return "-".join(compact[i : i + 4] for i in range(0, len(compact), 4))


def is_personal_code(code: str) -> bool:
    return len(code.replace("-", "")) == PERSONAL_CODE_LENGTH


def hash_code(code: str) -> str:
    """SHA-256 of the canonical form of a personal code, as stored in invite_code.code_hash."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_device_token() -> str:
    return secrets.token_urlsafe(32)


def hash_device_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def same_hash(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
