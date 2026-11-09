"""Let the research team choose what Today shows below an open request

Revision ID: 0006_today_free_entry_display
Revises: 0005_plan_run_created_at
Create Date: 2026-11-06 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_today_free_entry_display"
down_revision: str | Sequence[str] | None = "0005_plan_run_created_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE today_free_entry_display AS ENUM ('both', 'request_only', 'notice')")
    op.add_column(
        "study",
        sa.Column(
            "today_free_entry_display",
            postgresql.ENUM(
                "both",
                "request_only",
                "notice",
                name="today_free_entry_display",
                create_type=False,
            ),
            server_default=sa.text("'both'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("study", "today_free_entry_display")
    op.execute("DROP TYPE today_free_entry_display")
