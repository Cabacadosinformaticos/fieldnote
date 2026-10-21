"""Sample generation and ffprobe helpers shared by the tests."""

from __future__ import annotations

import json
import struct
import subprocess
from pathlib import Path
from typing import Any

FFMPEG_TIMEOUT_SECONDS = 120


def run_ffmpeg(*arguments: str) -> None:
    subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *arguments],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=FFMPEG_TIMEOUT_SECONDS,
    )


def probe(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    return json.loads(result.stdout)


def first_stream(payload: dict[str, Any], codec_type: str) -> dict[str, Any]:
    return next(stream for stream in payload["streams"] if stream["codec_type"] == codec_type)


def metadata_tags(path: Path) -> dict[str, str]:
    payload = probe(path)
    tags = dict(payload.get("format", {}).get("tags") or {})
    for stream in payload.get("streams", []):
        tags.update(stream.get("tags") or {})
    return tags


def make_jpeg_with_gps(path: Path) -> None:
    run_ffmpeg(
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=640x480:d=1",
        "-frames:v",
        "1",
        "-c:v",
        "mjpeg",
        "-q:v",
        "3",
        str(path),
    )
    path.write_bytes(_insert_exif(path.read_bytes(), _gps_exif()))


def make_video(
    path: Path,
    *,
    width: int,
    height: int,
    duration: float,
    with_audio: bool = True,
    with_metadata: bool = True,
) -> None:
    arguments = [
        "-f",
        "lavfi",
        "-i",
        f"testsrc=size={width}x{height}:rate=25:duration={duration}",
    ]
    if with_audio:
        arguments += [
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:sample_rate=44100:duration={duration}",
        ]
    arguments += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
    if with_audio:
        arguments += ["-c:a", "aac", "-shortest"]
    if with_metadata:
        arguments += [
            "-metadata",
            "location=+40.0000-8.0000/",
            "-metadata",
            "title=secret-title",
        ]
    arguments.append(str(path))
    run_ffmpeg(*arguments)


def make_audio(path: Path, *, duration: float = 2) -> None:
    run_ffmpeg(
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=440:sample_rate=44100:duration={duration}",
        "-c:a",
        "aac",
        "-metadata",
        "location=+40.0000-8.0000/",
        "-metadata",
        "title=secret-title",
        str(path),
    )


def _insert_exif(jpeg: bytes, exif_segment: bytes) -> bytes:
    if not jpeg.startswith(b"\xff\xd8"):
        raise ValueError("expected a JPEG")
    return jpeg[:2] + exif_segment + jpeg[2:]


def _gps_exif() -> bytes:
    ifd0_offset = 8
    gps_ifd_offset = ifd0_offset + 2 + 12 + 4
    gps_ifd_size = 2 + 12 * 4 + 4
    latitude_offset = gps_ifd_offset + gps_ifd_size
    longitude_offset = latitude_offset + 24

    latitude = _rational(40) + _rational(0) + _rational(0)
    longitude = _rational(8) + _rational(0) + _rational(0)
    gps_ifd = (
        struct.pack("<H", 4)
        + struct.pack("<HHI", 1, 2, 2)
        + b"N\x00\x00\x00"
        + struct.pack("<HHII", 2, 5, 3, latitude_offset)
        + struct.pack("<HHI", 3, 2, 2)
        + b"W\x00\x00\x00"
        + struct.pack("<HHII", 4, 5, 3, longitude_offset)
        + struct.pack("<I", 0)
    )
    tiff = (
        b"II"
        + struct.pack("<HI", 42, ifd0_offset)
        + struct.pack("<H", 1)
        + struct.pack("<HHII", 0x8825, 4, 1, gps_ifd_offset)
        + struct.pack("<I", 0)
        + gps_ifd
        + latitude
        + longitude
    )
    exif = b"Exif\x00\x00" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(exif) + 2) + exif


def _rational(numerator: int, denominator: int = 1) -> bytes:
    return struct.pack("<II", numerator, denominator)
