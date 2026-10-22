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


def create_admin(email: str) -> int:
    email = email.strip().lower()
    if not email:
        print("An email address is required.", file=sys.stderr)
        return 2

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

    arguments = parser.parse_args(argv)
    if arguments.command == "create-admin":
        return create_admin(arguments.email)
    parser.error(f"unknown command {arguments.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
