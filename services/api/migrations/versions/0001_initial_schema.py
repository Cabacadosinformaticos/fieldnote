"""Initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-02 17:19:35.400996

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL enum types are created once and shared by every column that uses them.
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'researcher')")
    op.execute(
        "CREATE TYPE study_role AS ENUM ('principal_investigator', 'co_investigator', 'member')"
    )
    op.execute("CREATE TYPE study_status AS ENUM ('draft', 'running', 'closed')")
    op.execute("CREATE TYPE schedule_style AS ENUM ('fixed', 'balanced', 'varied')")
    op.execute(
        "CREATE TYPE participant_status AS ENUM ('active', 'pending_approval', 'declined', "
        "'withdrawn', 'removed', 'erasure_scheduled')"
    )
    op.execute("CREATE TYPE locale AS ENUM ('pt', 'en')")
    op.execute("CREATE TYPE invite_code_kind AS ENUM ('personal', 'study')")
    op.execute(
        "CREATE TYPE question_kind AS ENUM "
        "('single_choice', 'multiple_choice', 'yes_no', 'short_text')"
    )
    op.execute(
        "CREATE TYPE prompt_status AS ENUM ('planned', 'unplanned', 'sent', 'answered', 'expired')"
    )
    op.execute(
        "CREATE TYPE unplanned_reason AS ENUM ('outside_availability', 'min_gap_infeasible', "
        "'daily_cap', 'slot_cap', 'search_cut')"
    )
    op.execute(
        "CREATE TYPE entry_type AS ENUM ('text', 'photo', 'video', 'audio', 'scale', 'choice')"
    )
    op.execute("CREATE TYPE media_status AS ENUM ('pending', 'uploaded', 'processed', 'failed')")
    op.execute(
        "CREATE TYPE pool_invitation_status AS ENUM ('sent', 'accepted', 'declined', 'expired')"
    )
    op.execute("CREATE TYPE audit_actor_type AS ENUM ('user', 'participant', 'system')")
    op.execute("CREATE TYPE email_code_purpose AS ENUM ('sign_in', 'add_method')")
    op.execute("CREATE TYPE age_band AS ENUM ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')")
    op.execute("CREATE TYPE gender AS ENUM ('female', 'male', 'other')")
    op.execute(
        "CREATE TYPE occupation AS ENUM ('student', 'employee', 'self_employed', "
        "'unemployed', 'retired', 'other')"
    )
    op.execute(
        "CREATE TYPE transport_mode AS ENUM ('walking', 'public_transport', 'car', "
        "'bicycle', 'scooter', 'other')"
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "actor_type",
            postgresql.ENUM(
                "user", "participant", "system", name="audit_actor_type", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(op.f("ix_audit_log_at"), "audit_log", ["at"], unique=False)
    op.create_table(
        "leader_lease",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("holder", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_leader_lease")),
    )
    op.create_table(
        "outbox_event",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_outbox_event")),
    )
    op.create_index(
        op.f("ix_outbox_event_created_at"), "outbox_event", ["created_at"], unique=False
    )
    op.create_table(
        "participant_account",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recovery_hash", sa.Text(), nullable=True),
        sa.Column("recovery_lookup", sa.Text(), nullable=True),
        sa.Column("email_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("email_lookup", sa.Text(), nullable=True),
        sa.Column("google_subject_id", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "recovery_lookup IS NOT NULL OR email_lookup IS NOT NULL "
            "OR google_subject_id IS NOT NULL",
            name=op.f("ck_participant_account_has_sign_in_method"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_participant_account")),
        sa.UniqueConstraint("email_lookup", name=op.f("uq_participant_account_email_lookup")),
        sa.UniqueConstraint(
            "google_subject_id", name=op.f("uq_participant_account_google_subject_id")
        ),
        sa.UniqueConstraint("recovery_lookup", name=op.f("uq_participant_account_recovery_lookup")),
    )
    op.create_table(
        "study",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "running", "closed", name="study_status", create_type=False),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("starts_on", sa.Date(), nullable=True),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("max_prompts_per_day", sa.Integer(), nullable=False),
        sa.Column("max_prompts_per_slot", sa.Integer(), nullable=False),
        sa.Column(
            "schedule_style",
            postgresql.ENUM(
                "fixed", "balanced", "varied", name="schedule_style", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("device_salt", sa.LargeBinary(length=32), nullable=False),
        sa.CheckConstraint(
            "octet_length(device_salt) = 32", name=op.f("ck_study_device_salt_length")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study")),
    )
    op.create_table(
        "user_account",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("admin", "researcher", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column("failed_logins", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("totp_secret", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_account")),
        sa.UniqueConstraint("email", name=op.f("uq_user_account_email")),
    )
    op.create_table(
        "account_device_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["participant_account.id"],
            name=op.f("fk_account_device_token_account_id_participant_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_account_device_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_account_device_token_token_hash")),
    )
    op.create_index(
        op.f("ix_account_device_token_account_id"),
        "account_device_token",
        ["account_id"],
        unique=False,
    )
    op.create_table(
        "account_email_code",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("email_lookup", sa.Text(), nullable=False),
        sa.Column("email_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column(
            "purpose",
            postgresql.ENUM("sign_in", "add_method", name="email_code_purpose", create_type=False),
            nullable=False,
        ),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "attempts >= 0 AND attempts <= 5", name=op.f("ck_account_email_code_attempts_limit")
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["participant_account.id"],
            name=op.f("fk_account_email_code_account_id_participant_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_account_email_code")),
    )
    op.create_index(
        op.f("ix_account_email_code_account_id"), "account_email_code", ["account_id"], unique=False
    )
    op.create_index(
        op.f("ix_account_email_code_email_lookup"),
        "account_email_code",
        ["email_lookup"],
        unique=False,
    )
    op.create_table(
        "activity",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("entry_types", sa.ARRAY(sa.Text()), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("prompts_per_day", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.Time(), nullable=False),
        sa.Column("window_end", sa.Time(), nullable=False),
        sa.Column("min_gap_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "capture_location", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "allow_free_entries", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("max_free_entries_per_day", sa.Integer(), nullable=True),
        sa.Column("expected_minutes", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "cardinality(entry_types) >= 1 AND entry_types <@ "
            "ARRAY['text', 'photo', 'video', 'audio', 'scale', 'choice']::text[]",
            name=op.f("ck_activity_entry_types_valid"),
        ),
        sa.CheckConstraint(
            "options IS NULL OR NOT options ? 'scale_type' OR "
            "options->>'scale_type' IN ('numbers', 'faces', 'text', 'slider')",
            name=op.f("ck_activity_scale_type_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["study_id"], ["study.id"], name=op.f("fk_activity_study_id_study"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activity")),
    )
    op.create_index(op.f("ix_activity_study_id"), "activity", ["study_id"], unique=False)
    op.create_table(
        "participant",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("alias", sa.Text(), nullable=True),
        sa.Column("admitted_by_code_id", sa.Uuid(), nullable=True),
        sa.Column("device_token_hash", sa.Text(), nullable=True),
        sa.Column("push_token", sa.Text(), nullable=True),
        sa.Column("device_hash", sa.Text(), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "locale", postgresql.ENUM("pt", "en", name="locale", create_type=False), nullable=True
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "pending_approval",
                "declined",
                "withdrawn",
                "removed",
                "erasure_scheduled",
                name="participant_status",
                create_type=False,
            ),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("erasure_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("erasure_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status_before_erasure",
            postgresql.ENUM(
                "active",
                "pending_approval",
                "declined",
                "withdrawn",
                "removed",
                "erasure_scheduled",
                name="participant_status",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "availability_any_time", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["decided_by"],
            ["user_account.id"],
            name=op.f("fk_participant_decided_by_user_account"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_participant_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_participant")),
        sa.UniqueConstraint("study_id", "device_hash", name="uq_participant_study_device_hash"),
    )
    op.create_index(
        op.f("ix_participant_admitted_by_code_id"),
        "participant",
        ["admitted_by_code_id"],
        unique=False,
    )
    op.create_index(op.f("ix_participant_decided_by"), "participant", ["decided_by"], unique=False)
    op.create_index(
        op.f("ix_participant_device_token_hash"), "participant", ["device_token_hash"], unique=True
    )
    op.create_index(op.f("ix_participant_study_id"), "participant", ["study_id"], unique=False)
    op.create_table(
        "plan_run",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("finished", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("nodes_expanded", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("planned", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("unplanned", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("solve_ms", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.ForeignKeyConstraint(
            ["study_id"], ["study.id"], name=op.f("fk_plan_run_study_id_study"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_run")),
    )
    op.create_index(op.f("ix_plan_run_study_id"), "plan_run", ["study_id"], unique=False)
    op.create_table(
        "pool_member",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("credential_hash", sa.Text(), nullable=False),
        sa.Column("push_token", sa.Text(), nullable=True),
        sa.Column("concelho", sa.Text(), nullable=False),
        sa.Column("freguesia", sa.Text(), nullable=True),
        sa.Column(
            "age_band",
            postgresql.ENUM(
                "18-24",
                "25-34",
                "35-44",
                "45-54",
                "55-64",
                "65+",
                name="age_band",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "gender",
            postgresql.ENUM("female", "male", "other", name="gender", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "occupation",
            postgresql.ENUM(
                "student",
                "employee",
                "self_employed",
                "unemployed",
                "retired",
                "other",
                name="occupation",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "usual_transport",
            postgresql.ENUM(
                "walking",
                "public_transport",
                "car",
                "bicycle",
                "scooter",
                "other",
                name="transport_mode",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("languages", sa.ARRAY(sa.Text()), nullable=True),
        sa.Column(
            "invitations_paused", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "languages IS NULL OR languages <@ ARRAY['pt', 'en']::text[]",
            name=op.f("ck_pool_member_languages_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["participant_account.id"],
            name=op.f("fk_pool_member_account_id_participant_account"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pool_member")),
        sa.UniqueConstraint("account_id", name=op.f("uq_pool_member_account_id")),
        sa.UniqueConstraint("credential_hash", name=op.f("uq_pool_member_credential_hash")),
    )
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_refresh_token_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_token_token_hash")),
    )
    op.create_index(
        op.f("ix_refresh_token_family_id"), "refresh_token", ["family_id"], unique=False
    )
    op.create_index(op.f("ix_refresh_token_user_id"), "refresh_token", ["user_id"], unique=False)
    op.create_table(
        "study_member",
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(
                "principal_investigator",
                "co_investigator",
                "member",
                name="study_role",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_study_member_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_account.id"],
            name=op.f("fk_study_member_user_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("study_id", "user_id", name=op.f("pk_study_member")),
    )
    op.create_index(op.f("ix_study_member_user_id"), "study_member", ["user_id"], unique=False)
    op.create_table(
        "study_question",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM(
                "single_choice",
                "multiple_choice",
                "yes_no",
                "short_text",
                name="question_kind",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "options", sa.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_study_question_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study_question")),
    )
    op.create_index(
        op.f("ix_study_question_study_id"), "study_question", ["study_id"], unique=False
    )
    op.create_table(
        "tag",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["study_id"], ["study.id"], name=op.f("fk_tag_study_id_study"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tag")),
    )
    op.create_index(op.f("ix_tag_study_id"), "tag", ["study_id"], unique=False)
    op.create_table(
        "account_participation",
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["participant_account.id"],
            name=op.f("fk_account_participation_account_id_participant_account"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_account_participation_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_account_participation_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("participant_id", name=op.f("pk_account_participation")),
        sa.UniqueConstraint(
            "account_id", "study_id", name="uq_account_participation_account_study"
        ),
    )
    op.create_index(
        op.f("ix_account_participation_account_id"),
        "account_participation",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_account_participation_study_id"),
        "account_participation",
        ["study_id"],
        unique=False,
    )
    op.create_table(
        "availability",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("weekdays", sa.ARRAY(sa.Integer()), nullable=False),
        sa.CheckConstraint(
            "cardinality(weekdays) >= 1 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]",
            name=op.f("ck_availability_weekdays_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_availability_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_availability")),
    )
    op.create_index(
        op.f("ix_availability_participant_id"), "availability", ["participant_id"], unique=False
    )
    op.create_table(
        "consent",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_consent_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consent")),
    )
    op.create_index(op.f("ix_consent_participant_id"), "consent", ["participant_id"], unique=False)
    op.create_table(
        "invite_code",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM("personal", "study", name="invite_code_kind", create_type=False),
            nullable=False,
        ),
        sa.Column("code_hash", sa.Text(), nullable=True),
        sa.Column("code_value", sa.Text(), nullable=True),
        sa.Column("participant_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("max_per_hour", sa.Integer(), nullable=True),
        sa.Column("uses", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "requires_approval", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "requires_account", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(kind = 'personal' AND code_hash IS NOT NULL AND code_value IS NULL) OR "
            "(kind = 'study' AND code_value IS NOT NULL AND code_hash IS NULL)",
            name=op.f("ck_invite_code_code_kind"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["user_account.id"],
            name=op.f("fk_invite_code_created_by_user_account"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_invite_code_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_invite_code_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invite_code")),
        sa.UniqueConstraint("code_hash", name=op.f("uq_invite_code_code_hash")),
        sa.UniqueConstraint("code_value", name=op.f("uq_invite_code_code_value")),
    )
    op.create_index(op.f("ix_invite_code_created_by"), "invite_code", ["created_by"], unique=False)
    op.create_index(
        op.f("ix_invite_code_participant_id"), "invite_code", ["participant_id"], unique=False
    )
    op.create_index(op.f("ix_invite_code_study_id"), "invite_code", ["study_id"], unique=False)

    # Deferred because participant and invite_code reference each other.
    op.create_foreign_key(
        "fk_participant_admitted_by_code_id_invite_code",
        "participant",
        "invite_code",
        ["admitted_by_code_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "participant_identity",
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_participant_identity_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("participant_id", name=op.f("pk_participant_identity")),
    )
    op.create_table(
        "pool_invitation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("study_id", sa.Uuid(), nullable=False),
        sa.Column("pool_member_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "sent",
                "accepted",
                "declined",
                "expired",
                name="pool_invitation_status",
                create_type=False,
            ),
            server_default=sa.text("'sent'"),
            nullable=False,
        ),
        sa.Column(
            "sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["pool_member_id"],
            ["pool_member.id"],
            name=op.f("fk_pool_invitation_pool_member_id_pool_member"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["study_id"],
            ["study.id"],
            name=op.f("fk_pool_invitation_study_id_study"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pool_invitation")),
    )
    op.create_index(
        op.f("ix_pool_invitation_pool_member_id"),
        "pool_invitation",
        ["pool_member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pool_invitation_study_id"), "pool_invitation", ["study_id"], unique=False
    )
    op.create_table(
        "prompt",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("activity_id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("occurrence", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shown_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "planned",
                "unplanned",
                "sent",
                "answered",
                "expired",
                name="prompt_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "unplanned_reason",
            postgresql.ENUM(
                "outside_availability",
                "min_gap_infeasible",
                "daily_cap",
                "slot_cap",
                "search_cut",
                name="unplanned_reason",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.CheckConstraint(
            "unplanned_reason IS NULL OR status = 'unplanned'",
            name=op.f("ck_prompt_unplanned_reason_matches_status"),
        ),
        sa.ForeignKeyConstraint(
            ["activity_id"],
            ["activity.id"],
            name=op.f("fk_prompt_activity_id_activity"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_prompt_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt")),
        sa.UniqueConstraint(
            "participant_id",
            "activity_id",
            "plan_date",
            "occurrence",
            name="uq_prompt_participant_activity_plan_date_occurrence",
        ),
    )
    op.create_index(op.f("ix_prompt_activity_id"), "prompt", ["activity_id"], unique=False)
    op.create_index(op.f("ix_prompt_participant_id"), "prompt", ["participant_id"], unique=False)
    op.create_table(
        "study_answer",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.Uuid(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM(
                "single_choice",
                "multiple_choice",
                "yes_no",
                "short_text",
                name="question_kind",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column(
            "answered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(answer) <= 300", name=op.f("ck_study_answer_answer_length")
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_study_answer_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["study_question.id"],
            name=op.f("fk_study_answer_question_id_study_question"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study_answer")),
        sa.UniqueConstraint(
            "participant_id", "question_id", name="uq_study_answer_participant_question"
        ),
    )
    op.create_index(
        op.f("ix_study_answer_participant_id"), "study_answer", ["participant_id"], unique=False
    )
    op.create_index(
        op.f("ix_study_answer_question_id"), "study_answer", ["question_id"], unique=False
    )
    op.create_table(
        "entry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("prompt_id", sa.Uuid(), nullable=True),
        sa.Column("activity_id", sa.Uuid(), nullable=True),
        sa.Column(
            "entry_type",
            postgresql.ENUM(
                "text",
                "photo",
                "video",
                "audio",
                "scale",
                "choice",
                name="entry_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("content_sha256", sa.Text(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("value", sa.Integer(), nullable=True),
        sa.Column("scale_shown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("choice", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.CheckConstraint(
            "scale_shown IS NULL OR NOT scale_shown ? 'scale_type' OR "
            "scale_shown->>'scale_type' IN ('numbers', 'faces', 'text', 'slider')",
            name=op.f("ck_entry_scale_shown_type_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["activity_id"],
            ["activity.id"],
            name=op.f("fk_entry_activity_id_activity"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"],
            ["participant.id"],
            name=op.f("fk_entry_participant_id_participant"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prompt_id"],
            ["prompt.id"],
            name=op.f("fk_entry_prompt_id_prompt"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_entry")),
    )
    op.create_index(op.f("ix_entry_activity_id"), "entry", ["activity_id"], unique=False)
    op.create_index(op.f("ix_entry_participant_id"), "entry", ["participant_id"], unique=False)
    op.create_index(op.f("ix_entry_prompt_id"), "entry", ["prompt_id"], unique=False)
    op.create_table(
        "entry_tag",
        sa.Column("entry_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["entry_id"], ["entry.id"], name=op.f("fk_entry_tag_entry_id_entry"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"], ["tag.id"], name=op.f("fk_entry_tag_tag_id_tag"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("entry_id", "tag_id", name=op.f("pk_entry_tag")),
    )
    op.create_index(op.f("ix_entry_tag_tag_id"), "entry_tag", ["tag_id"], unique=False)
    op.create_table(
        "media_object",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entry_id", sa.Uuid(), nullable=True),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending", "uploaded", "processed", "failed", name="media_status", create_type=False
            ),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["entry_id"],
            ["entry.id"],
            name=op.f("fk_media_object_entry_id_entry"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_object")),
    )
    op.create_index(op.f("ix_media_object_entry_id"), "media_object", ["entry_id"], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_constraint(
        "fk_participant_admitted_by_code_id_invite_code", "participant", type_="foreignkey"
    )
    op.drop_index(op.f("ix_media_object_entry_id"), table_name="media_object")
    op.drop_table("media_object")
    op.drop_index(op.f("ix_entry_tag_tag_id"), table_name="entry_tag")
    op.drop_table("entry_tag")
    op.drop_index(op.f("ix_entry_prompt_id"), table_name="entry")
    op.drop_index(op.f("ix_entry_participant_id"), table_name="entry")
    op.drop_index(op.f("ix_entry_activity_id"), table_name="entry")
    op.drop_table("entry")
    op.drop_index(op.f("ix_study_answer_question_id"), table_name="study_answer")
    op.drop_index(op.f("ix_study_answer_participant_id"), table_name="study_answer")
    op.drop_table("study_answer")
    op.drop_index(op.f("ix_prompt_participant_id"), table_name="prompt")
    op.drop_index(op.f("ix_prompt_activity_id"), table_name="prompt")
    op.drop_table("prompt")
    op.drop_index(op.f("ix_pool_invitation_study_id"), table_name="pool_invitation")
    op.drop_index(op.f("ix_pool_invitation_pool_member_id"), table_name="pool_invitation")
    op.drop_table("pool_invitation")
    op.drop_table("participant_identity")
    op.drop_index(op.f("ix_invite_code_study_id"), table_name="invite_code")
    op.drop_index(op.f("ix_invite_code_participant_id"), table_name="invite_code")
    op.drop_index(op.f("ix_invite_code_created_by"), table_name="invite_code")
    op.drop_table("invite_code")
    op.drop_index(op.f("ix_consent_participant_id"), table_name="consent")
    op.drop_table("consent")
    op.drop_index(op.f("ix_availability_participant_id"), table_name="availability")
    op.drop_table("availability")
    op.drop_index(op.f("ix_account_participation_study_id"), table_name="account_participation")
    op.drop_index(op.f("ix_account_participation_account_id"), table_name="account_participation")
    op.drop_table("account_participation")
    op.drop_index(op.f("ix_tag_study_id"), table_name="tag")
    op.drop_table("tag")
    op.drop_index(op.f("ix_study_question_study_id"), table_name="study_question")
    op.drop_table("study_question")
    op.drop_index(op.f("ix_study_member_user_id"), table_name="study_member")
    op.drop_table("study_member")
    op.drop_index(op.f("ix_refresh_token_user_id"), table_name="refresh_token")
    op.drop_index(op.f("ix_refresh_token_family_id"), table_name="refresh_token")
    op.drop_table("refresh_token")
    op.drop_table("pool_member")
    op.drop_index(op.f("ix_plan_run_study_id"), table_name="plan_run")
    op.drop_table("plan_run")
    op.drop_index(op.f("ix_participant_study_id"), table_name="participant")
    op.drop_index(op.f("ix_participant_device_token_hash"), table_name="participant")
    op.drop_index(op.f("ix_participant_decided_by"), table_name="participant")
    op.drop_index(op.f("ix_participant_admitted_by_code_id"), table_name="participant")
    op.drop_table("participant")
    op.drop_index(op.f("ix_activity_study_id"), table_name="activity")
    op.drop_table("activity")
    op.drop_index(op.f("ix_account_email_code_email_lookup"), table_name="account_email_code")
    op.drop_index(op.f("ix_account_email_code_account_id"), table_name="account_email_code")
    op.drop_table("account_email_code")
    op.drop_index(op.f("ix_account_device_token_account_id"), table_name="account_device_token")
    op.drop_table("account_device_token")
    op.drop_table("user_account")
    op.drop_table("study")
    op.drop_table("participant_account")
    op.drop_index(op.f("ix_outbox_event_created_at"), table_name="outbox_event")
    op.drop_table("outbox_event")
    op.drop_table("leader_lease")
    op.drop_index(op.f("ix_audit_log_at"), table_name="audit_log")
    op.drop_table("audit_log")

    op.execute("DROP TYPE user_role")
    op.execute("DROP TYPE study_role")
    op.execute("DROP TYPE study_status")
    op.execute("DROP TYPE schedule_style")
    op.execute("DROP TYPE participant_status")
    op.execute("DROP TYPE locale")
    op.execute("DROP TYPE invite_code_kind")
    op.execute("DROP TYPE question_kind")
    op.execute("DROP TYPE prompt_status")
    op.execute("DROP TYPE unplanned_reason")
    op.execute("DROP TYPE entry_type")
    op.execute("DROP TYPE media_status")
    op.execute("DROP TYPE pool_invitation_status")
    op.execute("DROP TYPE audit_actor_type")
    op.execute("DROP TYPE email_code_purpose")
    op.execute("DROP TYPE age_band")
    op.execute("DROP TYPE gender")
    op.execute("DROP TYPE occupation")
    op.execute("DROP TYPE transport_mode")
