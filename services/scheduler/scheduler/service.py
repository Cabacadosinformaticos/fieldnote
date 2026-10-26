"""The running scheduler: planning, replanning, sending and expiry.

Only the replica that holds the leader lease acts. Every database call is on the critical path of
that decision: when one fails, the lease is marked lost and the cycle stops before the next send.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import socket
import time
from collections import defaultdict
from collections.abc import Callable, Sequence
from datetime import UTC, date, datetime, timedelta, tzinfo
from datetime import time as time_of_day
from uuid import UUID, uuid4

import psycopg
from psycopg import Connection

from . import db
from .domains import part_of_minute
from .lease import LeaderLease
from .model import (
    WEEKDAYS,
    Activity,
    AvailabilityInterval,
    DayPlan,
    FixedPrompt,
    HistoricalPrompt,
    History,
    Participant,
    RecentDayParts,
    ScheduleStyle,
    StudyConfig,
    StudyDay,
    TimeWindow,
)
from .plan import plan_day, replan_participant
from .push import ExpoPushClient, PushMessage
from .settings import Settings

logger = logging.getLogger(__name__)

FIXED_STATUSES = frozenset({"sent", "answered", "expired"})
PLANNED_STATUSES = frozenset({"planned", "sent", "answered", "expired"})
HISTORY_DAYS = 3


class SchedulerService:
    def __init__(
        self,
        settings: Settings,
        *,
        connection_factory: Callable[[], Connection] | None = None,
        push_client: ExpoPushClient | None = None,
        clock: Callable[[], datetime] | None = None,
        replica_id: str | None = None,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.settings = settings
        self._connection_factory = connection_factory or (lambda: db.connect(settings))
        self._connection: Connection | None = None
        self._clock = clock or (lambda: datetime.now(UTC))
        self._monotonic = monotonic
        self.replica_id = replica_id or (f"{socket.gethostname()}:{os.getpid()}:{uuid4().hex[:8]}")
        self.lease = LeaderLease(
            settings.lease_name,
            self.replica_id,
            settings.lease_ttl_seconds,
            settings.lease_renew_seconds,
            monotonic=monotonic,
        )
        self.push = push_client or ExpoPushClient(
            settings.expo_access_token,
            url=settings.expo_push_url,
            timeout_seconds=settings.expo_push_timeout_seconds,
        )
        self._fingerprints: dict[UUID, str] = {}
        self._next_replan_check = 0.0
        self._running = False

    # Lifecycle

    def run_forever(self) -> None:
        self._running = True
        logger.info("scheduler replica %s started", self.replica_id)
        while self._running:
            started = self._monotonic()
            try:
                self.run_once()
            except Exception:
                logger.exception("scheduler cycle failed")
            elapsed = self._monotonic() - started
            if self._running:
                time.sleep(max(0.0, self.settings.tick_seconds - elapsed))
        logger.info("scheduler replica %s stopped", self.replica_id)

    def stop(self) -> None:
        self._running = False

    def close(self) -> None:
        if self._connection is not None:
            self.lease.release(self._connection)
            self._close_connection()

    def run_once(self, now: datetime | None = None) -> None:
        at = now or self._clock()
        try:
            conn = self._connection_or_connect()
            if not self.lease.refresh(conn):
                return
            self.expire_prompts(conn, at)
            self.ensure_plans(conn, at)
            if self._monotonic() >= self._next_replan_check:
                self.poll_availability_changes(conn, at)
                self._next_replan_check = self._monotonic() + self.settings.replan_poll_seconds
            self.send_due_prompts(conn, at)
        except psycopg.Error:
            self.lease.mark_lost()
            logger.exception("database call failed; the cycle stopped")
            self._close_connection()

    # Planning

    def ensure_plans(self, conn: Connection, at: datetime) -> None:
        """Plan today on startup and the next day at the planning hour, each study once."""
        for study in db.load_running_studies(conn):
            local = at.astimezone(self.settings.zone(study.timezone))
            today = local.date()
            dates = [today]
            if local.hour >= self.settings.plan_hour:
                dates.append(today + timedelta(days=1))
            existing = db.load_planned_dates(conn, study.id, dates)
            for plan_date in dates:
                if plan_date in existing or not _within_study(study, plan_date):
                    continue
                try:
                    self.plan_study(conn, study.id, plan_date, at)
                except ValueError:
                    logger.exception("cannot plan study %s for %s", study.id, plan_date)
                if not self.lease.renew_now(conn):
                    return

    def plan_study(
        self, conn: Connection, study_id: UUID, plan_date: date, at: datetime
    ) -> DayPlan | None:
        study = db.load_study(conn, study_id)
        if study is None or study.status != "running":
            return None
        if not _within_study(study, plan_date):
            return None
        # The marker is taken before reading the day, so a change during the search is caught by
        # the next availability poll instead of being silently absorbed.
        before = db.load_availability_state(conn, study_id)
        study_day = self._load_study_day(conn, study, plan_date, at)
        plan = plan_day(
            study_day,
            node_limit=self.settings.plan_node_limit,
            time_limit_seconds=self.settings.plan_time_limit_seconds,
        )
        db.write_plan(conn, study_id, plan)
        self._fingerprints.update(_fingerprints(before))
        logger.info(
            "planned study %s for %s: planned=%d unplanned=%d finished=%s nodes=%d ms=%d",
            study_id,
            plan_date,
            plan.planned_count,
            plan.unplanned_count,
            plan.finished,
            plan.nodes_expanded,
            plan.solve_ms,
        )
        return plan

    # Replanning

    def poll_availability_changes(self, conn: Connection, at: datetime) -> list[tuple[UUID, UUID]]:
        """Replan the remaining prompts of participants whose availability changed."""
        if not self.lease.held:
            return []
        replanned: list[tuple[UUID, UUID]] = []
        for study in db.load_running_studies(conn):
            today = at.astimezone(self.settings.zone(study.timezone)).date()
            if not _within_study(study, today):
                continue
            states = db.load_availability_state(conn, study.id)
            current = _fingerprints(states)
            for participant_id, fingerprint in current.items():
                previous = self._fingerprints.get(participant_id)
                self._fingerprints[participant_id] = fingerprint
                if previous is None or previous == fingerprint:
                    continue
                if not db.has_plan(conn, study.id, today):
                    continue
                logger.info(
                    "availability changed for participant %s, replanning %s",
                    participant_id,
                    today,
                )
                self.replan_study_participant(conn, study.id, participant_id, today, at)
                replanned.append((study.id, participant_id))
                if not self.lease.renew_now(conn):
                    return replanned
        return replanned

    def replan_study_participant(
        self,
        conn: Connection,
        study_id: UUID,
        participant_id: UUID,
        plan_date: date,
        at: datetime,
    ) -> DayPlan | None:
        study = db.load_study(conn, study_id)
        if study is None or study.status != "running":
            return None
        study_day = self._load_study_day(conn, study, plan_date, at)
        participant_ids = [UUID(participant.id) for participant in study_day.participants]
        if participant_id not in participant_ids:
            return None
        activity_ids = {activity.id for activity in study_day.activities}
        prompts = db.load_prompts_on(conn, participant_ids, plan_date)
        time_zone = self.settings.zone(study.timezone)

        sent: list[FixedPrompt] = []
        other: list[FixedPrompt] = []
        for prompt in prompts:
            if prompt.scheduled_at is None or prompt.status not in PLANNED_STATUSES:
                continue
            if str(prompt.activity_id) not in activity_ids:
                continue
            fixed = FixedPrompt(
                participant_id=str(prompt.participant_id),
                activity_id=str(prompt.activity_id),
                occurrence=prompt.occurrence,
                scheduled_at=prompt.scheduled_at.astimezone(time_zone),
            )
            if prompt.participant_id == participant_id:
                if prompt.status in FIXED_STATUSES:
                    sent.append(fixed)
            else:
                other.append(fixed)

        plan = replan_participant(
            study_day,
            str(participant_id),
            sent_prompts=sent,
            other_planned_prompts=other,
            node_limit=self.settings.plan_node_limit,
            time_limit_seconds=self.settings.plan_time_limit_seconds,
        )
        skipped = {
            (prompt.participant_id, prompt.activity_id, prompt.occurrence) for prompt in sent
        }
        db.write_plan(conn, study_id, plan, skip_keys=skipped)
        logger.info(
            "replanned participant %s of study %s for %s: planned=%d unplanned=%d",
            participant_id,
            study_id,
            plan_date,
            plan.planned_count - len(sent),
            plan.unplanned_count,
        )
        return plan

    # Sending and expiry

    def expire_prompts(self, conn: Connection, at: datetime) -> int:
        expired = db.expire_prompts(conn, at)
        if expired:
            logger.info("expired %d prompts", expired)
        return expired

    def send_due_prompts(self, conn: Connection, at: datetime) -> int:
        delivered = 0
        while self.lease.held:
            due = db.load_due_prompts(conn, at, self.settings.send_batch_size)
            if not due:
                break
            messages: list[PushMessage] = []
            for prompt in due:
                if not db.mark_sent_if_leader(conn, prompt.id, self.lease.name, self.lease.holder):
                    if not db.lease_is_held(conn, self.lease.name, self.lease.holder):
                        self.lease.mark_lost()
                        logger.warning("lease lost while claiming a prompt, stopping sends")
                        return delivered
                    continue
                messages.append(
                    PushMessage(
                        prompt_id=prompt.id,
                        push_token=prompt.push_token,
                        locale=prompt.locale,
                    )
                )
            if messages:
                results = self.push.send(messages)
                delivered += sum(1 for result in results if result.delivered)
            if not self.lease.renew_now(conn):
                return delivered
            if len(due) < self.settings.send_batch_size:
                break
        if delivered:
            logger.info("sent %d prompt notifications", delivered)
        return delivered

    # Building the planner input

    def _load_study_day(
        self, conn: Connection, study: db.StudyRow, plan_date: date, at: datetime
    ) -> StudyDay:
        time_zone = self.settings.zone(study.timezone)
        activities = tuple(
            Activity(
                id=str(row.id),
                prompts_per_day=row.prompts_per_day,
                min_gap_minutes=row.min_gap_minutes,
                window=TimeWindow(start=row.window_start, end=row.window_end),
            )
            for row in db.load_activities(conn, study.id)
        )
        participant_rows = db.load_active_participants(conn, study.id)
        intervals: dict[UUID, list[AvailabilityInterval]] = defaultdict(list)
        for row in db.load_availability(conn, [participant.id for participant in participant_rows]):
            intervals[row.participant_id].append(
                AvailabilityInterval(
                    start=row.start_time,
                    end=row.end_time,
                    weekdays=frozenset(row.weekdays),
                )
            )
        participants = tuple(
            Participant(
                id=str(row.id),
                availability=tuple(intervals[row.id]),
                any_time=row.availability_any_time,
            )
            for row in participant_rows
        )
        if plan_date == at.astimezone(time_zone).date():
            cutoff = _cutoff_time(at.astimezone(time_zone))
            participants = tuple(
                _clip_to_cutoff(participant, activities, cutoff) for participant in participants
            )
        history = self._load_history(
            conn,
            [participant.id for participant in participant_rows],
            plan_date,
            time_zone,
        )
        return StudyDay(
            study=StudyConfig(
                id=str(study.id),
                schedule_style=ScheduleStyle(study.schedule_style),
                max_prompts_per_day=study.max_prompts_per_day,
                max_prompts_per_slot=study.max_prompts_per_slot,
                time_zone=time_zone,
            ),
            plan_date=plan_date,
            activities=activities,
            participants=participants,
            history=history,
        )

    def _load_history(
        self,
        conn: Connection,
        participant_ids: Sequence[UUID],
        plan_date: date,
        time_zone: tzinfo,
    ) -> History:
        rows = db.load_history(
            conn,
            participant_ids,
            plan_date - timedelta(days=HISTORY_DAYS),
            plan_date - timedelta(days=1),
        )
        yesterday = [
            HistoricalPrompt(
                participant_id=str(row.participant_id),
                activity_id=str(row.activity_id),
                occurrence=row.occurrence,
                scheduled_at=row.scheduled_at.astimezone(time_zone),
            )
            for row in rows
            if row.plan_date == plan_date - timedelta(days=1)
        ]
        parts: dict[str, set[int]] = defaultdict(set)
        for row in rows:
            local = row.scheduled_at.astimezone(time_zone)
            part = part_of_minute(local.hour * 60 + local.minute)
            if part is not None:
                parts[str(row.participant_id)].add(part)
        return History(
            yesterday=tuple(yesterday),
            recent_parts=tuple(
                RecentDayParts(participant_id, frozenset(day_parts))
                for participant_id, day_parts in sorted(parts.items())
            ),
        )

    # Connection handling

    def _connection_or_connect(self) -> Connection:
        if self._connection is None:
            self._connection = self._connection_factory()
        return self._connection

    def _close_connection(self) -> None:
        if self._connection is not None:
            try:
                self._connection.close()
            except psycopg.Error:
                logger.debug("connection close failed", exc_info=True)
            self._connection = None


def _within_study(study: db.StudyRow, plan_date: date) -> bool:
    if study.starts_on is not None and plan_date < study.starts_on:
        return False
    return not (study.ends_on is not None and plan_date > study.ends_on)


def _cutoff_time(local_now: datetime) -> time_of_day:
    """The first 15-minute slot that has not started yet, in the study's local time."""
    seconds = local_now.hour * 3600 + local_now.minute * 60 + local_now.second
    slot = ((seconds + 899) // 900) * 900
    if slot >= 24 * 3600:
        return time_of_day(23, 59, 59)
    return time_of_day(slot // 3600, (slot % 3600) // 60)


def _clip_to_cutoff(
    participant: Participant, activities: Sequence[Activity], cutoff: time_of_day
) -> Participant:
    """Drop the slots already past from a plan made or remade during the day.

    The pure planner plans a whole day. Narrowing the availability is the adapter that keeps a
    startup or replan from placing prompts in the past, without changing the solver.
    """
    if cutoff == time_of_day(0, 0):
        return participant
    if participant.any_time:
        windows = [
            AvailabilityInterval(
                start=max(activity.window.start, cutoff),
                end=activity.window.end,
                weekdays=WEEKDAYS,
            )
            for activity in activities
            if max(activity.window.start, cutoff) < activity.window.end
        ]
        return Participant(id=participant.id, availability=tuple(windows), any_time=False)
    clipped = [
        AvailabilityInterval(
            start=max(interval.start, cutoff),
            end=interval.end,
            weekdays=interval.weekdays,
        )
        for interval in participant.availability
        if max(interval.start, cutoff) < interval.end
    ]
    return Participant(id=participant.id, availability=tuple(clipped), any_time=False)


def _fingerprints(states: Sequence[db.AvailabilityStateRow]) -> dict[UUID, str]:
    """A content marker for the availability of each participant.

    The schema has no ``updated_at`` and ``availability.id`` is a random UUID, so max(id) cannot
    detect an edit. Hashing the rows detects inserts, removals and changes, including a change of
    the "any time" flag.
    """
    intervals: dict[UUID, list[tuple[str, str, tuple[int, ...]]]] = defaultdict(list)
    any_time: dict[UUID, bool] = {}
    for state in states:
        any_time[state.participant_id] = state.any_time
        if state.start_time is not None:
            intervals[state.participant_id].append(
                (
                    state.start_time.isoformat(),
                    (state.end_time or state.start_time).isoformat(),
                    tuple(sorted(state.weekdays or ())),
                )
            )
    result: dict[UUID, str] = {}
    for participant_id, flag in any_time.items():
        payload = json.dumps(
            {"any_time": flag, "intervals": sorted(intervals[participant_id])},
            sort_keys=True,
        )
        result[participant_id] = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return result


__all__ = ["SchedulerService"]
