"""Read model for the plan of one study day.

A prompt is shown with the participant alias and the activity, the time it was planned for, its
status and, when it could not be planned, the reason the scheduler stored. Availability is the
union of the participant's intervals whose weekdays include the requested date (FR-46); a
participant who chose "any time" has no rows and the flag tells the dashboard so.
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Activity, Availability, Participant, PlanRun, Prompt, Study
from app.models.enums import ParticipantStatus
from app.services.entries_read import RESEARCHER_VISIBLE_STATUSES


def study_plan(session: Session, study_id: uuid.UUID, plan_date: date) -> dict[str, object]:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "study_not_found", "The study does not exist.")

    weekday = plan_date.isoweekday()
    participants = list(
        session.scalars(
            select(Participant)
            .where(
                Participant.study_id == study_id,
                Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
            )
            .order_by(Participant.alias, Participant.id)
        )
    )
    participant_ids = [participant.id for participant in participants]

    intervals: dict[uuid.UUID, list[dict[str, object]]] = {
        participant.id: [] for participant in participants
    }
    if participant_ids:
        rows = session.scalars(
            select(Availability)
            .where(Availability.participant_id.in_(participant_ids))
            .order_by(Availability.start_time, Availability.end_time, Availability.id)
        )
        for row in rows:
            if weekday in row.weekdays:
                intervals[row.participant_id].append(
                    {"start_time": row.start_time, "end_time": row.end_time}
                )

    prompts = []
    if participant_ids:
        prompt_rows = session.execute(
            select(Prompt, Participant.alias, Activity.title)
            .join(Participant, Participant.id == Prompt.participant_id)
            .join(Activity, Activity.id == Prompt.activity_id)
            .where(
                Prompt.participant_id.in_(participant_ids),
                Prompt.plan_date == plan_date,
            )
            .order_by(
                Participant.alias,
                Prompt.occurrence,
                Prompt.scheduled_at,
                Prompt.id,
            )
        ).all()
        prompts = [
            {
                "prompt_id": prompt.id,
                "participant_id": prompt.participant_id,
                "participant_alias": alias,
                "activity_id": prompt.activity_id,
                "activity_title": activity_title,
                "occurrence": prompt.occurrence,
                "scheduled_at": prompt.scheduled_at,
                "sent_at": prompt.sent_at,
                "status": prompt.status,
                "unplanned_reason": prompt.unplanned_reason,
            }
            for prompt, alias, activity_title in prompt_rows
        ]

    # The scheduler can write several rows for the same day (the day plan and its replans). The
    # row that planned the most prompts is the day plan; the others only add or move prompts.
    run_row = session.scalars(
        select(PlanRun)
        .where(PlanRun.study_id == study_id, PlanRun.plan_date == plan_date)
        .order_by(
            (PlanRun.planned + PlanRun.unplanned).desc(),
            PlanRun.finished.desc(),
            PlanRun.solve_ms.desc(),
        )
        .limit(1)
    ).first()
    run = (
        None
        if run_row is None
        else {
            "finished": run_row.finished,
            "nodes_expanded": run_row.nodes_expanded,
            "planned": run_row.planned,
            "unplanned": run_row.unplanned,
            "solve_ms": run_row.solve_ms,
            "created_at": run_row.created_at,
        }
    )

    return {
        "date": plan_date,
        "weekday": weekday,
        "participants": [
            {
                "participant_id": participant.id,
                "alias": participant.alias,
                "active": participant.status == ParticipantStatus.ACTIVE,
                "availability_any_time": bool(participant.availability_any_time),
                "availability": intervals[participant.id],
            }
            for participant in participants
        ],
        "prompts": prompts,
        "run": run,
    }
