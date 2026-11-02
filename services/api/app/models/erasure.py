import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Uuid, func
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
