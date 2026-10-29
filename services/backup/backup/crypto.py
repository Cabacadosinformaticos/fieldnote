"""Chunked AES-256-GCM archive encryption.

The file is the magic header followed by records of ``uint32 plaintext length``, a random
12-byte nonce and the AES-GCM ciphertext (plaintext plus 16-byte tag). Chunk index and length
are authenticated as associated data, so a chunk cannot be moved or re-labelled. The last
record is the encrypted manifest with the chunk count and a SHA-256 of the plaintext stream,
which catches truncation.

Every primitive comes from ``cryptography``; this module only frames the chunks.
"""

from __future__ import annotations

import hashlib
import io
import json
import secrets
import struct
from collections.abc import Iterator
from typing import Any, BinaryIO

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backup.errors import ArchiveError

MAGIC = b"FNBACKUP1\n"
NONCE_BYTES = 12
TAG_BYTES = 16
LENGTH_BYTES = 4
DEFAULT_CHUNK_BYTES = 1024 * 1024
MAX_CHUNK_BYTES = 8 * 1024 * 1024


def _associated_data(index: int, length: int) -> bytes:
    return MAGIC + struct.pack(">QI", index, length)


class ChunkEncryptor:
    """A write-only stream that encrypts what it receives, chunk by chunk."""

    def __init__(
        self,
        sink: BinaryIO,
        key: bytes,
        *,
        chunk_size: int = DEFAULT_CHUNK_BYTES,
    ) -> None:
        if len(key) != 32:
            raise ValueError("the AES-256-GCM key must be 32 bytes")
        if chunk_size <= 0 or chunk_size > MAX_CHUNK_BYTES:
            raise ValueError(f"chunk_size must be between 1 and {MAX_CHUNK_BYTES}")
        self._sink = sink
        self._cipher = AESGCM(key)
        self._chunk_size = chunk_size
        self._buffer = bytearray()
        self._index = 0
        self._count = 0
        self._bytes = 0
        self._digest = hashlib.sha256()
        self._sink.write(MAGIC)

    def write(self, data: bytes) -> int:
        self._buffer.extend(data)
        while len(self._buffer) >= self._chunk_size:
            chunk = bytes(self._buffer[: self._chunk_size])
            del self._buffer[: self._chunk_size]
            self._emit(chunk)
        return len(data)

    def finish(self, metadata: dict[str, Any]) -> dict[str, Any]:
        if self._buffer:
            self._emit(bytes(self._buffer))
            self._buffer.clear()
        manifest = {
            "version": 1,
            "chunks": self._count,
            "bytes": self._bytes,
            "sha256": self._digest.hexdigest(),
            **metadata,
        }
        self._emit(json.dumps(manifest, sort_keys=True).encode("utf-8"), data=False)
        return manifest

    def _emit(self, plaintext: bytes, *, data: bool = True) -> None:
        nonce = secrets.token_bytes(NONCE_BYTES)
        ciphertext = self._cipher.encrypt(
            nonce,
            plaintext,
            _associated_data(self._index, len(plaintext)),
        )
        self._sink.write(struct.pack(">I", len(plaintext)))
        self._sink.write(nonce)
        self._sink.write(ciphertext)
        if data:
            self._digest.update(plaintext)
            self._bytes += len(plaintext)
            self._count += 1
        self._index += 1


def _read_exact(source: BinaryIO, length: int) -> bytes:
    data = source.read(length)
    if len(data) != length:
        raise ArchiveError("the archive is truncated")
    return data


def _iter_chunks(source: BinaryIO, key: bytes) -> Iterator[bytes]:
    if len(key) != 32:
        raise ValueError("the AES-256-GCM key must be 32 bytes")
    if _read_exact(source, len(MAGIC)) != MAGIC:
        raise ArchiveError("not a Fieldnote backup archive")
    cipher = AESGCM(key)
    index = 0
    while True:
        header = source.read(LENGTH_BYTES)
        if not header:
            return
        if len(header) != LENGTH_BYTES:
            raise ArchiveError("the archive is truncated")
        (length,) = struct.unpack(">I", header)
        if length > MAX_CHUNK_BYTES:
            raise ArchiveError("the archive declares an oversized chunk")
        nonce = _read_exact(source, NONCE_BYTES)
        payload = _read_exact(source, length + TAG_BYTES)
        try:
            plaintext = cipher.decrypt(nonce, payload, _associated_data(index, length))
        except InvalidTag as exc:
            raise ArchiveError(
                "the archive failed authentication: wrong key or tampered bytes"
            ) from exc
        yield plaintext
        index += 1


def decrypt_to_file(source: BinaryIO, key: bytes, destination: BinaryIO) -> dict[str, Any]:
    """Decrypt an archive stream into ``destination`` and return the checked manifest."""
    chunks = _iter_chunks(source, key)
    pending: bytes | None = None
    count = 0
    size = 0
    digest = hashlib.sha256()
    for chunk in chunks:
        if pending is not None:
            destination.write(pending)
            digest.update(pending)
            count += 1
            size += len(pending)
        pending = chunk

    if pending is None:
        raise ArchiveError("the archive has no manifest")

    try:
        manifest = json.loads(pending)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ArchiveError("the archive has no valid manifest") from exc
    if not isinstance(manifest, dict):
        raise ArchiveError("the archive manifest is not an object")
    if manifest.get("chunks") != count:
        raise ArchiveError("the archive is truncated or has extra chunks")
    if manifest.get("bytes") != size:
        raise ArchiveError("the archive manifest does not match its size")
    if manifest.get("sha256") != digest.hexdigest():
        raise ArchiveError("the archive manifest does not match its contents")
    return manifest


def decrypt_to_bytes(archive: bytes, key: bytes) -> tuple[bytes, dict[str, Any]]:
    destination = io.BytesIO()
    manifest = decrypt_to_file(io.BytesIO(archive), key, destination)
    return destination.getvalue(), manifest
