import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ErasureFileDeletion(Base):
    """Files still to delete after the participant rows are already gone.

    The database erasure commits first (FR-44), so a storage failure must not bring the rows
    back. This row is the durable reminder the job retries; it is removed once the objects are
    deleted and the ``participant_erased`` audit row is written.
    """

    __tablename__ = "erasure_file_deletion"

    participant_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    study_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    entries: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ErasureRequest(Base):
    """An erasure asked outside the app, passed by the research team to the administrator (UC17).

    The team records the request once it has decided to grant it; the administrator then erases
    the participant through FR-44 and the request is marked done.
    """

    __tablename__ = "erasure_request"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'done', 'cancelled')", name="ck_erasure_request_status_valid"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    # Set to null when the participant is erased; the alias and the counts stay as the record.
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("participant.id", ondelete="SET NULL"), index=True
    )
    participant_alias: Mapped[str] = mapped_column(Text)
    entries: Mapped[int | None] = mapped_column(Integer)
    files: Mapped[int | None] = mapped_column(Integer)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("user_account.id", ondelete="SET NULL")
    )
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    done_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("user_account.id", ondelete="SET NULL")
    )
