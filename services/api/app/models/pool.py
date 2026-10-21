import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import (
    AgeBand,
    Gender,
    Occupation,
    PoolInvitationStatus,
    TransportMode,
    age_band,
    gender,
    occupation,
    pool_invitation_status,
    transport_mode,
)


class PoolMember(Base):
    __tablename__ = "pool_member"
    __table_args__ = (
        CheckConstraint(
            "languages IS NULL OR languages <@ ARRAY['pt', 'en']::text[]",
            name="languages_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    credential_hash: Mapped[str] = mapped_column(Text, unique=True)
    push_token: Mapped[str | None] = mapped_column(Text)
    concelho: Mapped[str] = mapped_column(Text)
    freguesia: Mapped[str | None] = mapped_column(Text)
    age_band: Mapped[AgeBand | None] = mapped_column(age_band)
    gender: Mapped[Gender | None] = mapped_column(gender)
    occupation: Mapped[Occupation | None] = mapped_column(occupation)
    usual_transport: Mapped[TransportMode | None] = mapped_column(transport_mode)
    languages: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    invitations_paused: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("participant_account.id", ondelete="SET NULL"), unique=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PoolInvitation(Base):
    __tablename__ = "pool_invitation"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    pool_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pool_member.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[PoolInvitationStatus] = mapped_column(
        pool_invitation_status, server_default=text("'sent'")
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
