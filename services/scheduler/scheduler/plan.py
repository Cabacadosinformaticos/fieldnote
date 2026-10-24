"""Public planning entry points: a whole study day and a mid-day replan of one participant."""

from __future__ import annotations

import time
from collections.abc import Iterable
from datetime import datetime, tzinfo

from .domains import slot_datetime
from .model import (
    DayPlan,
    FixedPrompt,
    PlannedPrompt,
    StudyDay,
    UnplannedPrompt,
)
from .solver import (
    DEFAULT_NODE_LIMIT,
    SearchOptions,
    score_plan,
    solve_study,
)


def plan_day(
    study_day: StudyDay,
    *,
    fixed_prompts: Iterable[FixedPrompt] = (),
    seed: int = 0,
    node_limit: int | None = DEFAULT_NODE_LIMIT,
    time_limit_seconds: float | None = None,
    options: SearchOptions | None = None,
) -> DayPlan:
    """Plan every remaining prompt of one study day as a single CSP.

    All prompts of all participants are variables of the same search, so the study-wide slot cap
    is part of the problem rather than a counter fed from earlier participants. The node budget
    is per study. ``time_limit_seconds`` is an optional wall-clock safety net, off by default;
    when it cuts the run, ``DayPlan.cut_reason`` says so. ``seed`` is kept for reproducibility of
    the run record; the deterministic ordering of scheduler.md does not depend on it.
    """
    started = time.monotonic()
    fixed = tuple(fixed_prompts)
    result = solve_study(
        study_day,
        fixed_prompts=fixed,
        options=options,
        node_limit=node_limit,
        time_limit_seconds=time_limit_seconds,
        seed=seed,
    )
    planned = [_fixed_planned(prompt, study_day.study.time_zone) for prompt in fixed]
    unplanned: list[UnplannedPrompt] = []
    for assignment in result.assignments:
        if assignment.slot_index is not None:
            planned.append(
                PlannedPrompt(
                    participant_id=assignment.participant_id,
                    activity_id=assignment.key.activity_id,
                    occurrence=assignment.key.occurrence,
                    scheduled_at=slot_datetime(
                        study_day.plan_date,
                        assignment.slot_index,
                        study_day.study.time_zone,
                    ),
                )
            )
        else:
            assert assignment.reason is not None
            unplanned.append(
                UnplannedPrompt(
                    participant_id=assignment.participant_id,
                    activity_id=assignment.key.activity_id,
                    occurrence=assignment.key.occurrence,
                    reason=assignment.reason,
                )
            )
    planned.sort(key=_planned_sort_key)
    unplanned.sort(key=_unplanned_sort_key)
    return DayPlan(
        plan_date=study_day.plan_date,
        planned=tuple(planned),
        unplanned=tuple(unplanned),
        score=score_plan(planned, study_day.study, study_day.history),
        finished=result.finished,
        nodes_expanded=result.nodes_expanded,
        backtracks=result.backtracks,
        solve_ms=int((time.monotonic() - started) * 1000),
        cut_reason=result.cut_reason,
    )


def replan_participant(
    study_day: StudyDay,
    participant_id: str,
    *,
    sent_prompts: Iterable[FixedPrompt] = (),
    other_planned_prompts: Iterable[FixedPrompt] = (),
    seed: int = 0,
    node_limit: int | None = DEFAULT_NODE_LIMIT,
    time_limit_seconds: float | None = None,
    options: SearchOptions | None = None,
) -> DayPlan:
    """Replan the remaining prompts of one participant after an availability change.

    ``sent_prompts`` are this participant's prompts already sent today; they stay fixed and
    count towards the daily cap, the slot counters and the gap. ``other_planned_prompts`` are
    the rest of today's plan (other participants); they feed the slot counters and the score but
    are not returned. The result holds only the replanned participant's prompts.
    """
    started = time.monotonic()
    activities_by_id = {activity.id: activity for activity in study_day.activities}
    participants_by_id = {participant.id: participant for participant in study_day.participants}
    if participant_id not in participants_by_id:
        raise ValueError(f"unknown participant {participant_id!r}")

    sent = tuple(sent_prompts)
    other = tuple(other_planned_prompts)
    if any(prompt.participant_id != participant_id for prompt in sent):
        raise ValueError("sent_prompts must all belong to the replanned participant")
    if any(prompt.participant_id == participant_id for prompt in other):
        raise ValueError("other_planned_prompts must belong to other participants")
    _validate_prompt_activities(sent, activities_by_id)
    _validate_prompt_activities(other, activities_by_id)

    result = solve_study(
        study_day,
        fixed_prompts=sent,
        participant_id=participant_id,
        other_slot_prompts=other,
        options=options,
        node_limit=node_limit,
        time_limit_seconds=time_limit_seconds,
        seed=seed,
    )

    planned = [_fixed_planned(prompt, study_day.study.time_zone) for prompt in sent]
    unplanned: list[UnplannedPrompt] = []
    for assignment in result.assignments:
        if assignment.slot_index is not None:
            planned.append(
                PlannedPrompt(
                    participant_id=assignment.participant_id,
                    activity_id=assignment.key.activity_id,
                    occurrence=assignment.key.occurrence,
                    scheduled_at=slot_datetime(
                        study_day.plan_date,
                        assignment.slot_index,
                        study_day.study.time_zone,
                    ),
                )
            )
        else:
            assert assignment.reason is not None
            unplanned.append(
                UnplannedPrompt(
                    participant_id=assignment.participant_id,
                    activity_id=assignment.key.activity_id,
                    occurrence=assignment.key.occurrence,
                    reason=assignment.reason,
                )
            )
    planned.sort(key=_planned_sort_key)
    unplanned.sort(key=_unplanned_sort_key)
    score_input = [
        *planned,
        *(
            PlannedPrompt(
                participant_id=prompt.participant_id,
                activity_id=prompt.activity_id,
                occurrence=prompt.occurrence,
                scheduled_at=_aware(prompt.scheduled_at, study_day.study.time_zone),
                fixed=True,
            )
            for prompt in other
        ),
    ]
    return DayPlan(
        plan_date=study_day.plan_date,
        planned=tuple(planned),
        unplanned=tuple(unplanned),
        score=score_plan(score_input, study_day.study, study_day.history),
        finished=result.finished,
        nodes_expanded=result.nodes_expanded,
        backtracks=result.backtracks,
        solve_ms=int((time.monotonic() - started) * 1000),
        cut_reason=result.cut_reason,
    )


def _validate_prompt_activities(
    prompts: Iterable[FixedPrompt], activities_by_id: dict[str, object]
) -> None:
    for prompt in prompts:
        if prompt.activity_id not in activities_by_id:
            raise ValueError(f"fixed prompt refers to unknown activity {prompt.activity_id!r}")


def _planned_sort_key(prompt: PlannedPrompt | FixedPrompt) -> tuple[str, str, int]:
    return prompt.participant_id, prompt.activity_id, prompt.occurrence


def _unplanned_sort_key(prompt: UnplannedPrompt) -> tuple[str, str, int]:
    return prompt.participant_id, prompt.activity_id, prompt.occurrence


def _aware(value: datetime, time_zone: tzinfo) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=time_zone)
    return value.astimezone(time_zone)


def _fixed_planned(prompt: FixedPrompt, time_zone: tzinfo) -> PlannedPrompt:
    return PlannedPrompt(
        participant_id=prompt.participant_id,
        activity_id=prompt.activity_id,
        occurrence=prompt.occurrence,
        scheduled_at=_aware(prompt.scheduled_at, time_zone),
        fixed=True,
    )


__all__ = ["plan_day", "replan_participant"]
