import io
from contextlib import contextmanager
from pathlib import Path

import pytest

from backup.archive import (
    ArchiveObject,
    extracted_archive,
    restored_objects,
    safe_object_key,
    write_archive,
)
from backup.errors import ArchiveError

KEY = bytes(range(32))


@contextmanager
def stream(payload: bytes, content_type: str):
    yield io.BytesIO(payload), content_type


def object_for(key: str, payload: bytes, content_type: str = "image/jpeg") -> ArchiveObject:
    return ArchiveObject(
        key=key,
        size=len(payload),
        open=lambda: stream(payload, content_type),
    )


def test_archive_round_trip(tmp_path: Path):
    dump = tmp_path / "database.dump"
    dump.write_bytes(b"custom-format-dump")
    first = "entries/11111111-1111-1111-1111-111111111111/2222/3333"
    second = "entries/11111111-1111-1111-1111-111111111111/2222/4444.thumb.jpg"
    archive = tmp_path / "backup.fnb"

    manifest = write_archive(
        archive,
        KEY,
        dump,
        [object_for(first, b"photo"), object_for(second, b"thumb", "image/jpeg")],
        {"entries": 4, "media_objects": 2, "pending_participants": 0},
    )

    with extracted_archive(archive, KEY) as (contents, read_manifest):
        assert read_manifest == manifest
        assert (contents / "database.dump").read_bytes() == b"custom-format-dump"
        objects = list(restored_objects(contents))
        assert [item.key for item in objects] == [first, second]
        assert [item.content_type for item in objects] == ["image/jpeg", "image/jpeg"]
        assert objects[0].path.read_bytes() == b"photo"

    assert manifest["bucket_objects"] == 2
    assert manifest["entries"] == 4


def test_unsafe_object_key_is_refused(tmp_path: Path):
    dump = tmp_path / "database.dump"
    dump.write_bytes(b"dump")
    archive = tmp_path / "backup.fnb"

    with pytest.raises(ArchiveError, match="unsafe object key"):
        write_archive(archive, KEY, dump, [object_for("../escape", b"x")], {})


def test_safe_object_key():
    assert safe_object_key("entries/id/entry/media")
    assert not safe_object_key("/absolute")
    assert not safe_object_key("entries/../escape")
    assert not safe_object_key("entries\\windows")
    assert not safe_object_key("")
