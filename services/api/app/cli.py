"""Small administrative commands. Run with ``uv run python -m app.cli``."""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import UserAccount
from app.models.enums import UserRole
from app.security.passwords import hash_password


def _prompt_password() -> str:
    while True:
        password = getpass.getpass("Password: ")
        if not password:
            print("The password must not be empty.", file=sys.stderr)
            continue
        if password != getpass.getpass("Repeat password: "):
            print("The passwords do not match.", file=sys.stderr)
            continue
        return password


def _read_password_from_stdin() -> str | None:
    line = sys.stdin.readline()
    if not line:
        print("No password was provided on standard input.", file=sys.stderr)
        return None
    password = line.rstrip("\r\n")
    if not password:
        print("The password must not be empty.", file=sys.stderr)
        return None
    return password


def create_admin(email: str, password: str | None = None) -> int:
    email = email.strip().lower()
    if not email:
        print("An email address is required.", file=sys.stderr)
        return 2

    if password is None:
        password = _prompt_password()
    with SessionLocal() as session:
        existing = session.scalar(select(UserAccount).where(UserAccount.email == email))
        if existing is not None:
            print(f"An account with email {email} already exists.", file=sys.stderr)
            return 1
        session.add(
            UserAccount(
                email=email,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
            )
        )
        session.commit()

    print(f"Administrator {email} created.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin_parser = commands.add_parser("create-admin", help="Create an administrator account.")
    admin_parser.add_argument("--email", required=True, help="Email address of the account.")
    admin_parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read the password from standard input instead of prompting.",
    )

    arguments = parser.parse_args(argv)
    if arguments.command == "create-admin":
        password = None
        if arguments.password_stdin:
            password = _read_password_from_stdin()
            if password is None:
                return 2
        return create_admin(arguments.email, password)
    parser.error(f"unknown command {arguments.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
