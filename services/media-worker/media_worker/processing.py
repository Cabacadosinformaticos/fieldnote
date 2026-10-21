"""ffmpeg and ffprobe helpers.

The real content decides the media type: every entry point probes the bytes with ffprobe and
never trusts the file extension. Outputs are re-encoded so that input metadata, including EXIF
GPS and container tags, does not survive.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

MediaKind = Literal["photo", "video", "audio"]

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"
DEFAULT_TIMEOUT_SECONDS = 300

IMAGE_FORMAT_HINTS = (
    "image2",
    "jpeg_pipe",
    "mjpeg",
    "png_pipe",
    "webp_pipe",
    "bmp_pipe",
    "tiff_pipe",
    "gif",
    "apng",
    "heic",
    "avif",
    "ico",
)

PHOTO_MIME_BY_CODEC = {
    "mjpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "gif": "image/gif",
}

VIDEO_MIME_BY_FORMAT = (
    ("webm", "video/webm"),
    ("matroska", "video/x-matroska"),
    ("mpeg", "video/mpeg"),
    ("avi", "video/x-msvideo"),
    ("flv", "video/x-flv"),
    ("ogg", "video/ogg"),
)

AUDIO_MIME_BY_FORMAT = (
    ("mp3", "audio/mpeg"),
    ("wav", "audio/wav"),
    ("flac", "audio/flac"),
    ("ogg", "audio/ogg"),
    ("opus", "audio/ogg"),
    ("aac", "audio/aac"),
    ("amr", "audio/amr"),
    ("mov,mp4", "audio/mp4"),
)

THUMBNAIL_SCALE = "scale='min(480,iw)':'min(480,ih)':force_original_aspect_ratio=decrease"
VIDEO_SCALE = (
    "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease,"
    "pad=ceil(iw/2)*2:ceil(ih/2)*2"
)


class MediaProcessingError(RuntimeError):
    """A permanent error: the file cannot be processed and retrying will not help."""


class UnsupportedMediaError(MediaProcessingError):
    """The file is not an image, audio or video, or it is not the expected kind."""


class MediaToolMissingError(RuntimeError):
    """ffmpeg or ffprobe is not installed."""


@dataclass(frozen=True)
class MediaInfo:
    kind: MediaKind
    mime_type: str
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None


@dataclass(frozen=True)
class ProcessedMedia:
    kind: MediaKind
    mime_type: str
    path: Path
    thumbnail_path: Path | None = None
    thumbnail_mime_type: str | None = None


def probe_media(path: Path, *, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> MediaInfo:
    path = Path(path)
    if not path.is_file():
        raise MediaProcessingError(f"input file does not exist: {path}")

    try:
        result = _run(
            [
                FFPROBE,
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(path),
            ],
            timeout,
        )
    except MediaProcessingError as exc:
        raise UnsupportedMediaError(f"not an image, audio or video file: {exc}") from exc

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise UnsupportedMediaError("ffprobe did not return valid JSON") from exc

    streams = payload.get("streams") or []
    format_data = payload.get("format") or {}
    format_name = str(format_data.get("format_name") or "").lower()
    kind, stream = _classify(format_name, streams)

    width = _optional_int(stream.get("width"))
    height = _optional_int(stream.get("height"))
    duration = _optional_float(format_data.get("duration"))

    if kind == "photo":
        mime_type = _photo_mime(format_name, str(stream.get("codec_name") or ""))
        duration = None
    elif kind == "video":
        mime_type = _video_mime(format_name)
    else:
        mime_type = _audio_mime(format_name)

    return MediaInfo(
        kind=kind,
        mime_type=mime_type,
        width=width,
        height=height,
        duration_seconds=duration,
    )


def process_media(
    input_path: Path,
    workdir: Path,
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> ProcessedMedia:
    """Process any accepted media file, writing the outputs below ``workdir``."""
    info = probe_media(input_path, timeout=timeout)
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    if info.kind == "photo":
        return process_photo(
            input_path,
            workdir / "processed.jpg",
            workdir / "thumbnail.jpg",
            timeout=timeout,
        )
    if info.kind == "video":
        return process_video(
            input_path,
            workdir / "processed.mp4",
            workdir / "thumbnail.jpg",
            timeout=timeout,
        )
    return process_audio(input_path, workdir / "processed.m4a", timeout=timeout)


def process_photo(
    input_path: Path,
    output_path: Path,
    thumbnail_path: Path,
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> ProcessedMedia:
    """Re-encode a photo as JPEG without metadata and write a 480 px thumbnail."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    thumbnail_path = Path(thumbnail_path)

    info = probe_media(input_path, timeout=timeout)
    if info.kind != "photo":
        raise UnsupportedMediaError(f"expected a photo, got {info.kind}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

    _encode(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            "-c:v",
            "mjpeg",
            "-q:v",
            "2",
            "-pix_fmt",
            "yuvj420p",
            str(output_path),
        ],
        output_path,
        timeout,
    )
    _encode(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-vf",
            THUMBNAIL_SCALE,
            "-map_metadata",
            "-1",
            "-c:v",
            "mjpeg",
            "-q:v",
            "4",
            "-pix_fmt",
            "yuvj420p",
            str(thumbnail_path),
        ],
        thumbnail_path,
        timeout,
    )

    return ProcessedMedia(
        kind="photo",
        mime_type="image/jpeg",
        path=output_path,
        thumbnail_path=thumbnail_path,
        thumbnail_mime_type="image/jpeg",
    )


def process_video(
    input_path: Path,
    output_path: Path,
    thumbnail_path: Path,
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> ProcessedMedia:
    """Transcode a video to H.264 MP4 at most 720p, with AAC audio and a thumbnail."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    thumbnail_path = Path(thumbnail_path)

    info = probe_media(input_path, timeout=timeout)
    if info.kind != "video":
        raise UnsupportedMediaError(f"expected a video, got {info.kind}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

    _encode(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-vf",
            VIDEO_SCALE,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            str(output_path),
        ],
        output_path,
        timeout,
    )
    _extract_video_thumbnail(input_path, thumbnail_path, timeout)

    return ProcessedMedia(
        kind="video",
        mime_type="video/mp4",
        path=output_path,
        thumbnail_path=thumbnail_path,
        thumbnail_mime_type="image/jpeg",
    )


def process_audio(
    input_path: Path,
    output_path: Path,
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> ProcessedMedia:
    """Re-encode audio as AAC in an M4A container without metadata."""
    input_path = Path(input_path)
    output_path = Path(output_path)

    info = probe_media(input_path, timeout=timeout)
    if info.kind != "audio":
        raise UnsupportedMediaError(f"expected audio, got {info.kind}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    _encode(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(input_path),
            "-map",
            "0:a:0",
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            str(output_path),
        ],
        output_path,
        timeout,
    )

    return ProcessedMedia(kind="audio", mime_type="audio/mp4", path=output_path)


def _classify(
    format_name: str, streams: list[dict[str, object]]
) -> tuple[MediaKind, dict[str, object]]:
    videos = [
        stream
        for stream in streams
        if stream.get("codec_type") == "video" and not _is_cover_art(stream)
    ]
    audios = [stream for stream in streams if stream.get("codec_type") == "audio"]

    if videos and any(hint in format_name for hint in IMAGE_FORMAT_HINTS):
        return "photo", videos[0]
    if videos:
        return "video", videos[0]
    if audios:
        return "audio", audios[0]
    raise UnsupportedMediaError("file is not an image, audio or video")


def _is_cover_art(stream: dict[str, object]) -> bool:
    disposition = stream.get("disposition")
    return isinstance(disposition, dict) and bool(disposition.get("attached_pic"))


def _photo_mime(format_name: str, codec_name: str) -> str:
    if "heic" in format_name:
        return "image/heic"
    if "avif" in format_name:
        return "image/avif"
    return PHOTO_MIME_BY_CODEC.get(codec_name, "application/octet-stream")


def _video_mime(format_name: str) -> str:
    for hint, mime_type in VIDEO_MIME_BY_FORMAT:
        if hint in format_name:
            return mime_type
    if "mp4" in format_name or "mov" in format_name or "3gp" in format_name:
        return "video/mp4"
    return "application/octet-stream"


def _audio_mime(format_name: str) -> str:
    for hint, mime_type in AUDIO_MIME_BY_FORMAT:
        if hint in format_name:
            return mime_type
    return "application/octet-stream"


def _extract_video_thumbnail(input_path: Path, thumbnail_path: Path, timeout: int) -> None:
    last_error: MediaProcessingError | None = None
    for position in ("1", "0"):
        try:
            _encode(
                [
                    FFMPEG,
                    "-nostdin",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-ss",
                    position,
                    "-i",
                    str(input_path),
                    "-map",
                    "0:v:0",
                    "-frames:v",
                    "1",
                    "-vf",
                    THUMBNAIL_SCALE,
                    "-map_metadata",
                    "-1",
                    "-c:v",
                    "mjpeg",
                    "-q:v",
                    "4",
                    "-pix_fmt",
                    "yuvj420p",
                    str(thumbnail_path),
                ],
                thumbnail_path,
                timeout,
            )
        except MediaProcessingError as exc:
            last_error = exc
            continue
        if thumbnail_path.is_file() and thumbnail_path.stat().st_size > 0:
            return

    if last_error is not None:
        raise MediaProcessingError("could not extract a video thumbnail") from last_error
    raise MediaProcessingError("ffmpeg produced an empty video thumbnail")


def _encode(command: list[str], output_path: Path, timeout: int) -> None:
    try:
        _run(command, timeout)
    except MediaProcessingError:
        output_path.unlink(missing_ok=True)
        raise


def _run(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise MediaToolMissingError(f"{command[0]} is not installed or not on PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaProcessingError(f"{command[0]} timed out after {timeout}s") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or "").strip().splitlines()
        message = detail[-1] if detail else f"exit code {exc.returncode}"
        raise MediaProcessingError(f"{command[0]} failed: {message}") from exc


def _optional_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _optional_float(value: object) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
