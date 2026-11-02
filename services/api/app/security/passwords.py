"""Argon2id password hashing with the parameters required by security.md."""

import contextlib

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

from app.errors import ApiError

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 1024

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


def validate_new_password(password: str, email: str | None = None) -> None:
    """Enforce the rule for every password an account is given or chooses.

    Login does not use this: an account created before the rule must still be able to sign in.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ApiError(
            422,
            "password_too_short",
            f"The password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ApiError(
            422,
            "password_too_long",
            f"The password must be at most {MAX_PASSWORD_LENGTH} characters.",
        )
    if email is not None and password.strip().lower() == email.strip().lower():
        raise ApiError(422, "password_is_email", "The password cannot be the email address.")


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
