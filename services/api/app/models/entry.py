import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import EntryType, MediaStatus, entry_type, media_status


class Entry(Base):
    __tablename__ = "entry"
    __table_args__ = (
        CheckConstraint(
            "scale_shown IS NULL OR NOT scale_shown ? 'scale_type' OR "
            "scale_shown->>'scale_type' IN ('numbers', 'faces', 'text', 'slider')",
            name="scale_shown_type_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("prompt.id", ondelete="SET NULL"), index=True
    )
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("activity.id", ondelete="SET NULL"), index=True
    )
    entry_type: Mapped[EntryType] = mapped_column(entry_type)
    content_sha256: Mapped[str] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    body: Mapped[str | None] = mapped_column(Text)
    value: Mapped[int | None] = mapped_column(Integer)
    scale_shown: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    choice: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)


class EntryTag(Base):
    __tablename__ = "entry_tag"

    entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("entry.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class MediaObject(Base):
    __tablename__ = "media_object"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("entry.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(Text)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(Text)
    status: Mapped[MediaStatus] = mapped_column(media_status, server_default=text("'pending'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
