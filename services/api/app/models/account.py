import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import EmailCodePurpose, email_code_purpose


class ParticipantAccount(Base):
    __tablename__ = "participant_account"
    __table_args__ = (
        CheckConstraint(
            "recovery_lookup IS NOT NULL OR email_lookup IS NOT NULL "
            "OR google_subject_id IS NOT NULL",
            name="has_sign_in_method",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recovery_hash: Mapped[str | None] = mapped_column(Text)
    recovery_lookup: Mapped[str | None] = mapped_column(Text, unique=True)
    email_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    email_lookup: Mapped[str | None] = mapped_column(Text, unique=True)
    google_subject_id: Mapped[str | None] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AccountParticipation(Base):
    __tablename__ = "account_participation"
    __table_args__ = (
        UniqueConstraint("account_id", "study_id", name="uq_account_participation_account_study"),
    )

    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), primary_key=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant_account.id", ondelete="CASCADE"), index=True
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )


class AccountDeviceToken(Base):
    __tablename__ = "account_device_token"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant_account.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AccountEmailCode(Base):
    __tablename__ = "account_email_code"
    __table_args__ = (CheckConstraint("attempts >= 0 AND attempts <= 5", name="attempts_limit"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("participant_account.id", ondelete="CASCADE"), index=True
    )
    email_lookup: Mapped[str] = mapped_column(Text, index=True)
    email_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    purpose: Mapped[EmailCodePurpose] = mapped_column(email_code_purpose)
    code_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
