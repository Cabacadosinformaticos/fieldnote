"""Record when a plan run was calculated

Revision ID: 0005_plan_run_created_at
Revises: 0004_totp_confirm_account_links
Create Date: 2026-11-05 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_plan_run_created_at"
down_revision: str | Sequence[str] | None = "0004_totp_confirm_account_links"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "plan_run",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("plan_run", "created_at")
