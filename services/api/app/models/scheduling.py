import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import (
    PromptStatus,
    UnplannedReason,
    prompt_status,
    unplanned_reason,
)


class Prompt(Base):
    __tablename__ = "prompt"
    __table_args__ = (
        UniqueConstraint(
            "participant_id",
            "activity_id",
            "plan_date",
            "occurrence",
            name="uq_prompt_participant_activity_plan_date_occurrence",
        ),
        CheckConstraint(
            "unplanned_reason IS NULL OR status = 'unplanned'",
            name="unplanned_reason_matches_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("activity.id", ondelete="CASCADE"), index=True
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("participant.id", ondelete="CASCADE"), index=True
    )
    plan_date: Mapped[date] = mapped_column(Date)
    occurrence: Mapped[int] = mapped_column(Integer)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[PromptStatus] = mapped_column(prompt_status)
    unplanned_reason: Mapped[UnplannedReason | None] = mapped_column(unplanned_reason)


class PlanRun(Base):
    __tablename__ = "plan_run"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study.id", ondelete="CASCADE"), index=True
    )
    plan_date: Mapped[date] = mapped_column(Date)
    finished: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    nodes_expanded: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    planned: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    unplanned: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    solve_ms: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class LeaderLease(Base):
    __tablename__ = "leader_lease"

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    holder: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
