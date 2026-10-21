import uuid
from datetime import datetime, time

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import (
    InviteCodeKind,
    Locale,
    ParticipantStatus,
    QuestionKind,
    invite_code_kind,
    locale,
    participant_status,
    question_kind,
)


class Participant(Base):
    __tablename__ = "participant"
    __table_args__ = (
        UniqueConstraint("study_id", "device_hash", name="uq_participant_study_device_hash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    alias: Mapped[str | None] = mapped_column(Text)
    admitted_by_code_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "invite_code.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_participant_admitted_by_code_id_invite_code",
        ),
        index=True,
    )
    device_token_hash: Mapped[str | None] = mapped_column(Text, index=True, unique=True)
    push_token: Mapped[str | None] = mapped_column(Text)
    device_hash: Mapped[str | None] = mapped_column(Text)
    entered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locale: Mapped[Locale | None] = mapped_column(locale)
    status: Mapped[ParticipantStatus] = mapped_column(
        participant_status, server_default=text("'active'")
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="SET NULL"), index=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    erasure_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    erasure_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status_before_erasure: Mapped[ParticipantStatus | None] = mapped_column(participant_status)
    availability_any_time: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class ParticipantIdentity(Base):
    __tablename__ = "participant_identity"

    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)


class Consent(Base):
    __tablename__ = "consent"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[str] = mapped_column(Text)
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Availability(Base):
    __tablename__ = "availability"
    __table_args__ = (
        CheckConstraint(
            "cardinality(weekdays) >= 1 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]",
            name="weekdays_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    weekdays: Mapped[list[int]] = mapped_column(ARRAY(Integer))


class StudyAnswer(Base):
    __tablename__ = "study_answer"
    __table_args__ = (
        UniqueConstraint(
            "participant_id", "question_id", name="uq_study_answer_participant_question"
        ),
        CheckConstraint("char_length(answer) <= 300", name="answer_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("study_question.id", ondelete="SET NULL"), index=True
    )
    question_text: Mapped[str] = mapped_column(Text)
    kind: Mapped[QuestionKind] = mapped_column(question_kind)
    answer: Mapped[str] = mapped_column(Text)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class InviteCode(Base):
    __tablename__ = "invite_code"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'personal' AND code_hash IS NOT NULL AND code_value IS NULL) OR "
            "(kind = 'study' AND code_value IS NOT NULL AND code_hash IS NULL)",
            name="code_kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[InviteCodeKind] = mapped_column(invite_code_kind)
    code_hash: Mapped[str | None] = mapped_column(Text, unique=True)
    code_value: Mapped[str | None] = mapped_column(Text, unique=True)
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str | None] = mapped_column(Text)
    max_uses: Mapped[int | None] = mapped_column(Integer)
    max_per_hour: Mapped[int | None] = mapped_column(Integer)
    uses: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    requires_approval: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    requires_account: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
