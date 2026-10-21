"""Argon2id password hashing with the parameters required by security.md."""

import contextlib

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

# OWASP minimum: 19 MiB, 2 iterations and parallelism 1.
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=19 * 1024,
    parallelism=1,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

# Unknown emails are verified against a real hash so both paths spend the same Argon2id work.
_DUMMY_HASH = _hasher.hash("fieldnote-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def dummy_verify(password: str) -> None:
    """Perform a real verification for an email that has no account. Always fails."""
    with contextlib.suppress(VerificationError, InvalidHashError):
        _hasher.verify(_DUMMY_HASH, password)
