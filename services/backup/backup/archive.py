"""Pack the database dump and the media bucket into one encrypted tar stream."""

from __future__ import annotations

import json
import tarfile
import tempfile
from collections.abc import Callable, Iterable, Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO

from backup.crypto import ChunkEncryptor, decrypt_to_file
from backup.errors import ArchiveError

DUMP_MEMBER = "database.dump"
MEDIA_DIRECTORY = "media"
METADATA_MEMBER = "metadata.json"
CONTENT_TYPE_HEADER = "fieldnote.content_type"
DEFAULT_CONTENT_TYPE = "application/octet-stream"

ObjectStream = AbstractContextManager[tuple[BinaryIO, str]]


@dataclass(frozen=True)
class ArchiveObject:
    key: str
    size: int
    open: Callable[[], ObjectStream]


@dataclass(frozen=True)
class RestoredObject:
    key: str
    content_type: str
    path: Path


def safe_object_key(key: str) -> bool:
    if not key or key.startswith("/") or "\\" in key or "\x00" in key:
        return False
    return all(part not in {"", ".", ".."} for part in key.split("/"))


def _add_bytes(tar: tarfile.TarFile, name: str, payload: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(payload)
    info.mode = 0o600
    info.mtime = 0
    tar.addfile(info, _BytesReader(payload))


class _BytesReader:
    """A minimal read() wrapper; tarfile only needs read() for a sized member."""

    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self._offset = 0

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = len(self._payload) - self._offset
        chunk = self._payload[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk


def write_archive(
    destination: Path,
    key: bytes,
    dump_path: Path,
    objects: Iterable[ArchiveObject],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """Write the encrypted archive and return its manifest."""
    destination = Path(destination)
    entries: list[dict[str, Any]] = []

    with destination.open("wb") as sink:
        encryptor = ChunkEncryptor(sink, key)
        with tarfile.open(fileobj=encryptor, mode="w|") as tar:
            dump_info = tarfile.TarInfo(DUMP_MEMBER)
            dump_info.size = dump_path.stat().st_size
            dump_info.mode = 0o600
            dump_info.mtime = 0
            with dump_path.open("rb") as dump:
                tar.addfile(dump_info, dump)

            for item in objects:
                if not safe_object_key(item.key):
                    raise ArchiveError(f"refusing unsafe object key {item.key!r}")
                with item.open() as (stream, content_type):
                    info = tarfile.TarInfo(f"{MEDIA_DIRECTORY}/{item.key}")
                    info.size = item.size
                    info.mode = 0o600
                    info.mtime = 0
                    info.pax_headers = {CONTENT_TYPE_HEADER: content_type}
                    tar.addfile(info, stream)
                entries.append(
                    {
                        "key": item.key,
                        "size": item.size,
                        "content_type": content_type,
                    }
                )

            _add_bytes(
                tar,
                METADATA_MEMBER,
                json.dumps({"objects": entries}, sort_keys=True).encode("utf-8"),
            )

        return encryptor.finish({**metadata, "bucket_objects": len(entries)})


@contextmanager
def extracted_archive(archive_path: Path, key: bytes) -> Iterator[tuple[Path, dict[str, Any]]]:
    """Decrypt and extract an archive, yielding its contents directory and manifest."""
    with tempfile.TemporaryDirectory(prefix="fieldnote-restore-") as temporary:
        tar_path = Path(temporary) / "archive.tar"
        with Path(archive_path).open("rb") as source, tar_path.open("wb") as target:
            manifest = decrypt_to_file(source, key, target)

        contents = Path(temporary) / "contents"
        contents.mkdir()
        with tarfile.open(tar_path, mode="r:") as tar:
            tar.extractall(contents, filter="data")
        tar_path.unlink()

        if not (contents / DUMP_MEMBER).is_file():
            raise ArchiveError("the archive has no database dump")
        yield contents, manifest


def restored_objects(contents: Path) -> Iterator[RestoredObject]:
    metadata_path = contents / METADATA_MEMBER
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArchiveError("the archive has no valid object metadata") from exc

    entries = metadata.get("objects") if isinstance(metadata, dict) else None
    if not isinstance(entries, list):
        raise ArchiveError("the archive has no object list")

    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("key"), str):
            raise ArchiveError("the archive has an invalid object entry")
        object_key = entry["key"]
        if not safe_object_key(object_key):
            raise ArchiveError(f"refusing unsafe object key {object_key!r}")
        path = contents / MEDIA_DIRECTORY / object_key
        if not path.is_file():
            raise ArchiveError(f"the archive is missing object {object_key!r}")
        content_type = entry.get("content_type")
        if not isinstance(content_type, str) or not content_type:
            content_type = DEFAULT_CONTENT_TYPE
        yield RestoredObject(key=object_key, content_type=content_type, path=path)
