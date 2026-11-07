"""Command line entry point: ``uv run loadgen --base ... --participants ...``."""

from __future__ import annotations

import argparse
import os
import sys

from loadgen.runner import LoadGenerator, RunConfig


def _positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def _positive_float(value: str) -> float:
    number = float(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return number


def _ratio(value: str) -> float:
    number = float(value)
    if not 0.0 <= number <= 1.0:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return number


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="loadgen",
        description="Create a study, join simulated phones and send entries for a fixed time.",
    )
    parser.add_argument(
        "--base",
        default=os.environ.get("FIELDNOTE_LOADGEN_BASE", "http://127.0.0.1:8090"),
        help="primary gateway (default: %(default)s)",
    )
    parser.add_argument(
        "--second-base",
        default=os.environ.get("FIELDNOTE_LOADGEN_SECOND_BASE"),
        help="fallback gateway used after the primary fails",
    )
    parser.add_argument("--participants", type=_positive_int, default=10)
    parser.add_argument(
        "--minutes", type=_positive_float, default=1.0, help="sending window in minutes"
    )
    parser.add_argument(
        "--rate",
        type=_positive_float,
        default=1.0,
        help="entries per participant per minute",
    )
    parser.add_argument(
        "--media-ratio",
        type=_ratio,
        default=0.3,
        help="fraction of entries that carry a generated image",
    )
    parser.add_argument("--retries", type=_positive_int, default=8)
    parser.add_argument("--seed", type=int, default=20261102)
    parser.add_argument("--timeout", type=_positive_float, default=30.0)
    parser.add_argument(
        "--media-timeout",
        type=float,
        default=300.0,
        help="seconds to wait for uploaded images to be processed (0 disables the wait)",
    )
    parser.add_argument(
        "--admin-email",
        default=os.environ.get("FIELDNOTE_LOADGEN_ADMIN_EMAIL"),
        help="administrator that creates the researcher account",
    )
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("FIELDNOTE_LOADGEN_ADMIN_PASSWORD"),
        help="administrator password (or set FIELDNOTE_LOADGEN_ADMIN_PASSWORD)",
    )
    parser.add_argument(
        "--admin-password-stdin",
        action="store_true",
        help="read the administrator password from standard input",
    )
    parser.add_argument(
        "--admin-totp-secret",
        default=os.environ.get("FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET"),
        help="TOTP secret when the administrator is already enrolled",
    )
    parser.add_argument(
        "--mailpit-url",
        default=os.environ.get("FIELDNOTE_LOADGEN_MAILPIT_URL", "http://127.0.0.1:8025"),
        help="local Mailpit API used to read the account link (default: %(default)s)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    arguments = parser.parse_args(argv)

    password = arguments.admin_password
    if arguments.admin_password_stdin:
        password = sys.stdin.readline().rstrip("\r\n")
    if not arguments.admin_email or not password:
        parser.error(
            "an administrator is required: pass --admin-email and --admin-password "
            "(or set FIELDNOTE_LOADGEN_ADMIN_EMAIL and FIELDNOTE_LOADGEN_ADMIN_PASSWORD)"
        )

    config = RunConfig(
        base=arguments.base,
        second_base=arguments.second_base,
        participants=arguments.participants,
        minutes=arguments.minutes,
        rate=arguments.rate,
        media_ratio=arguments.media_ratio,
        retries=arguments.retries,
        seed=arguments.seed,
        timeout=arguments.timeout,
        media_timeout=arguments.media_timeout,
        admin_email=arguments.admin_email,
        admin_password=password,
        admin_totp_secret=arguments.admin_totp_secret,
        mailpit_url=arguments.mailpit_url,
    )
    return LoadGenerator(config).execute()


__all__ = ["build_parser", "main"]
