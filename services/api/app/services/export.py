"""Export of a study as a streamed zip: CSV tables, processed media files and a README.

An export with no options carries no identity, no location and no media file (FR-65). Identity
is an explicit option that only the study owner or an administrator may choose, and the router
records every export and its options in the audit log.

Media is read from object storage in chunks and written into a spooled temporary file, so a video
never sits in memory. Only processed objects are offered: the media worker replaces the original
with a copy without metadata, and a file still processing may carry GPS coordinates.
"""

import csv
import io
import mimetypes
import tempfile
import uuid
import zipfile
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import IO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    Activity,
    AuditLog,
    Entry,
    MediaObject,
    Participant,
    Prompt,
    Study,
    UserAccount,
)
from app.models.enums import EntryType, MediaStatus
from app.services import storage
from app.services.entries_read import (
    entry_conditions,
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
UNAVAILABLE_HEADERS = ["entry_id", "media_id", "tipo", "motivo"]

MEDIA_ENTRY_TYPES = (EntryType.PHOTO, EntryType.AUDIO, EntryType.VIDEO)
MEDIA_FOLDERS = {
    EntryType.PHOTO: "photo",
    EntryType.AUDIO: "audio",
    EntryType.VIDEO: "video",
}
MEDIA_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/aac": ".aac",
    "audio/amr": ".amr",
    "audio/3gpp": ".3gp",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".weba",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/3gpp": ".3gp",
}
# The spool stays in memory up to this size and then moves to disk, which keeps a run with videos
# bounded while avoiding a temporary file for the common CSV export.
SPOOL_MAX_BYTES = 8 * 1024 * 1024

REASON_PROCESSING = "em processamento"
REASON_FAILED = "falhou"
REASON_MISSING = "ficheiro em falta"

CSV_README = """entries.csv holds one row per entry. Scale answers are ordinal: scale_value is a
code for a ranked answer (the position on the scale or 0 to 100 on a slider), not a measurement.
This export computes no mean or other statistic, so the analyst chooses the analysis. The scale
columns keep the type, the number of points and the labels exactly as the participant saw them.

study_answers.csv holds one row per answer to a study question, linked to the participant alias
only."""

MEDIA_README = """media/<type>/ holds one file per processed media object, named after its entry
id. media_file in entries.csv repeats the path of each file. media/indisponiveis.csv lists the
files that are still processing, failed or missing from storage, with the reason."""

SAFE_README = """An export with no options contains no identity, no location and no media file.
Each option that was chosen is recorded in the audit log with this export."""


@dataclass(frozen=True)
class ExportFilter:
    """The filter of the entries list, applied to the export of "the current filter"."""

    participant_id: uuid.UUID | None = None
    activity_id: uuid.UUID | None = None
    entry_type: EntryType | None = None
    tag_id: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    q: str | None = None
    free_only: bool = False
    late_only: bool = False

    def conditions(self, study_id: uuid.UUID) -> list:
        return entry_conditions(
            study_id,
            participant_id=self.participant_id,
            activity_id=self.activity_id,
            entry_type=self.entry_type,
            tag_id=self.tag_id,
            date_from=self.date_from,
            date_to=self.date_to,
            q=self.q,
            free_only=self.free_only,
            late_only=self.late_only,
        )

    def audit_details(self) -> dict[str, object]:
        details: dict[str, object] = {}
        if self.participant_id is not None:
            details["participant_id"] = str(self.participant_id)
        if self.activity_id is not None:
            details["activity_id"] = str(self.activity_id)
        if self.entry_type is not None:
            details["entry_type"] = self.entry_type.value
        if self.tag_id is not None:
            details["tag_id"] = str(self.tag_id)
        if self.date_from is not None:
            details["date_from"] = self.date_from.isoformat()
        if self.date_to is not None:
            details["date_to"] = self.date_to.isoformat()
        if self.q is not None and self.q.strip():
            details["q"] = self.q.strip()
        if self.free_only:
            details["free_only"] = True
        if self.late_only:
            details["late_only"] = True
        return details


@dataclass(frozen=True)
class BuiltExport:
    file: IO[bytes]
    file_names: list[str]
    entry_count: int
    media_file_count: int
    unavailable_count: int


@dataclass(frozen=True)
class _PlannedMedia:
    media: MediaObject
    entry_id: uuid.UUID
    entry_type: EntryType
    path: str
    reason: str | None


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
    session: Session,
    conditions: list,
    *,
    include_location: bool,
    include_identity: bool,
    include_media: bool,
    media_files: dict[uuid.UUID, list[str]],
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
        .where(*conditions)
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
        if include_media:
            row.append("; ".join(media_files.get(entry.id, [])))
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


def _extension(mime_type: str) -> str:
    normalised = mime_type.split(";", 1)[0].strip().lower()
    extension = MEDIA_EXTENSIONS.get(normalised)
    if extension is None:
        extension = mimetypes.guess_extension(normalised) or ".bin"
    return extension


def _unavailable_reason(media: MediaObject) -> str | None:
    if media.status == MediaStatus.PROCESSED:
        return None
    if media.status == MediaStatus.FAILED:
        return REASON_FAILED
    return REASON_PROCESSING


def _plan_media(
    session: Session, conditions: list, media_types: Sequence[EntryType]
) -> list[_PlannedMedia]:
    rows = session.execute(
        select(MediaObject, Entry.id, Entry.entry_type)
        .join(Entry, Entry.id == MediaObject.entry_id)
        .join(Participant, Participant.id == Entry.participant_id)
        .where(Entry.entry_type.in_(media_types), *conditions)
        .order_by(Entry.received_at, Entry.id, MediaObject.created_at, MediaObject.id)
    ).all()

    occurrences: dict[uuid.UUID, int] = defaultdict(int)
    planned: list[_PlannedMedia] = []
    for media, entry_id, entry_type in rows:
        folder = MEDIA_FOLDERS[entry_type]
        extension = _extension(media.mime_type)
        reason = _unavailable_reason(media)
        if reason is None and not storage.object_exists(media.object_key):
            reason = REASON_MISSING
        if reason is not None:
            # The file is not written, so it takes no suffix from the ones that are.
            path = f"media/{folder}/{entry_id}{extension}"
        else:
            occurrences[entry_id] += 1
            index = occurrences[entry_id]
            stem = str(entry_id) if index == 1 else f"{entry_id}-{index}"
            path = f"media/{folder}/{stem}{extension}"
        planned.append(_PlannedMedia(media, entry_id, entry_type, path, reason))
    return planned


def _readme(*, include_csv: bool, include_media: bool, study_title: str) -> str:
    parts = ["Fieldnote export", ""]
    if include_csv:
        parts.extend([CSV_README, ""])
    if include_media:
        parts.extend([MEDIA_README, ""])
    parts.extend(
        [
            SAFE_README,
            "",
            f"Study: {study_title}",
            f"Generated at: {datetime.now(UTC).isoformat()}",
        ]
    )
    return "\n".join(parts) + "\n"


def _file_names(*, include_csv: bool, include_media: bool) -> list[str]:
    names: list[str] = []
    if include_csv:
        names.extend(["entries.csv", "study_answers.csv"])
    if include_media:
        names.append("media/")
    names.append("README.txt")
    return names


def _write_media(archive: zipfile.ZipFile, item: _PlannedMedia) -> None:
    body = storage.open_object(item.media.object_key)
    try:
        with archive.open(item.path, "w", force_zip64=True) as target:
            while chunk := body.read(storage.DOWNLOAD_CHUNK_BYTES):
                target.write(chunk)
    finally:
        body.close()


def build_export(
    session: Session,
    study_id: uuid.UUID,
    *,
    include_location: bool = False,
    include_identity: bool = False,
    include_media: bool = False,
    media_types: Sequence[EntryType] = (),
    include_csv: bool = True,
    export_filter: ExportFilter | None = None,
) -> BuiltExport:
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "not_found", "The study was not found.")

    conditions = (
        export_filter.conditions(study_id)
        if export_filter is not None
        else entry_conditions(study_id)
    )
    selected_media = (
        [kind for kind in MEDIA_ENTRY_TYPES if kind in media_types] if include_media else []
    )
    planned = _plan_media(session, conditions, selected_media) if include_media else []
    media_files: dict[uuid.UUID, list[str]] = defaultdict(list)
    for item in planned:
        if item.reason is None:
            media_files[item.entry_id].append(item.path)

    entry_headers = list(ENTRY_HEADERS)
    if include_media:
        entry_headers.append("media_file")
    if include_location:
        entry_headers.extend(["latitude", "longitude"])
    if include_identity:
        entry_headers.extend(["participant_name", "participant_email"])

    entry_rows = _entry_rows(
        session,
        conditions,
        include_location=include_location,
        include_identity=include_identity,
        include_media=include_media,
        media_files=media_files,
    )
    unavailable = [item for item in planned if item.reason is not None]

    # Returned to the router, which closes it after the response is streamed.
    spool = tempfile.SpooledTemporaryFile(  # noqa: SIM115
        max_size=SPOOL_MAX_BYTES, mode="w+b"
    )
    try:
        with zipfile.ZipFile(spool, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
            if include_csv:
                archive.writestr(
                    "entries.csv", _write_csv(entry_headers, entry_rows).encode("utf-8")
                )
                archive.writestr(
                    "study_answers.csv",
                    _write_csv(ANSWER_HEADERS, _answer_rows(session, study_id)).encode("utf-8"),
                )
            for item in planned:
                if item.reason is None:
                    _write_media(archive, item)
            if unavailable:
                archive.writestr(
                    "media/indisponiveis.csv",
                    _write_csv(
                        UNAVAILABLE_HEADERS,
                        [
                            [
                                str(item.entry_id),
                                str(item.media.id),
                                item.entry_type.value,
                                item.reason,
                            ]
                            for item in unavailable
                        ],
                    ).encode("utf-8"),
                )
            archive.writestr(
                "README.txt",
                _readme(
                    include_csv=include_csv,
                    include_media=include_media,
                    study_title=study.title,
                ).encode("utf-8"),
            )
    except Exception:
        spool.close()
        raise
    spool.seek(0)
    return BuiltExport(
        file=spool,
        file_names=_file_names(include_csv=include_csv, include_media=include_media),
        entry_count=len(entry_rows),
        media_file_count=len(planned) - len(unavailable),
        unavailable_count=len(unavailable),
    )


def export_history(session: Session, study_id: uuid.UUID, *, limit: int = 20) -> dict[str, object]:
    """The earlier exports of this study, newest first, as the audit log recorded them."""
    study = session.get(Study, study_id)
    if study is None:
        raise ApiError(404, "not_found", "The study was not found.")

    rows = session.execute(
        select(AuditLog, UserAccount)
        .outerjoin(UserAccount, UserAccount.id == AuditLog.actor_id)
        .where(AuditLog.action == "export", AuditLog.target == str(study_id))
        .order_by(AuditLog.at.desc(), AuditLog.id.desc())
        .limit(limit)
    ).all()

    known_media_types = {kind.value for kind in MEDIA_ENTRY_TYPES}
    items: list[dict[str, object]] = []
    for audit, account in rows:
        details = audit.details or {}
        count = details.get("entry_count")
        media_types = [
            value
            for value in details.get("media_types") or []
            if isinstance(value, str) and value in known_media_types
        ]
        scope = details.get("scope")
        filter_details = details.get("filter")
        items.append(
            {
                "id": audit.id,
                "who": (account.name or account.email) if account is not None else "",
                "when": audit.at,
                "entry_count": count if isinstance(count, int) else None,
                "scope": scope if scope in {"all", "filtered"} else "all",
                "filter": filter_details if isinstance(filter_details, dict) else None,
                "include_location": bool(details.get("include_location", False)),
                "include_identity": bool(details.get("include_identity", False)),
                "include_media": bool(details.get("include_media", False)),
                "media_types": media_types,
                "include_csv": bool(details.get("include_csv", True)),
            }
        )
    return {"items": items}
