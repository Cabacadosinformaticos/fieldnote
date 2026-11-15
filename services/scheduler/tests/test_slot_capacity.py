"""The platform-wide weighted slot capacity of the whole-study CSP."""

from datetime import time

import pytest

from scheduler.domains import slot_index_of
from scheduler.model import Participant, UnplannedReason
from scheduler.plan import plan_day

from ._helpers import (
    assert_valid_plan,
    brute_force_best,
    make_activity,
    make_study,
    timeline_reasons,
)


def test_activity_weight_is_the_heaviest_of_its_entry_types() -> None:
    assert make_activity(entry_types=("text",)).weight == 1
    assert make_activity(entry_types=("scale",)).weight == 1
    assert make_activity(entry_types=("choice",)).weight == 1
    assert make_activity(entry_types=("photo",)).weight == 2
    assert make_activity(entry_types=("audio",)).weight == 2
    assert make_activity(entry_types=("video",)).weight == 5
    assert make_activity(entry_types=("text", "video")).weight == 5
    assert make_activity(entry_types=("text", "audio", "photo")).weight == 2


def test_activity_rejects_empty_or_unknown_entry_types() -> None:
    with pytest.raises(ValueError):
        make_activity(entry_types=())
    with pytest.raises(ValueError):
        make_activity(entry_types=("unknown",))


def test_external_video_load_fills_a_slot_of_capacity_five() -> None:
    study = make_study(
        activities=(
            make_activity("video", entry_types=("video",), start=time(8), end=time(8, 15)),
            make_activity("text", entry_types=("text",), start=time(8, 15), end=time(8, 30)),
        ),
        participants=(Participant("p", any_time=True),),
        slot_capacity=5,
    )
    external = {32: 5}  # 08:00 already carries one video from another study.

    plan = plan_day(study, external_slot_load=external)

    assert plan.finished
    assert_valid_plan(study, plan, external_slot_load=external)
    assert [
        (prompt.activity_id, prompt.scheduled_at.strftime("%H:%M")) for prompt in plan.planned
    ] == [("text", "08:15")]
    assert [(prompt.activity_id, prompt.reason) for prompt in plan.unplanned] == [
        ("video", UnplannedReason.SLOT_CAP)
    ]


def test_external_load_blocks_its_slot_with_slot_cap_reason() -> None:
    study = make_study(
        activities=(
            make_activity("video", entry_types=("video",), start=time(8), end=time(8, 15)),
        ),
        participants=(Participant("p", any_time=True),),
        slot_capacity=5,
    )

    plan = plan_day(study, external_slot_load={32: 5})

    assert plan.finished
    assert timeline_reasons(plan) == [("p", "video", 0, UnplannedReason.SLOT_CAP)]


def test_two_videos_cannot_share_a_slot_of_capacity_nine() -> None:
    study = make_study(
        activities=(
            make_activity("video", entry_types=("video",), start=time(8), end=time(8, 30)),
        ),
        participants=(Participant("p1", any_time=True), Participant("p2", any_time=True)),
        slot_capacity=9,
        max_prompts_per_slot=10,
    )

    plan = plan_day(study)

    assert plan.finished
    assert plan.planned_count == 2
    assert_valid_plan(study, plan)
    slots = {slot_index_of(prompt.scheduled_at, study.study.time_zone) for prompt in plan.planned}
    assert len(slots) == 2


@pytest.mark.parametrize(
    "slot_capacity,max_per_day,max_per_slot,external",
    [
        (1, 2, 10, None),
        (2, 2, 10, None),
        (5, 3, 10, {32: 5}),
        (9, 2, 10, {32: 1}),
        (5, 2, 1, {33: 2}),
    ],
)
def test_binding_capacities_match_brute_force(
    slot_capacity: int,
    max_per_day: int,
    max_per_slot: int,
    external: dict[int, int] | None,
) -> None:
    study = make_study(
        activities=(
            make_activity("text", entry_types=("text",), start=time(8), end=time(8, 30)),
            make_activity("video", entry_types=("video",), start=time(8), end=time(8, 30)),
        ),
        participants=(Participant("p", any_time=True),),
        max_prompts_per_day=max_per_day,
        max_prompts_per_slot=max_per_slot,
        slot_capacity=slot_capacity,
    )

    plan = plan_day(study, external_slot_load=external)

    assert plan.finished
    assert_valid_plan(study, plan, external_slot_load=external)
    assert (plan.planned_count, plan.score) == brute_force_best(study, external_slot_load=external)
