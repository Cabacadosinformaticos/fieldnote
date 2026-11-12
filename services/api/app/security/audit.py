"""Append-only audit log helper.

The caller owns the transaction: a failed sign-in commits its row before raising, and a
successful action commits the row together with the change it describes.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, Participant, UserAccount
from app.models.enums import AuditActorType
from app.security import origin


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
    request_origin = origin.current()
    if request_origin is not None:
        entry.origin_client = request_origin.client
        # The address and the browser of a participant could identify the person and are not
        # erased with their data, so only team accounts keep them.
        if request_origin.client == origin.PORTAL and (
            isinstance(actor, UserAccount) or actor_type == AuditActorType.USER
        ):
            entry.origin_ip = request_origin.ip
            entry.origin_browser = request_origin.browser
    else:
        entry.origin_client = origin.process_client()
    session.add(entry)
    return entry
