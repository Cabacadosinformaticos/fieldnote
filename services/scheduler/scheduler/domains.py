"""15-minute slots, availability sets and the bit masks the solver works with.

A slot is identified by its index in the day: index 32 is 08:00, index 87 is 21:45. Slots are
aligned to the clock, so a window that starts at 08:10 begins at 08:15 and one that ends at
09:02 ends at 09:00. A slot belongs to a window or interval when its start is inside the
half-open span; this also gives a short window such as 08:00-08:10 its 08:00 slot. Seconds are
kept when a window, interval or fixed prompt is not aligned to the quarter-hour.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Iterable, Sequence
from datetime import date, datetime, time, tzinfo

from .model import Activity, AvailabilityInterval, Participant, TimeWindow

SLOT_MINUTES = 15
SECONDS_PER_SLOT = SLOT_MINUTES * 60
MINUTES_PER_DAY = 24 * 60
SECONDS_PER_DAY = MINUTES_PER_DAY * 60
SLOTS_PER_DAY = MINUTES_PER_DAY // SLOT_MINUTES
FULL_SLOT_MASK = (1 << SLOTS_PER_DAY) - 1
DAY_PART_BOUNDARIES = (11 * 60, 14 * 60, 18 * 60)
DAY_PART_START = 8 * 60
DAY_PART_END = 22 * 60


def time_to_minute(value: time) -> int:
    """Minutes since midnight. Seconds are ignored because slots are quarter-hours."""
    return value.hour * 60 + value.minute


def time_to_second(value: time) -> int:
    """Seconds since midnight, keeping the seconds field of the time."""
    return value.hour * 3600 + value.minute * 60 + value.second


def minute_to_time(minute: int) -> time:
    if not 0 <= minute < MINUTES_PER_DAY:
        raise ValueError("minute must be in 0..1439")
    return time(hour=minute // 60, minute=minute % 60)


def minute_of_day(value: datetime, time_zone: tzinfo | None = None) -> int:
    """Minute of the day in ``time_zone`` (or in the value's own zone)."""
    if value.tzinfo is not None and time_zone is not None:
        value = value.astimezone(time_zone)
    return value.hour * 60 + value.minute


def second_of_day(value: datetime, time_zone: tzinfo | None = None) -> int:
    """Second of the day in ``time_zone``, used by fixed prompts in gap checks."""
    if value.tzinfo is not None and time_zone is not None:
        value = value.astimezone(time_zone)
    return value.hour * 3600 + value.minute * 60 + value.second


def slot_index_of(value: datetime, time_zone: tzinfo | None = None) -> int:
    return minute_of_day(value, time_zone) // SLOT_MINUTES


def slot_datetime(plan_date: date, slot_index: int, time_zone: tzinfo) -> datetime:
    """The start of a slot as an aware datetime in the study's time zone."""
    minute = slot_index * SLOT_MINUTES
    return datetime.combine(plan_date, minute_to_time(minute), tzinfo=time_zone)


def mask_between(first: int, last: int) -> int:
    """A mask with every slot index from ``first`` to ``last`` inclusive, clipped to the day."""
    first = max(first, 0)
    last = min(last, SLOTS_PER_DAY - 1)
    if last < first:
        return 0
    return ((1 << (last - first + 1)) - 1) << first


def indexes_to_mask(indexes: Iterable[int]) -> int:
    mask = 0
    for index in indexes:
        if 0 <= index < SLOTS_PER_DAY:
            mask |= 1 << index
    return mask


def slot_indexes_of_second_span(start_second: int, end_second: int) -> tuple[int, ...]:
    """Aligned slot starts inside a half-open span, with second precision."""
    first = (start_second + SECONDS_PER_SLOT - 1) // SECONDS_PER_SLOT
    last = (end_second - 1) // SECONDS_PER_SLOT
    if last < first:
        return ()
    return tuple(range(first, last + 1))


def slot_indexes_of_span(start_minute: int, end_minute: int) -> tuple[int, ...]:
    """Aligned slot starts inside a half-open minute span."""
    return slot_indexes_of_second_span(start_minute * 60, end_minute * 60)


def window_slot_indexes(window: TimeWindow) -> tuple[int, ...]:
    return slot_indexes_of_second_span(time_to_second(window.start), time_to_second(window.end))


def interval_slot_indexes(interval: AvailabilityInterval) -> tuple[int, ...]:
    return slot_indexes_of_second_span(time_to_second(interval.start), time_to_second(interval.end))


def availability_slot_indexes(participant: Participant, weekday: int) -> frozenset[int]:
    """The union of the participant's intervals that apply on an ISO weekday (1..7).

    A participant who chose "any time" has no intervals; callers must use the activity window
    then. The function returns an empty set, like the database does.
    """
    mask = 0
    for interval in participant.availability:
        if weekday in interval.weekdays:
            mask |= indexes_to_mask(interval_slot_indexes(interval))
    return frozenset(_set_bits(mask))


def prompt_slot_indexes(
    participant: Participant, activity: Activity, plan_date: date
) -> tuple[int, ...]:
    """The domain before the search: activity window intersected with the day's availability.

    A participant who chose "any time" gets the whole activity window (FR-46, data model).
    """
    window_mask = indexes_to_mask(window_slot_indexes(activity.window))
    if participant.any_time:
        return tuple(_set_bits(window_mask))
    availability_mask = indexes_to_mask(
        availability_slot_indexes(participant, plan_date.isoweekday())
    )
    return tuple(_set_bits(window_mask & availability_mask))


def _set_bits(mask: int) -> list[int]:
    indexes: list[int] = []
    while mask:
        bit = mask & -mask
        indexes.append(bit.bit_length() - 1)
        mask ^= bit
    return indexes


def forbidden_mask_for_slot(slot_index: int, gap_minutes: int) -> int:
    """Slots too close to ``slot_index`` for a minimum gap, including the slot itself."""
    if gap_minutes <= 0:
        return 0
    radius = (gap_minutes - 1) // SLOT_MINUTES
    return mask_between(slot_index - radius, slot_index + radius)


def forbidden_mask_for_second(second: int, gap_minutes: int) -> int:
    """Slots whose start is closer than ``gap_minutes`` to an exact second of the day."""
    if gap_minutes <= 0:
        return 0
    gap_seconds = gap_minutes * 60
    first = (second - gap_seconds) // SECONDS_PER_SLOT + 1
    last = (second + gap_seconds - 1) // SECONDS_PER_SLOT
    return mask_between(first, last)


def forbidden_mask_for_minute(minute: int, gap_minutes: int, second: int = 0) -> int:
    """Slots whose start is closer than ``gap_minutes`` to an exact moment of the day."""
    return forbidden_mask_for_second(minute * 60 + second, gap_minutes)


def distance_mask(minute: int, minimum_minutes: int = 60) -> int:
    """Slots at least ``minimum_minutes`` away from an exact minute of the day."""
    too_close = forbidden_mask_for_minute(minute, minimum_minutes)
    return FULL_SLOT_MASK & ~too_close


def part_of_minute(minute: int) -> int | None:
    """The scheduler.md part of the day, or ``None`` outside 08:00-22:00."""
    if not DAY_PART_START <= minute < DAY_PART_END:
        return None
    if minute < DAY_PART_BOUNDARIES[0]:
        return 0
    if minute < DAY_PART_BOUNDARIES[1]:
        return 1
    if minute < DAY_PART_BOUNDARIES[2]:
        return 2
    return 3


def part_of_slot(slot_index: int) -> int | None:
    return part_of_minute(slot_index * SLOT_MINUTES)


PART_MASKS: tuple[int, ...] = tuple(
    indexes_to_mask(index for index in range(SLOTS_PER_DAY) if part_of_slot(index) == part)
    for part in range(4)
)


def revise(domains: Sequence[int], gaps: Sequence[int], left: int, right: int) -> tuple[int, int]:
    """Arc consistency between two prompts of the same participant.

    Returns the values removed from ``left`` and the new domain as a pair ``(removed, domain)``
    so the caller can keep the function free of side effects.
    """
    left_domain = domains[left]
    right_domain = domains[right]
    if left_domain == 0 or right_domain == 0:
        return 0, left_domain
    gap = max(gaps[left], gaps[right])
    removed = 0
    remaining = left_domain
    while remaining:
        bit = remaining & -remaining
        slot_index = bit.bit_length() - 1
        if right_domain & ~forbidden_mask_for_slot(slot_index, gap) == 0:
            removed |= bit
        remaining ^= bit
    return removed, left_domain & ~removed


def ac3(domains: list[int], gaps: Sequence[int], active: Sequence[int]) -> list[int]:
    """AC-3 over the minimum-gap constraints of the prompts in ``active``.

    ``domains`` is mutated in place. The returned indexes are the active prompts whose domain
    became empty; the caller removes them from the problem and runs AC-3 again, because a
    removed prompt no longer supports the others.
    """
    queue: deque[tuple[int, int]] = deque(
        (left, right) for left in active for right in active if left != right
    )
    emptied: list[int] = []
    while queue:
        left, right = queue.popleft()
        if left in emptied or right in emptied:
            continue
        if domains[left] == 0 or domains[right] == 0:
            continue
        removed, new_domain = revise(domains, gaps, left, right)
        if not removed:
            continue
        domains[left] = new_domain
        if new_domain == 0:
            emptied.append(left)
            continue
        for other in active:
            if other != left and other != right:
                queue.append((other, left))
    return emptied


__all__ = [
    "DAY_PART_BOUNDARIES",
    "DAY_PART_END",
    "DAY_PART_START",
    "FULL_SLOT_MASK",
    "MINUTES_PER_DAY",
    "PART_MASKS",
    "SECONDS_PER_DAY",
    "SECONDS_PER_SLOT",
    "SLOT_MINUTES",
    "SLOTS_PER_DAY",
    "ac3",
    "availability_slot_indexes",
    "distance_mask",
    "forbidden_mask_for_minute",
    "forbidden_mask_for_second",
    "forbidden_mask_for_slot",
    "indexes_to_mask",
    "interval_slot_indexes",
    "mask_between",
    "minute_of_day",
    "minute_to_time",
    "part_of_minute",
    "part_of_slot",
    "prompt_slot_indexes",
    "revise",
    "second_of_day",
    "slot_datetime",
    "slot_index_of",
    "slot_indexes_of_second_span",
    "slot_indexes_of_span",
    "time_to_minute",
    "time_to_second",
    "window_slot_indexes",
]
