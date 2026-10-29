"""The backup and restore operations behind the CLI."""

from __future__ import annotations

import os
import tempfile
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import partial
from pathlib import Path
from typing import Any

from backup.archive import ArchiveObject, extracted_archive, restored_objects, write_archive
from backup.config import Settings
from backup.database import (
    dump_database,
    restore_counts,
    restore_database,
    source_counts,
)
from backup.storage import ObjectStorage


@dataclass(frozen=True)
class RunResult:
    archive: str
    manifest: dict[str, Any]
    pruned: int


@dataclass(frozen=True)
class RestoreResult:
    entries: int
    media_objects: int
    bucket_objects: int
    manifest: dict[str, Any]


def archive_key(now: datetime) -> str:
    suffix = uuid.uuid4().hex[:8]
    return f"fieldnote-{now:%Y%m%dT%H%M%SZ}-{suffix}.fnb"


def run_backup(
    settings: Settings,
    storage: ObjectStorage,
    key: bytes,
    *,
    now: datetime | None = None,
) -> RunResult:
    moment = now or datetime.now(UTC)
    counts = source_counts(settings)
    storage.ensure_backups_bucket()

    with tempfile.TemporaryDirectory(prefix="fieldnote-backup-") as temporary:
        directory = Path(temporary)
        dump_path = directory / "database.dump"
        dump_database(settings, dump_path, counts.pending_participants)

        objects = (
            ArchiveObject(
                key=item.key,
                size=item.size,
                open=partial(storage.open_media, item.key),
            )
            for item in storage.media_objects(counts.skipped_object_prefixes())
        )
        archive_path = directory / "backup.fnb"
        manifest = write_archive(
            archive_path,
            key,
            dump_path,
            objects,
            {
                "created_at": moment.isoformat(),
                "entries": counts.entries,
                "media_objects": counts.media_objects,
                "pending_participants": len(counts.pending_participants),
            },
        )

        name = archive_key(moment)
        storage.upload_archive(archive_path, name)

    cutoff = moment - timedelta(days=settings.retention_days)
    pruned = storage.prune_archives(cutoff)
    return RunResult(archive=name, manifest=manifest, pruned=pruned)


def restore_backup(
    settings: Settings,
    storage: ObjectStorage,
    key: bytes,
    archive: str,
) -> RestoreResult:
    local = Path(archive)
    temporary: str | None = None
    if not local.is_file():
        descriptor, temporary = tempfile.mkstemp(prefix="fieldnote-archive-", suffix=".fnb")
        os.close(descriptor)
        storage.download_archive(archive, Path(temporary))
        local = Path(temporary)

    try:
        with extracted_archive(local, key) as (contents, manifest):
            restore_database(settings, contents / "database.dump")
            objects = list(restored_objects(contents))
            storage.ensure_bucket(settings.s3_bucket)
            for item in objects:
                storage.upload_restored(item.path, item.key, item.content_type)
            entries, media_objects = restore_counts(settings)
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)

    return RestoreResult(
        entries=entries,
        media_objects=media_objects,
        bucket_objects=len(objects),
        manifest=manifest,
    )


def source_stats(settings: Settings, storage: ObjectStorage) -> dict[str, Any]:
    counts = source_counts(settings)
    return {
        "entries": counts.entries,
        "media_objects": counts.media_objects,
        "bucket_objects": storage.count_media(counts.skipped_object_prefixes()),
        "pending_participants": [str(item) for item in counts.pending_participants],
    }
