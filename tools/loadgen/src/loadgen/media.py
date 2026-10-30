"""A tiny valid PNG generated in memory, so media uploads need no extra dependency."""

from __future__ import annotations

import binascii
import random
import struct
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(kind: bytes, payload: bytes) -> bytes:
    crc = binascii.crc32(kind + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)


def make_png(seed: int, width: int = 24, height: int = 24) -> bytes:
    """Return a deterministic 24x24 RGB PNG for ``seed``."""
    rng = random.Random(seed)
    base = (rng.randrange(256), rng.randrange(256), rng.randrange(256))
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter type: none
        for x in range(width):
            rows += bytes(
                (
                    (base[0] + x * 7) % 256,
                    (base[1] + y * 11) % 256,
                    (base[2] + (x + y) * 3) % 256,
                )
            )
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + _chunk(b"IEND", b"")
    )


__all__ = ["PNG_SIGNATURE", "make_png"]
