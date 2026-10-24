from datetime import UTC, date, time

from scheduler.domains import (
    SLOTS_PER_DAY,
    availability_slot_indexes,
    forbidden_mask_for_minute,
    forbidden_mask_for_slot,
    minute_of_day,
    part_of_minute,
    part_of_slot,
    prompt_slot_indexes,
    slot_datetime,
    slot_index_of,
    window_slot_indexes,
)
from scheduler.model import Activity, AvailabilityInterval, Participant, TimeWindow

MONDAY = date(2026, 11, 2)


def test_window_generates_quarter_hour_slots() -> None:
    indexes = window_slot_indexes(TimeWindow(time(8), time(22)))

    assert len(indexes) == 56
    assert indexes[0] == 32  # 08:00
    assert indexes[-1] == 87  # 21:45, ending at 22:00
    assert slot_datetime(MONDAY, indexes[0], UTC).strftime("%H:%M") == "08:00"
    assert slot_datetime(MONDAY, indexes[-1], UTC).strftime("%H:%M") == "21:45"


def test_window_trims_slots_that_do_not_fit() -> None:
    indexes = window_slot_indexes(TimeWindow(time(8, 10), time(9)))

    assert indexes == (33, 34, 35)
    assert [slot_datetime(MONDAY, index, UTC).strftime("%H:%M") for index in indexes] == [
        "08:15",
        "08:30",
        "08:45",
    ]


def test_window_keeps_second_precision() -> None:
    indexes = window_slot_indexes(TimeWindow(time(8, 0, 30), time(8, 30)))

    assert indexes == (33,)  # 08:15 is the first aligned start after 08:00:30


def test_window_shorter_than_a_slot_keeps_its_aligned_start() -> None:
    indexes = window_slot_indexes(TimeWindow(time(8), time(8, 10)))

    assert indexes == (32,)  # 08:00 is inside the window


def test_slot_index_and_minute_of_day() -> None:
    value = slot_datetime(MONDAY, 34, UTC)

    assert minute_of_day(value) == 8 * 60 + 30
    assert slot_index_of(value) == 34


def test_availability_uses_the_weekday_of_the_date() -> None:
    participant = Participant(
        "p",
        availability=(
            AvailabilityInterval(time(8), time(10), frozenset({1})),
            AvailabilityInterval(time(14), time(16), frozenset({2})),
        ),
    )

    assert availability_slot_indexes(participant, 1) == frozenset(range(32, 40))
    assert availability_slot_indexes(participant, 2) == frozenset(range(56, 64))
    assert availability_slot_indexes(participant, 3) == frozenset()


def test_availability_is_the_union_of_intervals() -> None:
    participant = Participant(
        "p",
        availability=(
            AvailabilityInterval(time(8), time(9), frozenset({1})),
            AvailabilityInterval(time(8, 30), time(10), frozenset({1})),
        ),
    )

    assert availability_slot_indexes(participant, 1) == frozenset(range(32, 40))


def test_no_interval_on_the_weekday_gives_an_empty_domain() -> None:
    participant = Participant(
        "p", availability=(AvailabilityInterval(time(8), time(10), frozenset({2})),)
    )
    activity = Activity("a", 1, 0, TimeWindow(time(8), time(12)))

    assert prompt_slot_indexes(participant, activity, MONDAY) == ()


def test_any_time_uses_the_whole_activity_window() -> None:
    participant = Participant("p", any_time=True)
    activity = Activity("a", 1, 0, TimeWindow(time(8), time(10)))

    assert prompt_slot_indexes(participant, activity, MONDAY) == tuple(range(32, 40))


def test_prompt_domain_is_window_intersected_with_availability() -> None:
    participant = Participant(
        "p", availability=(AvailabilityInterval(time(9), time(23), frozenset({1})),)
    )
    activity = Activity("a", 1, 0, TimeWindow(time(8), time(10)))

    assert prompt_slot_indexes(participant, activity, MONDAY) == tuple(range(36, 40))


def test_forbidden_slot_mask_respects_the_gap() -> None:
    forbidden = forbidden_mask_for_slot(32, 60)

    assert forbidden & (1 << 29)  # 07:15 is 45 minutes away
    assert forbidden & (1 << 32)  # the slot itself
    assert not forbidden & (1 << 28)  # 07:00 is exactly 60 minutes away
    assert not forbidden & (1 << 36)  # 09:00 is exactly 60 minutes away


def test_forbidden_minute_mask_respects_an_unaligned_fixed_prompt() -> None:
    forbidden = forbidden_mask_for_minute(9 * 60 + 7, 60)

    assert forbidden & (1 << 33)  # 08:15
    assert forbidden & (1 << 36)  # 09:00
    assert forbidden & (1 << 39)  # 09:45
    assert forbidden & (1 << 40)  # 10:00 is 53 minutes away
    assert not forbidden & (1 << 32)  # 08:00 is 67 minutes away
    assert not forbidden & (1 << 41)  # 10:15 is 68 minutes away


def test_forbidden_mask_keeps_the_seconds_of_a_fixed_prompt() -> None:
    forbidden = forbidden_mask_for_minute(9 * 60, 60, second=59)

    assert forbidden & (1 << 40)  # 10:00 is 59m01s away
    assert not forbidden & (1 << 41)  # 10:15 is 74m01s away


def test_day_parts_follow_scheduler_md_and_have_no_credit_outside() -> None:
    parts = {part_of_slot(index) for index in range(SLOTS_PER_DAY)}

    assert parts == {None, 0, 1, 2, 3}
    assert part_of_slot(32) == 0  # 08:00
    assert part_of_slot(44) == 1  # 11:00
    assert part_of_slot(56) == 2  # 14:00
    assert part_of_slot(72) == 3  # 18:00
    assert part_of_minute(7 * 60) is None
    assert part_of_minute(22 * 60) is None
