"""Append-only audit log helper.

The caller owns the transaction: a failed sign-in commits its row before raising, and a
successful action commits the row together with the change it describes.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, Participant, UserAccount
from app.models.enums import AuditActorType


def record(
    session: Session,
    actor: UserAccount | Participant | None,
    action: str,
    target: str | None = None,
    *,
    details: dict[str, Any] | None = None,
    actor_type: AuditActorType | None = None,
) -> AuditLog:
    if actor_type is None:
        if isinstance(actor, UserAccount):
            actor_type = AuditActorType.USER
        elif isinstance(actor, Participant):
            actor_type = AuditActorType.PARTICIPANT
        else:
            actor_type = AuditActorType.SYSTEM

    entry = AuditLog(
        actor_type=actor_type,
        actor_id=actor.id if actor is not None else None,
        action=action,
        target=target,
        details=details,
    )
    session.add(entry)
    return entry
