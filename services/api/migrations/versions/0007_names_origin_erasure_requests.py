"""Add account names, the origin of audit rows and erasure requests from the team

Revision ID: 0007_names_origin_requests
Revises: 0006_today_free_entry_display
Create Date: 2026-11-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_names_origin_requests"
down_revision: str | Sequence[str] | None = "0006_today_free_entry_display"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_account", sa.Column("name", sa.Text(), nullable=True))
    op.add_column("audit_log", sa.Column("origin_client", sa.Text(), nullable=True))
    op.add_column("audit_log", sa.Column("origin_ip", sa.Text(), nullable=True))
    op.add_column("audit_log", sa.Column("origin_browser", sa.Text(), nullable=True))
    op.create_table(
        "erasure_request",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "study_id",
            sa.Uuid(),
            sa.ForeignKey("study.id", name="fk_erasure_request_study_id_study", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "participant_id",
            sa.Uuid(),
            sa.ForeignKey(
                "participant.id",
                name="fk_erasure_request_participant_id_participant",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        ),
        # Kept when the participant row is erased, so the done list still says who it was.
        sa.Column("participant_alias", sa.Text(), nullable=False),
        sa.Column("entries", sa.Integer(), nullable=True),
        sa.Column("files", sa.Integer(), nullable=True),
        sa.Column(
            "requested_by",
            sa.Uuid(),
            sa.ForeignKey(
                "user_account.id",
                name="fk_erasure_request_requested_by_user_account",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("status", sa.Text(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "done_by",
            sa.Uuid(),
            sa.ForeignKey(
                "user_account.id",
                name="fk_erasure_request_done_by_user_account",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'done', 'cancelled')", name="ck_erasure_request_status_valid"
        ),
    )


def downgrade() -> None:
    op.drop_table("erasure_request")
    op.drop_column("audit_log", "origin_browser")
    op.drop_column("audit_log", "origin_ip")
    op.drop_column("audit_log", "origin_client")
    op.drop_column("user_account", "name")
