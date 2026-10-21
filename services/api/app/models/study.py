import uuid
from datetime import date, time

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    LargeBinary,
    Text,
    Time,
    Uuid,
)
from sqlalchemy import (
    text as sa_text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import (
    QuestionKind,
    ScheduleStyle,
    StudyRole,
    StudyStatus,
    question_kind,
    schedule_style,
    study_role,
    study_status,
)


class Study(Base):
    __tablename__ = "study"
    __table_args__ = (CheckConstraint("octet_length(device_salt) = 32", name="device_salt_length"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[StudyStatus] = mapped_column(study_status, server_default=sa_text("'draft'"))
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    timezone: Mapped[str] = mapped_column(Text)
    max_prompts_per_day: Mapped[int] = mapped_column(Integer)
    max_prompts_per_slot: Mapped[int] = mapped_column(Integer)
    schedule_style: Mapped[ScheduleStyle] = mapped_column(schedule_style)
    device_salt: Mapped[bytes] = mapped_column(LargeBinary(32))


class StudyMember(Base):
    __tablename__ = "study_member"

    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[StudyRole] = mapped_column(study_role)


class Activity(Base):
    __tablename__ = "activity"
    __table_args__ = (
        CheckConstraint(
            "cardinality(entry_types) >= 1 AND "
            "entry_types <@ ARRAY['text', 'photo', 'video', 'audio', 'scale', 'choice']::text[]",
            name="entry_types_valid",
        ),
        CheckConstraint(
            "options IS NULL OR NOT options ? 'scale_type' OR "
            "options->>'scale_type' IN ('numbers', 'faces', 'text', 'slider')",
            name="scale_type_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(Text)
    instructions: Mapped[str | None] = mapped_column(Text)
    entry_types: Mapped[list[str]] = mapped_column(ARRAY(Text))
    options: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    prompts_per_day: Mapped[int] = mapped_column(Integer)
    window_start: Mapped[time] = mapped_column(Time)
    window_end: Mapped[time] = mapped_column(Time)
    min_gap_minutes: Mapped[int] = mapped_column(Integer)
    capture_location: Mapped[bool] = mapped_column(Boolean, server_default=sa_text("false"))
    allow_free_entries: Mapped[bool] = mapped_column(Boolean, server_default=sa_text("false"))
    max_free_entries_per_day: Mapped[int | None] = mapped_column(Integer)
    expected_minutes: Mapped[int] = mapped_column(Integer)


class StudyQuestion(Base):
    __tablename__ = "study_question"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    kind: Mapped[QuestionKind] = mapped_column(question_kind)
    text: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=sa_text("'{}'::text[]"))


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(Text)


__all__ = ["Activity", "Study", "StudyMember", "StudyQuestion", "Tag"]
