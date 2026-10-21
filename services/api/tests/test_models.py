from sqlalchemy import BigInteger, DateTime, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import ENUM

from app.models import (
    AccountDeviceToken,
    AccountEmailCode,
    AccountParticipation,
    Activity,
    AuditLog,
    Availability,
    Base,
    Consent,
    Entry,
    EntryTag,
    InviteCode,
    LeaderLease,
    MediaObject,
    OutboxEvent,
    Participant,
    ParticipantAccount,
    ParticipantIdentity,
    PlanRun,
    PoolInvitation,
    PoolMember,
    Prompt,
    RefreshToken,
    Study,
    StudyAnswer,
    StudyMember,
    StudyQuestion,
    Tag,
    UserAccount,
)
from app.models.enums import ParticipantStatus, StudyRole

MODELS = (
    AccountDeviceToken,
    AccountEmailCode,
    AccountParticipation,
    Activity,
    AuditLog,
    Availability,
    Consent,
    Entry,
    EntryTag,
    InviteCode,
    LeaderLease,
    MediaObject,
    OutboxEvent,
    Participant,
    ParticipantAccount,
    ParticipantIdentity,
    PlanRun,
    PoolInvitation,
    PoolMember,
    Prompt,
    RefreshToken,
    Study,
    StudyAnswer,
    StudyMember,
    StudyQuestion,
    Tag,
    UserAccount,
)

DOCUMENT_TABLES = {
    "account_device_token",
    "account_email_code",
    "account_participation",
    "activity",
    "audit_log",
    "availability",
    "consent",
    "entry",
    "entry_tag",
    "invite_code",
    "leader_lease",
    "media_object",
    "outbox_event",
    "participant",
    "participant_account",
    "participant_identity",
    "plan_run",
    "pool_invitation",
    "pool_member",
    "prompt",
    "refresh_token",
    "study",
    "study_answer",
    "study_member",
    "study_question",
    "tag",
    "user_account",
}

# The document uses a bigint sequence for the outbox and the audit log, and the lease name as key.
NON_UUID_PRIMARY_KEYS = {
    "audit_log": BigInteger,
    "leader_lease": Text,
    "outbox_event": BigInteger,
}


def test_every_model_is_declarative() -> None:
    for model in MODELS:
        assert issubclass(model, Base)
        assert model.__tablename__ in DOCUMENT_TABLES


def test_every_table_of_the_document_exists() -> None:
    assert set(Base.metadata.tables) == DOCUMENT_TABLES


def test_primary_keys_are_uuids_unless_documented_otherwise() -> None:
    for table in Base.metadata.tables.values():
        primary_keys = list(table.primary_key.columns)
        assert primary_keys, f"{table.name} has no primary key"
        expected_type = NON_UUID_PRIMARY_KEYS.get(table.name, Uuid)
        for primary_key in primary_keys:
            assert isinstance(primary_key.type, expected_type), (
                f"{table.name}.{primary_key.name} is {primary_key.type}"
            )


def test_timestamp_columns_are_timezone_aware() -> None:
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if not column.name.endswith("_at"):
                continue
            assert isinstance(column.type, DateTime), f"{table.name}.{column.name}"
            assert column.type.timezone is True, f"{table.name}.{column.name} is not timestamptz"


def test_every_foreign_key_has_an_ondelete_rule() -> None:
    for table in Base.metadata.tables.values():
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                assert foreign_key.ondelete is not None, (
                    f"{table.name}.{column.name} has no ondelete"
                )


def test_enum_columns_use_named_postgresql_types() -> None:
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, ENUM):
                assert column.type.name, f"{table.name}.{column.name} has an unnamed enum"


def test_the_document_unique_keys_exist() -> None:
    expected = {
        "account_participation": {("account_id", "study_id")},
        "participant": {("study_id", "device_hash")},
        "prompt": {("participant_id", "activity_id", "plan_date", "occurrence")},
        "study_answer": {("participant_id", "question_id")},
    }
    for table_name, column_sets in expected.items():
        table = Base.metadata.tables[table_name]
        found = {
            tuple(column.name for column in constraint.columns)
            for constraint in table.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        assert column_sets <= found, f"{table_name}: {found}"


def test_no_android_id_is_stored() -> None:
    column_names = {
        column.name for table in Base.metadata.tables.values() for column in table.columns
    }
    assert "android_id" not in column_names


def test_fixed_participant_states_and_study_roles() -> None:
    assert {status.value for status in ParticipantStatus} == {
        "active",
        "pending_approval",
        "declined",
        "withdrawn",
        "removed",
        "erasure_scheduled",
    }
    assert {role.value for role in StudyRole} == {
        "principal_investigator",
        "co_investigator",
        "member",
    }
