"""Erasure file retries, researcher password recovery, consent text and unique aliases

Revision ID: 0002_erasure_recovery_consent
Revises: 0001_initial_schema
Create Date: 2026-11-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_erasure_recovery_consent"
down_revision: str | Sequence[str] | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("study", sa.Column("consent_text", sa.Text(), nullable=True))

    op.create_table(
        "erasure_file_deletion",
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("entries", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("participant_id"),
    )
    op.create_index(
        "ix_erasure_file_deletion_study_id",
        "erasure_file_deletion",
        ["study_id"],
    )

    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user_account.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_password_reset_token_user_id", "password_reset_token", ["user_id"])

    op.create_unique_constraint("uq_participant_study_alias", "participant", ["study_id", "alias"])


def downgrade() -> None:
    op.drop_constraint("uq_participant_study_alias", "participant", type_="unique")
    op.drop_index("ix_password_reset_token_user_id", table_name="password_reset_token")
    op.drop_table("password_reset_token")
    op.drop_index("ix_erasure_file_deletion_study_id", table_name="erasure_file_deletion")
    op.drop_table("erasure_file_deletion")
    op.drop_column("study", "consent_text")
