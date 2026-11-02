import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

import pytest

from backup import job
from backup.archive import RestoredObject
from backup.config import Settings
from backup.database import SourceCounts
from backup.errors import BackupError

KEY = bytes(range(32))
FIRST = uuid.UUID(int=1)
SECOND = uuid.UUID(int=2)


class FakeStorage:
    def __init__(self, fail_key: str | None = None) -> None:
        self.prefixes: tuple[str, ...] = ()
        self.calls: list[object] = []
        self._fail_key = fail_key

    def ensure_backups_bucket(self) -> None:
        self.calls.append("ensure_backups_bucket")

    def media_objects(self, prefixes):
        self.prefixes = tuple(prefixes)
        self.calls.append("media_objects")
        return iter(())

    def upload_archive(self, path: Path, key: str) -> None:
        self.calls.append(("upload_archive", key))

    def prune_archives(self, cutoff: datetime) -> int:
        self.calls.append("prune_archives")
        return 0

    def ensure_bucket(self, bucket: str) -> None:
        self.calls.append(("ensure_bucket", bucket))

    def upload_restored(self, path: Path, key: str, content_type: str) -> None:
        self.calls.append(("upload_restored", key))
        if key == self._fail_key:
            raise BackupError("cannot restore media object")


def test_erasure_requested_during_the_dump_is_dumped_again_and_skipped(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    initial = SourceCounts(pending_participants=(FIRST,), entries=10, media_objects=3)
    refreshed = SourceCounts(pending_participants=(FIRST, SECOND), entries=7, media_objects=2)
    dumps: list[tuple[uuid.UUID, ...]] = []
    count_calls: list[tuple[uuid.UUID, ...] | None] = []

    def fake_source_counts(settings, pending=None):
        count_calls.append(pending)
        return initial if pending is None else refreshed

    def fake_dump(settings, destination, pending):
        dumps.append(tuple(pending))
        Path(destination).write_bytes(b"dump")

    def fake_write_archive(destination, key, dump_path, objects, metadata):
        assert list(objects) == []
        Path(destination).write_bytes(b"archive")
        return {**metadata, "bucket_objects": 0}

    monkeypatch.setattr(job, "source_counts", fake_source_counts)
    monkeypatch.setattr(job, "pending_participants", lambda settings: (FIRST, SECOND))
    monkeypatch.setattr(job, "dump_database", fake_dump)
    monkeypatch.setattr(job, "write_archive", fake_write_archive)

    storage = FakeStorage()
    result = job.run_backup(
        Settings(), storage, KEY, now=datetime(2026, 1, 1, tzinfo=UTC)
    )

    # The first dump missed the erasure requested while it ran, so it is written again.
    assert dumps == [(FIRST,), (FIRST, SECOND)]
    assert count_calls == [None, (FIRST, SECOND)]
    assert storage.prefixes == (f"entries/{FIRST}/", f"entries/{SECOND}/")
    assert result.manifest["pending_participants"] == 2
    assert result.manifest["entries"] == 7
    assert result.manifest["media_objects"] == 2


def _restore_fixture(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    archive = tmp_path / "backup.fnb"
    archive.write_bytes(b"archive")
    contents = tmp_path / "contents"
    contents.mkdir()
    dump = contents / "database.dump"
    dump.write_bytes(b"dump")
    restored = RestoredObject(
        key=f"entries/{FIRST}/1/photo",
        content_type="image/jpeg",
        path=contents / "media" / "photo",
    )

    @contextmanager
    def fake_extracted_archive(path, key):
        yield contents, {"objects": []}

    monkeypatch.setattr(job, "extracted_archive", fake_extracted_archive)
    monkeypatch.setattr(job, "restored_objects", lambda folder: iter([restored]))
    return archive, restored


def test_restore_uploads_objects_before_restoring_the_database(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    archive, restored = _restore_fixture(monkeypatch, tmp_path)
    calls: list[object] = []

    def fake_restore_database(settings, path):
        calls.append(("restore_database", path))

    monkeypatch.setattr(job, "restore_database", fake_restore_database)
    monkeypatch.setattr(job, "restore_counts", lambda settings: (4, 2))

    storage = FakeStorage()
    storage.calls = calls
    result = job.restore_backup(Settings(), storage, KEY, str(archive))

    assert calls == [
        ("ensure_bucket", "media"),
        ("upload_restored", restored.key),
        ("restore_database", tmp_path / "contents" / "database.dump"),
    ]
    assert result.bucket_objects == 1
    assert (result.entries, result.media_objects) == (4, 2)


def test_restore_leaves_the_database_alone_when_an_upload_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    archive, restored = _restore_fixture(monkeypatch, tmp_path)
    calls: list[object] = []
    monkeypatch.setattr(job, "restore_database", lambda settings, path: calls.append("database"))
    monkeypatch.setattr(job, "restore_counts", lambda settings: (0, 0))

    storage = FakeStorage(fail_key=restored.key)
    storage.calls = calls

    with pytest.raises(BackupError, match="cannot restore media object"):
        job.restore_backup(Settings(), storage, KEY, str(archive))

    assert "database" not in calls
