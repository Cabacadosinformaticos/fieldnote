"""CSV export of a study, delivered as a zip.

An export with no options carries no identity, no location and no media file (FR-65). Identity
is an explicit option that only the study owner or an administrator may choose, and the router
records every export and its options in the audit log.
"""

import csv
import io
import uuid
import zipfile
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Activity, Entry, Participant, Prompt, Study
from app.models.enums import EntryType
from app.services.entries_read import (
    RESEARCHER_VISIBLE_STATUSES,
    identity_rows,
    scale_labels,
    study_answer_rows,
)

ENTRY_HEADERS = [
    "entry_id",
    "participant_alias",
    "activity_id",
    "activity",
    "prompt_id",
    "prompt_plan_date",
    "prompt_occurrence",
    "prompt_scheduled_at",
    "entry_type",
    "content",
    "recorded_at",
    "received_at",
    "scale_type",
    "scale_points",
    "scale_label_start",
    "scale_label_middle",
    "scale_label_end",
    "scale_labels",
    "scale_value",
]

ANSWER_HEADERS = ["participant_alias", "question", "kind", "answer"]

README = """Fieldnote export

files/entries.csv holds one row per entry. Scale answers are ordinal: scale_value is a code for a
ranked answer (the position on the scale or 0 to 100 on a slider), not a measurement. This export
computes no mean or other statistic, so the analyst chooses the analysis. The scale columns keep
the type, the number of points and the labels exactly as the participant saw them.

files/study_answers.csv holds one row per answer to a study question, linked to the participant
alias only.

An export with no options contains no identity, no location and no media file. Each option that was
chosen is recorded in the audit log with this export.
"""


def _write_csv(headers: list[str], rows: list[list[object]]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue()


def _content(entry: Entry) -> str:
    if entry.entry_type == EntryType.SCALE:
        return "" if entry.value is None else str(entry.value)
    if entry.entry_type == EntryType.CHOICE:
        return entry.choice or ""
    return entry.body or ""


def _joined_labels(scale: dict[str, object] | None) -> str:
    labels = scale_labels(scale)
    ordered = [labels["start"], labels["middle"], labels["end"]]
    return " | ".join(item for item in ordered if item)


def _scale_row(entry: Entry) -> list[object]:
    scale = entry.scale_shown or {}
    labels = scale_labels(entry.scale_shown)
    return [
        scale.get("scale_type", ""),
        scale.get("points", ""),
        labels["start"],
        labels["middle"],
        labels["end"],
        _joined_labels(entry.scale_shown),
        "" if entry.value is None else entry.value,
    ]


def _entry_rows(
    session: Session, study_id: uuid.UUID, *, include_location: bool, include_identity: bool
) -> list[list[object]]:
    rows = session.execute(
        select(
            Entry,
            Participant.alias,
            Activity.title,
            Prompt.plan_date,
            Prompt.occurrence,
            Prompt.scheduled_at,
        )
        .join(Participant, Participant.id == Entry.participant_id)
        .outerjoin(Activity, Activity.id == Entry.activity_id)
        .outerjoin(Prompt, Prompt.id == Entry.prompt_id)
        .where(
            Participant.study_id == study_id,
            Participant.status.in_(RESEARCHER_VISIBLE_STATUSES),
        )
        .order_by(Entry.received_at, Entry.id)
    ).all()

    identities = {}
    if include_identity:
        identities = identity_rows(session, [row[0].participant_id for row in rows])

    result: list[list[object]] = []
    for entry, alias, activity_title, plan_date, occurrence, scheduled_at in rows:
        row: list[object] = [
            entry.id,
            alias or "",
            entry.activity_id or "",
            activity_title or "",
            entry.prompt_id or "",
            plan_date or "",
            "" if occurrence is None else occurrence,
            scheduled_at or "",
            entry.entry_type.value,
            _content(entry),
            entry.recorded_at.isoformat(),
            entry.received_at.isoformat(),
        ]
        row.extend(_scale_row(entry))
        if include_location:
            row.extend(
                [
                    "" if entry.latitude is None else entry.latitude,
                    "" if entry.longitude is None else entry.longitude,
                ]
            )
        if include_identity:
            identity = identities.get(entry.participant_id, {"name": "", "email": ""})
            row.extend([identity["name"], identity["email"]])
        result.append(row)
    return result


def _answer_rows(session: Session, study_id: uuid.UUID) -> list[list[object]]:
    return [
        [alias or "", answer.question_text, answer.kind.value, answer.answer]
        for answer, alias, _question in study_answer_rows(session, study_id)
    ]


def build_export(
    session: Session,
    study_id: uuid.UUID,
    *,
    include_location: bool = False,
    include_identity: bool = False,
) -> tuple[bytes, list[str]]:
    """Return the zip bytes and the names of the files it contains."""
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "not_found", "The study was not found.")

    entry_headers = list(ENTRY_HEADERS)
    if include_location:
        entry_headers.extend(["latitude", "longitude"])
    if include_identity:
        entry_headers.extend(["participant_name", "participant_email"])

    entries_csv = _write_csv(
        entry_headers,
        _entry_rows(
            session,
            study_id,
            include_location=include_location,
            include_identity=include_identity,
        ),
    )
    answers_csv = _write_csv(ANSWER_HEADERS, _answer_rows(session, study_id))
    generated_at = datetime.now(UTC).isoformat()
    readme = f"{README}\nStudy: {study.title}\nGenerated at: {generated_at}\n"

    files = ["entries.csv", "study_answers.csv", "README.txt"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("entries.csv", entries_csv.encode("utf-8"))
        archive.writestr("study_answers.csv", answers_csv.encode("utf-8"))
        archive.writestr("README.txt", readme.encode("utf-8"))
    return buffer.getvalue(), files
