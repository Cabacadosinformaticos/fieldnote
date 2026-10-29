import io
import math

import pytest

from backup.crypto import MAGIC, ChunkEncryptor, decrypt_to_bytes
from backup.errors import ArchiveError

KEY = bytes(range(32))


def encrypt(plaintext: bytes, *, key: bytes = KEY, chunk_size: int = 7) -> tuple[bytes, dict]:
    sink = io.BytesIO()
    encryptor = ChunkEncryptor(sink, key, chunk_size=chunk_size)
    encryptor.write(plaintext)
    manifest = encryptor.finish({"kind": "test"})
    return sink.getvalue(), manifest


def test_round_trip_keeps_bytes_and_manifest():
    plaintext = bytes(range(256)) * 3

    archive, written = encrypt(plaintext)
    restored, manifest = decrypt_to_bytes(archive, KEY)

    assert restored == plaintext
    assert manifest == written
    assert manifest["chunks"] == math.ceil(len(plaintext) / 7)
    assert manifest["bytes"] == len(plaintext)
    assert manifest["kind"] == "test"


def test_tampered_chunk_is_rejected():
    archive, _ = encrypt(b"a chunk that must not change")
    first_ciphertext = len(MAGIC) + 4 + 12
    tampered = bytearray(archive)
    tampered[first_ciphertext] ^= 0xFF

    with pytest.raises(ArchiveError, match="authentication"):
        decrypt_to_bytes(bytes(tampered), KEY)


def test_wrong_key_is_rejected():
    archive, _ = encrypt(b"only the right key can read this")

    with pytest.raises(ArchiveError, match="authentication"):
        decrypt_to_bytes(archive, bytes(reversed(KEY)))


def test_truncated_archive_is_rejected():
    archive, _ = encrypt(b"the tail is the authenticated manifest")

    with pytest.raises(ArchiveError, match="truncated"):
        decrypt_to_bytes(archive[:-5], KEY)


def test_wrong_magic_is_rejected():
    archive, _ = encrypt(b"payload")

    with pytest.raises(ArchiveError, match="not a Fieldnote backup"):
        decrypt_to_bytes(b"NOTBACKUP\n" + archive[len(MAGIC) :], KEY)


def test_key_must_be_32_bytes():
    with pytest.raises(ValueError, match="32 bytes"):
        ChunkEncryptor(io.BytesIO(), b"short")
