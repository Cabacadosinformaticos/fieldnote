"""Temporary passwords must be changed before the account is used

Revision ID: 0003_must_change_password
Revises: 0002_erasure_recovery_consent
Create Date: 2026-11-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_must_change_password"
down_revision: str | Sequence[str] | None = "0002_erasure_recovery_consent"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_account",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_account", "must_change_password")
