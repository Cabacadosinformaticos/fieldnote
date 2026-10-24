"""One backtracking CSP for a whole study day.

Every remaining prompt of every selected participant is a variable (scheduler.md:22). Domains
are 15-minute slot bit masks plus the implicit value ⊥ ("not planned"), which is ordered last.
The search uses MRV, LCV, forward checking, an optional branch and bound, and a deterministic
node budget per study. The trail makes every assignment and propagation reversible.
"""

from __future__ import annotations

import time
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, tzinfo
from typing import Final

from .domains import (
    PART_MASKS,
    SLOT_MINUTES,
    ac3,
    distance_mask,
    forbidden_mask_for_second,
    forbidden_mask_for_slot,
    indexes_to_mask,
    minute_of_day,
    part_of_minute,
    part_of_slot,
    prompt_slot_indexes,
    second_of_day,
)
from .model import (
    Activity,
    CutReason,
    FixedPrompt,
    History,
    Participant,
    PlannedPrompt,
    PromptKey,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    UnplannedReason,
)

DEFAULT_NODE_LIMIT: Final[int | None] = 20_000
"""Per study. Evaluation runs pass the same explicit budget to every ablation variant."""

UNASSIGNED: Final = -2
BOTTOM: Final = -1


@dataclass(frozen=True)
class SearchOptions:
    """Explicit switches for the algorithm and its five ablation variants."""

    forward_checking: bool = True
    mrv: bool = True
    lcv: bool = True
    ac3: bool = True
    branch_and_bound: bool = True


@dataclass(frozen=True)
class SolvedAssignment:
    """What the solver decided for one prompt."""

    participant_id: str
    key: PromptKey
    slot_index: int | None
    reason: UnplannedReason | None

    @property
    def planned(self) -> bool:
        return self.slot_index is not None


@dataclass(frozen=True)
class StudyResult:
    """The result of one study-wide or replan search."""

    assignments: tuple[SolvedAssignment, ...]
    local_score: float
    finished: bool
    cut_reason: CutReason | None
    nodes_expanded: int
    backtracks: int


@dataclass(frozen=True)
class ParticipantResult:
    """Compatibility result for the replan-only :func:`solve_participant` helper."""

    assignments: tuple[SolvedAssignment, ...]
    local_score: float
    finished: bool
    nodes_expanded: int
    backtracks: int
    cut_reason: CutReason | None = None


def style_weights(style: ScheduleStyle) -> tuple[float, float]:
    """The weights of the variety term V and the routine term F."""
    if style is ScheduleStyle.VARIED:
        return 1.0, 0.0
    if style is ScheduleStyle.FIXED:
        return 0.0, 1.0
    return 0.5, 0.5


def score_plan(planned: Iterable[PlannedPrompt], study: StudyConfig, history: History) -> float:
    """The soft score of a whole day plan (fixed prompts included).

    V: +1 per prompt at least 60 minutes from yesterday's equivalent prompt, and +1 per
    participant and part of the day that the plan covers today but the last three days did not.
    F: +1 per prompt in the same 15-minute slot as yesterday's equivalent prompt. The style
    decides the weights. Equivalent means the same activity and occurrence. A prompt outside
    08:00-22:00 covers none of the four parts of scheduler.md.
    """
    variety_weight, routine_weight = style_weights(study.schedule_style)
    yesterday: dict[tuple[str, str, int], int] = {}
    for item in history.yesterday:
        yesterday[(item.participant_id, item.activity_id, item.occurrence)] = minute_of_day(
            item.scheduled_at, study.time_zone
        )
    recent: dict[str, set[int]] = {}
    for item in history.recent_parts:
        recent.setdefault(item.participant_id, set()).update(item.parts)

    covered: dict[str, set[int]] = {}
    score = 0.0
    for prompt in planned:
        minute = minute_of_day(prompt.scheduled_at, study.time_zone)
        equivalent = yesterday.get((prompt.participant_id, prompt.activity_id, prompt.occurrence))
        if equivalent is not None:
            if abs(minute - equivalent) >= 60:
                score += variety_weight
            if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
                score += routine_weight
        part = part_of_minute(minute)
        if part is not None:
            covered.setdefault(prompt.participant_id, set()).add(part)

    for participant_id, parts in covered.items():
        for part in parts:
            if part not in recent.get(participant_id, set()):
                score += variety_weight
    return score


@dataclass
class _Variable:
    participant_id: str
    key: PromptKey
    gap: int
    domain: int


@dataclass
class _Prepared:
    variables: list[_Variable]
    reasons: list[SolvedAssignment]
    daily_counts: dict[str, int]
    slot_counts: dict[int, int]
    covered_parts: dict[str, set[int]]
    recent_parts: dict[str, frozenset[int]]
    yesterday: dict[tuple[str, PromptKey], int]


def solve_study(
    study_day: StudyDay,
    *,
    fixed_prompts: Iterable[FixedPrompt] = (),
    participant_id: str | None = None,
    other_slot_prompts: Iterable[FixedPrompt] = (),
    options: SearchOptions | None = None,
    node_limit: int | None = DEFAULT_NODE_LIMIT,
    time_limit_seconds: float | None = None,
    seed: int = 0,
) -> StudyResult:
    """Plan every remaining prompt of the study, or only one participant for a replan.

    The whole study is one CSP, exactly as scheduler.md describes: variables from every selected
    participant, one per prompt, with the study-wide slot cap as a global constraint. The node
    budget applies to the whole search. ``time_limit_seconds`` is an optional safety net, off by
    default; when it cuts the run the result says so in ``cut_reason``.
    """
    del seed  # ordering is deterministic; the argument is kept for run provenance
    options = options or SearchOptions()
    activities = tuple(sorted(study_day.activities, key=lambda activity: activity.id))
    participants = tuple(sorted(study_day.participants, key=lambda participant: participant.id))
    _validate_ids(activities, participants)
    activities_by_id = {activity.id: activity for activity in activities}
    participants_by_id = {participant.id: participant for participant in participants}

    fixed = tuple(fixed_prompts)
    other = tuple(other_slot_prompts)
    _validate_prompts(fixed, activities_by_id, participants_by_id)
    _validate_prompts(other, activities_by_id, participants_by_id)

    if participant_id is not None:
        selected = tuple(p for p in participants if p.id == participant_id)
        if not selected:
            raise ValueError(f"unknown participant {participant_id!r}")
    else:
        selected = participants
    selected_ids = {participant.id for participant in selected}
    for prompt in fixed:
        if prompt.participant_id not in selected_ids:
            raise ValueError("fixed_prompts must belong to the selected participants")
    seen: set[tuple[str, PromptKey]] = set()
    for prompt in (*fixed, *other):
        key = (prompt.participant_id, PromptKey(prompt.activity_id, prompt.occurrence))
        if key in seen:
            raise ValueError(f"duplicate prompt {key}")
        seen.add(key)

    slot_counts: dict[int, int] = {}
    for prompt in (*fixed, *other):
        slot = slot_of_prompt(prompt, study_day.study.time_zone)
        slot_counts[slot] = slot_counts.get(slot, 0) + 1

    history = study_day.history
    prepared = _prepare(
        activities,
        selected,
        study_day.plan_date,
        study_day.study,
        history,
        fixed,
        slot_counts,
        options,
    )
    deadline = None if time_limit_seconds is None else time.monotonic() + time_limit_seconds
    search = _Search(
        prepared.variables,
        daily_counts=prepared.daily_counts,
        slot_counts=prepared.slot_counts,
        covered_parts=prepared.covered_parts,
        recent_parts=prepared.recent_parts,
        yesterday=prepared.yesterday,
        max_prompts_per_day=study_day.study.max_prompts_per_day,
        max_prompts_per_slot=study_day.study.max_prompts_per_slot,
        style=study_day.study.schedule_style,
        options=options,
        node_limit=node_limit,
        deadline=deadline,
    )
    search.run()

    assignments = list(prepared.reasons)
    assignments.extend(_best_assignments(search))
    assignments.sort(key=lambda item: (item.participant_id, item.key))
    return StudyResult(
        assignments=tuple(assignments),
        local_score=search.best_score,
        finished=search.finished,
        cut_reason=search.cut_reason,
        nodes_expanded=search.nodes,
        backtracks=search.backtracks,
    )


def solve_participant(
    participant: Participant,
    activities: Sequence[Activity],
    plan_date: date,
    *,
    study: StudyConfig,
    fixed_prompts: Sequence[FixedPrompt] = (),
    slot_counts: Mapping[int, int] | None = None,
    history: History | None = None,
    seed: int = 0,
    node_limit: int | None = DEFAULT_NODE_LIMIT,
    deadline: float | None = None,
    options: SearchOptions | None = None,
) -> ParticipantResult:
    """Plan one participant, used by the mid-day replan path of scheduler.md:107-116.

    ``slot_counts`` must include the prompts of the other participants and the fixed prompts of
    this participant; when omitted, it is built from ``fixed_prompts``. ``deadline`` is an
    absolute ``time.monotonic()`` value and is an optional safety net; the default is a node
    budget.
    """
    del seed
    options = options or SearchOptions()
    activities = tuple(sorted(activities, key=lambda activity: activity.id))
    _validate_ids(activities, (participant,))
    activities_by_id = {activity.id: activity for activity in activities}
    participants_by_id = {participant.id: participant}
    fixed = tuple(fixed_prompts)
    _validate_prompts(fixed, activities_by_id, participants_by_id)
    if any(prompt.participant_id != participant.id for prompt in fixed):
        raise ValueError("fixed_prompts must belong to the participant")
    if slot_counts is None:
        slot_counts = {}
        for prompt in fixed:
            slot = slot_of_prompt(prompt, study.time_zone)
            slot_counts[slot] = slot_counts.get(slot, 0) + 1
    history = history or History()
    prepared = _prepare(
        activities,
        (participant,),
        plan_date,
        study,
        history,
        fixed,
        slot_counts,
        options,
    )
    search = _Search(
        prepared.variables,
        daily_counts=prepared.daily_counts,
        slot_counts=prepared.slot_counts,
        covered_parts=prepared.covered_parts,
        recent_parts=prepared.recent_parts,
        yesterday=prepared.yesterday,
        max_prompts_per_day=study.max_prompts_per_day,
        max_prompts_per_slot=study.max_prompts_per_slot,
        style=study.schedule_style,
        options=options,
        node_limit=node_limit,
        deadline=deadline,
    )
    search.run()
    assignments = list(prepared.reasons)
    assignments.extend(_best_assignments(search))
    assignments.sort(key=lambda item: (item.participant_id, item.key))
    return ParticipantResult(
        assignments=tuple(assignments),
        local_score=search.best_score,
        finished=search.finished,
        nodes_expanded=search.nodes,
        backtracks=search.backtracks,
        cut_reason=search.cut_reason,
    )


def slot_of_prompt(prompt: FixedPrompt, time_zone: tzinfo) -> int:
    """The slot that contains a fixed prompt, for the study-wide slot counter."""
    return minute_of_day(prompt.scheduled_at, time_zone) // SLOT_MINUTES


def _validate_ids(activities: Sequence[Activity], participants: Sequence[Participant]) -> None:
    if len({activity.id for activity in activities}) != len(activities):
        raise ValueError("duplicate activity id")
    if len({participant.id for participant in participants}) != len(participants):
        raise ValueError("duplicate participant id")


def _validate_prompts(
    prompts: Sequence[FixedPrompt],
    activities_by_id: Mapping[str, Activity],
    participants_by_id: Mapping[str, Participant],
) -> None:
    seen: set[tuple[str, PromptKey]] = set()
    for prompt in prompts:
        activity = activities_by_id.get(prompt.activity_id)
        if activity is None:
            raise ValueError(f"unknown activity {prompt.activity_id!r}")
        if prompt.participant_id not in participants_by_id:
            raise ValueError(f"unknown participant {prompt.participant_id!r}")
        if prompt.occurrence >= activity.prompts_per_day:
            raise ValueError(
                f"occurrence {prompt.occurrence} outside activity {prompt.activity_id!r}"
            )
        key = (prompt.participant_id, PromptKey(prompt.activity_id, prompt.occurrence))
        if key in seen:
            raise ValueError(f"duplicate prompt {key}")
        seen.add(key)


def _prepare(
    activities: Sequence[Activity],
    participants: Sequence[Participant],
    plan_date: date,
    study: StudyConfig,
    history: History,
    fixed_prompts: Sequence[FixedPrompt],
    slot_counts: Mapping[int, int],
    options: SearchOptions,
) -> _Prepared:
    activities_by_id = {activity.id: activity for activity in activities}
    fixed_by_participant: dict[str, list[FixedPrompt]] = {}
    for prompt in fixed_prompts:
        fixed_by_participant.setdefault(prompt.participant_id, []).append(prompt)

    yesterday: dict[tuple[str, PromptKey], int] = {}
    for item in history.yesterday:
        if item.participant_id in {participant.id for participant in participants}:
            yesterday[(item.participant_id, PromptKey(item.activity_id, item.occurrence))] = (
                minute_of_day(item.scheduled_at, study.time_zone)
            )
    recent: dict[str, frozenset[int]] = {}
    for item in history.recent_parts:
        if item.participant_id in {participant.id for participant in participants}:
            recent[item.participant_id] = frozenset(
                recent.get(item.participant_id, frozenset()) | item.parts
            )

    variables: list[_Variable] = []
    reasons: list[SolvedAssignment] = []
    daily_counts: dict[str, int] = {}
    covered_parts: dict[str, set[int]] = {}
    for participant in participants:
        own_fixed = tuple(fixed_by_participant.get(participant.id, ()))
        daily_counts[participant.id] = len(own_fixed)
        covered = {
            part
            for prompt in own_fixed
            if (part := part_of_minute(minute_of_day(prompt.scheduled_at, study.time_zone)))
            is not None
        }
        covered_parts[participant.id] = covered
        for activity in activities:
            for occurrence in range(activity.prompts_per_day):
                key = PromptKey(activity.id, occurrence)
                if any(
                    PromptKey(prompt.activity_id, prompt.occurrence) == key for prompt in own_fixed
                ):
                    continue
                slots = prompt_slot_indexes(participant, activity, plan_date)
                if not slots:
                    reasons.append(
                        SolvedAssignment(
                            participant.id, key, None, UnplannedReason.OUTSIDE_AVAILABILITY
                        )
                    )
                    continue
                domain = indexes_to_mask(slots)
                for prompt in own_fixed:
                    fixed_activity = activities_by_id[prompt.activity_id]
                    domain &= ~forbidden_mask_for_second(
                        second_of_day(prompt.scheduled_at, study.time_zone),
                        max(activity.min_gap_minutes, fixed_activity.min_gap_minutes),
                    )
                if domain == 0:
                    reasons.append(
                        SolvedAssignment(
                            participant.id, key, None, UnplannedReason.MIN_GAP_INFEASIBLE
                        )
                    )
                    continue
                variables.append(_Variable(participant.id, key, activity.min_gap_minutes, domain))

    _apply_root_global_constraints(
        variables,
        study.max_prompts_per_slot,
        study.max_prompts_per_day,
        daily_counts,
        slot_counts,
        reasons,
    )

    if options.ac3:
        _run_ac3(variables, reasons)

    return _Prepared(
        variables=[variable for variable in variables if variable.domain],
        reasons=reasons,
        daily_counts=daily_counts,
        slot_counts=dict(slot_counts),
        covered_parts=covered_parts,
        recent_parts=recent,
        yesterday=yesterday,
    )


def _apply_root_global_constraints(
    variables: list[_Variable],
    max_prompts_per_slot: int,
    max_prompts_per_day: int,
    daily_counts: dict[str, int],
    slot_counts: Mapping[int, int],
    reasons: list[SolvedAssignment],
) -> None:
    """Apply the counters of the fixed prompts before the search (root propagation)."""
    domains = [variable.domain for variable in variables]
    blocked: list[UnplannedReason | None] = [None] * len(variables)

    for slot, count in slot_counts.items():
        if count < max_prompts_per_slot:
            continue
        bit = 1 << slot
        for index, domain in enumerate(domains):
            if domain & bit:
                domains[index] ^= bit
                if domains[index] == 0 and blocked[index] is None:
                    blocked[index] = UnplannedReason.SLOT_CAP

    capped = {
        participant_id
        for participant_id, count in daily_counts.items()
        if count >= max_prompts_per_day
    }
    for index, variable in enumerate(variables):
        if variable.participant_id in capped and domains[index]:
            domains[index] = 0
            if blocked[index] is None:
                blocked[index] = UnplannedReason.DAILY_CAP

    for index, variable in enumerate(variables):
        if domains[index] == 0 and blocked[index] is not None:
            reasons.append(
                SolvedAssignment(variable.participant_id, variable.key, None, blocked[index])
            )
        else:
            variable.domain = domains[index]
    variables[:] = [variable for index, variable in enumerate(variables) if domains[index] != 0]


def _run_ac3(variables: list[_Variable], reasons: list[SolvedAssignment]) -> None:
    """AC-3 per participant over the minimum-gap constraints."""
    by_participant: dict[str, list[int]] = {}
    for index, variable in enumerate(variables):
        by_participant.setdefault(variable.participant_id, []).append(index)
    gaps = [variable.gap for variable in variables]
    domains = [variable.domain for variable in variables]
    for group in by_participant.values():
        base = {index: domains[index] for index in group}
        active = list(group)
        while active:
            emptied = ac3(domains, gaps, active)
            if not emptied:
                break
            emptied_set = set(emptied)
            for index in emptied:
                reasons.append(
                    SolvedAssignment(
                        variables[index].participant_id,
                        variables[index].key,
                        None,
                        UnplannedReason.MIN_GAP_INFEASIBLE,
                    )
                )
            active = [index for index in active if index not in emptied_set]
            for index in active:
                domains[index] = base[index]
    for index, variable in enumerate(variables):
        variable.domain = domains[index]


def _best_assignments(search: _Search) -> list[SolvedAssignment]:
    assignments: list[SolvedAssignment] = []
    for index, variable in enumerate(search.variables):
        value = search.best_assignment[index]
        if value >= 0:
            assignments.append(SolvedAssignment(variable.participant_id, variable.key, value, None))
            continue
        if search.cut_reason is not None:
            # scheduler.md:129: in a cut run the prompt may still fit in an unexplored branch.
            reason = UnplannedReason.SEARCH_CUT
        else:
            reason = search.best_blocked[index] or UnplannedReason.SLOT_CAP
        assignments.append(SolvedAssignment(variable.participant_id, variable.key, None, reason))
    return assignments


_T_DOMAIN: Final = 0
_T_ASSIGN: Final = 1
_T_SCORE: Final = 2
_T_PART: Final = 3
_T_DAILY: Final = 4
_T_SLOT: Final = 5


class _Search:
    """The study-wide search state. Every change goes through a trail."""

    def __init__(
        self,
        variables: Sequence[_Variable],
        *,
        daily_counts: Mapping[str, int],
        slot_counts: Mapping[int, int],
        covered_parts: Mapping[str, set[int]],
        recent_parts: Mapping[str, frozenset[int]],
        yesterday: Mapping[tuple[str, PromptKey], int],
        max_prompts_per_day: int,
        max_prompts_per_slot: int,
        style: ScheduleStyle,
        options: SearchOptions,
        node_limit: int | None,
        deadline: float | None,
    ) -> None:
        self.variables = tuple(variables)
        self.participants = tuple(variable.participant_id for variable in variables)
        self.keys = tuple(variable.key for variable in variables)
        self.gaps = [variable.gap for variable in variables]
        self.domains = [variable.domain for variable in variables]
        self.assignment = [UNASSIGNED] * len(variables)
        self.blocked: list[UnplannedReason | None] = [None] * len(variables)
        self.daily_counts = dict(daily_counts)
        self.slot_counts = dict(slot_counts)
        self.covered_parts = {
            participant_id: set(parts) for participant_id, parts in covered_parts.items()
        }
        self.recent_parts = dict(recent_parts)
        self.yesterday = dict(yesterday)
        self.max_daily = max_prompts_per_day
        self.max_slot = max_prompts_per_slot
        self.v_weight, self.f_weight = style_weights(style)
        self.options = options
        self.node_limit = node_limit
        self.deadline = deadline

        self.remaining = Counter(self.participants)
        self.score = 0.0
        self.planned = 0
        self.trail: list[tuple] = []

        self.best_assignment = [BOTTOM] * len(variables)
        self.best_blocked: list[UnplannedReason | None] = [None] * len(variables)
        self.best_planned = 0
        self.best_score = 0.0
        self.nodes = 0
        self.backtracks = 0
        self.finished = False
        self.cut_reason: CutReason | None = None

    def run(self) -> None:
        if not self.variables:
            self.finished = True
            return
        self._search()
        self.finished = self.cut_reason is None

    # -- trail -----------------------------------------------------------------------

    def _remove_mask(self, index: int, mask: int, cause: UnplannedReason) -> None:
        mask &= self.domains[index]
        if not mask:
            return
        old_blocked = self.blocked[index]
        self.domains[index] ^= mask
        self.trail.append((_T_DOMAIN, index, mask, old_blocked))
        if self.domains[index] == 0 and self.blocked[index] is None:
            self.blocked[index] = cause

    def _undo(self, mark: int) -> None:
        while len(self.trail) > mark:
            entry = self.trail.pop()
            tag = entry[0]
            if tag == _T_DOMAIN:
                self.domains[entry[1]] |= entry[2]
                self.blocked[entry[1]] = entry[3]
            elif tag == _T_ASSIGN:
                self.assignment[entry[1]] = UNASSIGNED
                self.remaining[self.participants[entry[1]]] += 1
            elif tag == _T_SCORE:
                self.score, self.planned = entry[1], entry[2]
            elif tag == _T_PART:
                self.covered_parts[entry[1]].discard(entry[2])
            elif tag == _T_DAILY:
                self.daily_counts[entry[1]] -= 1
            else:  # _T_SLOT
                self.slot_counts[entry[1]] = entry[2]

    # -- scoring and ordering --------------------------------------------------------

    def _prompt_gain(self, index: int, slot_index: int) -> float:
        equivalent = self.yesterday.get((self.participants[index], self.keys[index]))
        if equivalent is None:
            return 0.0
        minute = slot_index * SLOT_MINUTES
        gain = 0.0
        if abs(minute - equivalent) >= 60:
            gain += self.v_weight
        if minute // SLOT_MINUTES == equivalent // SLOT_MINUTES:
            gain += self.f_weight
        return gain

    def _soft_gain(self, index: int, slot_index: int) -> float:
        gain = self._prompt_gain(index, slot_index)
        participant = self.participants[index]
        part = part_of_slot(slot_index)
        if (
            part is not None
            and part not in self.covered_parts.get(participant, set())
            and part not in self.recent_parts.get(participant, frozenset())
        ):
            gain += self.v_weight
        return gain

    def _max_prompt_gain(self, index: int) -> float:
        equivalent = self.yesterday.get((self.participants[index], self.keys[index]))
        if equivalent is None:
            return 0.0
        domain = self.domains[index]
        best = 0.0
        if domain & distance_mask(equivalent, 60):
            best = max(best, self.v_weight)
        if domain & (1 << (equivalent // SLOT_MINUTES)):
            best = max(best, self.f_weight)
        return best

    def _select_variable(self) -> int:
        if not self.options.mrv:
            for index, value in enumerate(self.assignment):
                if value == UNASSIGNED:
                    return index
            return -1
        selected = -1
        selected_key: tuple[int, int, str, str, int] | None = None
        for index, value in enumerate(self.assignment):
            if value != UNASSIGNED:
                continue
            participant = self.participants[index]
            key = (
                self.domains[index].bit_count(),
                -self.remaining[participant],
                participant,
                self.keys[index].activity_id,
                self.keys[index].occurrence,
            )
            if selected_key is None or key < selected_key:
                selected = index
                selected_key = key
        return selected

    def _lcv(self, index: int, slot_index: int) -> int:
        participant = self.participants[index]
        removed_count = 0
        reaches_daily_cap = self.daily_counts.get(participant, 0) + 1 >= self.max_daily
        reaches_slot_cap = self.slot_counts.get(slot_index, 0) + 1 >= self.max_slot
        bit = 1 << slot_index
        for other, value in enumerate(self.assignment):
            if value != UNASSIGNED:
                continue
            domain = self.domains[other]
            if not domain:
                continue
            if self.participants[other] == participant and reaches_daily_cap:
                removed_count += domain.bit_count()
                continue
            removed = 0
            if self.participants[other] == participant:
                gap = max(self.gaps[index], self.gaps[other])
                removed |= domain & forbidden_mask_for_slot(slot_index, gap)
            if reaches_slot_cap:
                removed |= domain & bit
            removed_count += removed.bit_count()
        return removed_count

    def _ordered_values(self, index: int) -> list[int]:
        entries: list[tuple[int, int, float, int]] = []
        domain = self.domains[index]
        while domain:
            bit = domain & -domain
            slot_index = bit.bit_length() - 1
            if self.options.lcv:
                entries.append(
                    (
                        0,
                        self._lcv(index, slot_index),
                        -self._soft_gain(index, slot_index),
                        slot_index,
                    )
                )
            else:
                entries.append((0, slot_index, 0.0, slot_index))
            domain ^= bit
        entries.append((1, 0, 0.0, BOTTOM))
        entries.sort()
        return [entry[-1] for entry in entries]

    # -- bound and search ------------------------------------------------------------

    def _bound_can_beat(self) -> bool:
        planned_bound = self.planned
        score_bound = self.score
        part_candidates: set[tuple[str, int]] = set()
        for index, value in enumerate(self.assignment):
            if value != UNASSIGNED:
                continue
            participant = self.participants[index]
            domain = self.domains[index]
            if not domain or self.daily_counts.get(participant, 0) >= self.max_daily:
                continue
            planned_bound += 1
            score_bound += self._max_prompt_gain(index)
            if self.v_weight:
                for part, part_mask in enumerate(PART_MASKS):
                    if part in self.covered_parts.get(participant, set()):
                        continue
                    if part in self.recent_parts.get(participant, frozenset()):
                        continue
                    if domain & part_mask:
                        part_candidates.add((participant, part))
        if self.v_weight:
            score_bound += self.v_weight * len(part_candidates)
        if planned_bound < self.best_planned:
            return False
        if planned_bound > self.best_planned:
            return True
        return score_bound > self.best_score

    def _record(self) -> None:
        candidate = self.planned, self.score
        best = self.best_planned, self.best_score
        if candidate <= best:
            return
        self.best_planned, self.best_score = candidate
        self.best_assignment = [
            BOTTOM if value == UNASSIGNED else value for value in self.assignment
        ]
        self.best_blocked = list(self.blocked)

    def _can_assign(self, index: int, slot_index: int) -> bool:
        participant = self.participants[index]
        if self.daily_counts.get(participant, 0) >= self.max_daily:
            return False
        if self.slot_counts.get(slot_index, 0) >= self.max_slot:
            return False
        for other, value in enumerate(self.assignment):
            if value < 0 or self.participants[other] != participant:
                continue
            gap = max(self.gaps[index], self.gaps[other])
            if abs(value - slot_index) * SLOT_MINUTES < gap:
                return False
        return True

    def _assign(self, index: int, value: int) -> None:
        participant = self.participants[index]
        self.assignment[index] = value
        self.trail.append((_T_ASSIGN, index))
        self.remaining[participant] -= 1
        if value == BOTTOM:
            return

        self.trail.append((_T_SCORE, self.score, self.planned))
        self.score += self._soft_gain(index, value)
        self.planned += 1
        part = part_of_slot(value)
        if part is not None and part not in self.covered_parts.get(participant, set()):
            self.covered_parts.setdefault(participant, set()).add(part)
            self.trail.append((_T_PART, participant, part))

        previous_slot = self.slot_counts.get(value, 0)
        self.trail.append((_T_SLOT, value, previous_slot))
        self.slot_counts[value] = previous_slot + 1
        self.trail.append((_T_DAILY, participant))
        self.daily_counts[participant] = self.daily_counts.get(participant, 0) + 1

        if not self.options.forward_checking:
            return
        for other, other_value in enumerate(self.assignment):
            if other_value != UNASSIGNED or self.participants[other] != participant:
                continue
            gap = max(self.gaps[index], self.gaps[other])
            self._remove_mask(
                other,
                forbidden_mask_for_slot(value, gap),
                UnplannedReason.MIN_GAP_INFEASIBLE,
            )
        if self.slot_counts[value] >= self.max_slot:
            bit = 1 << value
            for other, other_value in enumerate(self.assignment):
                if other_value == UNASSIGNED:
                    self._remove_mask(other, bit, UnplannedReason.SLOT_CAP)
        if self.daily_counts[participant] >= self.max_daily:
            for other, other_value in enumerate(self.assignment):
                if other_value == UNASSIGNED and self.participants[other] == participant:
                    self._remove_mask(other, self.domains[other], UnplannedReason.DAILY_CAP)

    def _abort(self, reason: CutReason) -> None:
        self.cut_reason = reason
        self._record()

    def _search(self) -> None:
        if self.cut_reason is not None:
            return
        if self.deadline is not None and time.monotonic() >= self.deadline:
            self._abort(CutReason.TIME_LIMIT)
            return
        if self.node_limit is not None and self.nodes >= self.node_limit:
            self._abort(CutReason.NODE_LIMIT)
            return
        self.nodes += 1
        if self.options.branch_and_bound and not self._bound_can_beat():
            return
        index = self._select_variable()
        if index < 0:
            self._record()
            return

        mark = len(self.trail)
        for value in self._ordered_values(index):
            if value != BOTTOM and not self._can_assign(index, value):
                self.backtracks += 1
                continue
            self._assign(index, value)
            self._search()
            self._undo(mark)
            if self.cut_reason is not None:
                return
            self.backtracks += 1

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"_Search(nodes={self.nodes}, planned={self.best_planned}, score={self.best_score})"


__all__ = [
    "BOTTOM",
    "DEFAULT_NODE_LIMIT",
    "ParticipantResult",
    "SearchOptions",
    "SolvedAssignment",
    "StudyResult",
    "UNASSIGNED",
    "score_plan",
    "solve_participant",
    "solve_study",
    "style_weights",
]
