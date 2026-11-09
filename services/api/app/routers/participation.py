"""The participant side of joining a study and of a participation.

A code is checked without being consumed; the device token is issued only on acceptance and is
returned once. Every route after that uses ``Authorization: Device <token>``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Participant, Study
from app.models.enums import ParticipantStatus
from app.routers.account import AccountAuth, _resolve_account
from app.schemas.participation import (
    ApprovalStatusOut,
    AvailabilityIntervalOut,
    AvailabilityOut,
    AvailabilityUpdate,
    ErasureRequest,
    ExistingParticipationOut,
    FreeEntryActivityOut,
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    InvitationLookupRequest,
    InvitationLookupResponse,
    OpenPromptOut,
    OpenPromptsOut,
    ParticipantMeOut,
    PromptEventIn,
    PushTokenUpdate,
    StudyCardOut,
    StudyQuestionOut,
    StudySummaryOut,
)
from app.security.deps import current_participant
from app.services import participation as service

router = APIRouter(prefix="/participation", tags=["participation"])

SessionDep = Annotated[Session, Depends(get_session)]
ParticipantDep = Annotated[Participant, Depends(current_participant)]


def _device_token(request: Request) -> str | None:
    scheme, _, raw = request.headers.get("Authorization", "").partition(" ")
    token = raw.strip()
    return token if scheme.lower() == "device" and token else None


def _optional_account(
    request: Request,
    session: SessionDep,
) -> AccountAuth | None:
    """Resolve an ``Authorization: Account`` header; a device token is not an account."""
    authorization = request.headers.get("Authorization")
    scheme, _, _ = (authorization or "").partition(" ")
    if scheme.lower() != "account":
        return None
    return _resolve_account(session, authorization)


OptionalAccount = Annotated[AccountAuth | None, Depends(_optional_account)]


def _study_summary(session: Session, study: Study) -> StudySummaryOut:
    card = service.study_card(session, study)
    return StudySummaryOut(
        id=study.id,
        title=study.title,
        description=study.description,
        consent_text=study.consent_text,
        status=study.status,
        starts_on=study.starts_on,
        ends_on=study.ends_on,
        timezone=study.timezone,
        team=list(card["team"]),
        max_prompts_per_day=int(card["requests_per_day"]),
        today_free_entry_display=study.today_free_entry_display,
    )


def _participant_out(session: Session, participant: Participant) -> ParticipantMeOut:
    study = service.get_study(session, participant)
    return ParticipantMeOut(
        id=participant.id,
        study=_study_summary(session, study),
        status=participant.status,
        alias=participant.alias,
        locale=participant.locale,
        entered_at=participant.entered_at,
        availability_any_time=bool(participant.availability_any_time),
        has_consent=service.has_consent(session, participant),
        push_token_registered=participant.push_token is not None,
        erasure_requested_at=participant.erasure_requested_at,
        erasure_due_at=participant.erasure_due_at,
        status_before_erasure=participant.status_before_erasure,
    )


def _existing_out(participant: Participant) -> ExistingParticipationOut:
    return ExistingParticipationOut(
        status=participant.status,
        alias=participant.alias,
        can_return=participant.status == ParticipantStatus.WITHDRAWN,
        can_erase=participant.status != ParticipantStatus.ERASURE_SCHEDULED,
        can_cancel_erasure=participant.status == ParticipantStatus.ERASURE_SCHEDULED,
        decided_at=participant.decided_at,
        erasure_due_at=participant.erasure_due_at,
    )


@router.post("/invitations/lookup", response_model=InvitationLookupResponse)
def lookup_invitation(
    payload: InvitationLookupRequest,
    session: SessionDep,
) -> InvitationLookupResponse:
    result = service.lookup_invitation(session, payload.code, payload.android_id)
    card = service.study_card(session, result.study)
    return InvitationLookupResponse(
        code_kind=result.code_kind,
        study=StudyCardOut(**card),
        requires_approval=result.requires_approval,
        requires_account=result.requires_account,
        consent_version=service.CONSENT_VERSION,
        questions=[
            StudyQuestionOut(
                id=question.id,
                position=question.position,
                kind=question.kind,
                text=question.text,
                options=list(question.options),
            )
            for question in result.questions
        ],
        existing_participation=(
            _existing_out(result.existing) if result.existing is not None else None
        ),
    )


@router.post("/invitations/accept", response_model=InvitationAcceptResponse)
def accept_invitation(
    payload: InvitationAcceptRequest,
    request: Request,
    session: SessionDep,
    auth: OptionalAccount,
) -> InvitationAcceptResponse:
    result = service.accept_invitation(
        session,
        raw_code=payload.code,
        android_id=payload.android_id,
        locale=payload.locale,
        consent_version=payload.consent_version,
        answers=[(answer.question_id, answer.answer) for answer in payload.answers],
        presented_token=_device_token(request),
        account=auth.account if auth is not None else None,
    )
    return InvitationAcceptResponse(
        outcome=result.outcome,
        device_token=result.device_token,
        participant=_participant_out(session, result.participant),
    )


@router.get("/me", response_model=ParticipantMeOut)
def get_my_participation(
    participant: ParticipantDep,
    session: SessionDep,
) -> ParticipantMeOut:
    return _participant_out(session, participant)


@router.get("/me/approval", response_model=ApprovalStatusOut)
def approval_status(participant: ParticipantDep) -> ApprovalStatusOut:
    return ApprovalStatusOut(
        status=participant.status,
        alias=participant.alias,
        decided_at=participant.decided_at,
    )


@router.put("/me/availability", response_model=AvailabilityOut)
def set_availability(
    payload: AvailabilityUpdate,
    participant: ParticipantDep,
    session: SessionDep,
) -> AvailabilityOut:
    service.set_availability(
        session,
        participant,
        payload.any_time,
        [
            (interval.start_time, interval.end_time, list(interval.weekdays))
            for interval in payload.intervals
        ],
    )
    return _availability_out(session, participant)


@router.get("/me/availability", response_model=AvailabilityOut)
def get_availability(
    participant: ParticipantDep,
    session: SessionDep,
) -> AvailabilityOut:
    return _availability_out(session, participant)


def _availability_out(session: Session, participant: Participant) -> AvailabilityOut:
    rows = service.list_availability(session, participant)
    return AvailabilityOut(
        any_time=participant.availability_any_time,
        intervals=[
            AvailabilityIntervalOut(
                start_time=row.start_time,
                end_time=row.end_time,
                weekdays=list(row.weekdays),
            )
            for row in rows
        ],
    )


@router.put("/me/push-token", status_code=204)
def register_push_token(
    payload: PushTokenUpdate,
    participant: ParticipantDep,
    session: SessionDep,
) -> None:
    service.register_push_token(session, participant, payload.push_token)


@router.get("/me/prompts", response_model=OpenPromptsOut)
def list_open_prompts(
    participant: ParticipantDep,
    session: SessionDep,
) -> OpenPromptsOut:
    today, prompts = service.open_prompts(session, participant)
    return OpenPromptsOut(
        date=today,
        prompts=[
            OpenPromptOut(
                id=item.prompt.id,
                activity_id=item.activity.id,
                title=item.activity.title,
                instructions=item.activity.instructions,
                entry_types=list(item.activity.entry_types),
                options=item.activity.options,
                expected_minutes=item.activity.expected_minutes,
                capture_location=item.activity.capture_location,
                status=item.prompt.status,
                scheduled_at=item.prompt.scheduled_at,
                sent_at=item.prompt.sent_at,
                closes_at=item.closes_at,
            )
            for item in prompts
        ],
    )


@router.post("/me/prompts/{prompt_id}/events", status_code=204)
def report_prompt_events(
    prompt_id: uuid.UUID,
    payload: PromptEventIn,
    participant: ParticipantDep,
    session: SessionDep,
) -> None:
    service.report_prompt_events(
        session,
        participant,
        prompt_id,
        shown_at=payload.shown_at,
        opened_at=payload.opened_at,
    )


@router.get("/me/activities", response_model=list[FreeEntryActivityOut])
def list_free_entry_activities(
    participant: ParticipantDep,
    session: SessionDep,
) -> list[FreeEntryActivityOut]:
    return [
        FreeEntryActivityOut(
            id=item.activity.id,
            title=item.activity.title,
            instructions=item.activity.instructions,
            entry_types=list(item.activity.entry_types),
            options=item.activity.options,
            capture_location=item.activity.capture_location,
            allow_free_entries=item.activity.allow_free_entries,
            max_free_entries_per_day=item.activity.max_free_entries_per_day,
            free_entries_used_today=item.used_today,
        )
        for item in service.free_entry_activities(session, participant)
    ]


@router.post("/me/leave", response_model=ParticipantMeOut)
def leave_study(
    participant: ParticipantDep,
    session: SessionDep,
) -> ParticipantMeOut:
    service.leave_study(session, participant)
    return _participant_out(session, participant)


@router.post("/me/return", response_model=ParticipantMeOut)
def return_to_study(
    participant: ParticipantDep,
    session: SessionDep,
) -> ParticipantMeOut:
    service.return_to_study(session, participant)
    return _participant_out(session, participant)


@router.post("/me/erasure", response_model=ParticipantMeOut)
def request_erasure(
    payload: ErasureRequest,
    participant: ParticipantDep,
    session: SessionDep,
) -> ParticipantMeOut:
    service.request_erasure(session, participant, payload.confirmation)
    return _participant_out(session, participant)


@router.post("/me/erasure/cancel", response_model=ParticipantMeOut)
def cancel_erasure(
    participant: ParticipantDep,
    session: SessionDep,
) -> ParticipantMeOut:
    service.cancel_erasure(session, participant)
    return _participant_out(session, participant)
