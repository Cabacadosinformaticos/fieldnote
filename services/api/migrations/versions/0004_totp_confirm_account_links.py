"""Confirm TOTP enrolment and drop the temporary-password flag

Revision ID: 0004_totp_confirm_account_links
Revises: 0003_must_change_password
Create Date: 2026-11-05 00:00:00.000000

A TOTP secret only counts once the first code has been checked. Administrators already enrolled
before this revision are taken as confirmed. Accounts that still carried the temporary-password
flag are migrated to the email-link flow: their tentative password is replaced by a value no
password can match, and their sessions are revoked, because the link is now the only way in.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_totp_confirm_account_links"
down_revision: str | Sequence[str] | None = "0003_must_change_password"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_account",
        sa.Column("totp_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE user_account SET totp_confirmed_at = created_at WHERE totp_secret IS NOT NULL"
    )
    op.execute(
        "UPDATE refresh_token SET revoked_at = now() "
        "WHERE revoked_at IS NULL AND user_id IN "
        "(SELECT id FROM user_account WHERE must_change_password)"
    )
    op.execute("UPDATE user_account SET password_hash = '!' WHERE must_change_password")
    op.drop_column("user_account", "must_change_password")


def downgrade() -> None:
    op.add_column(
        "user_account",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.drop_column("user_account", "totp_confirmed_at")
