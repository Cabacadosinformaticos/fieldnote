from pathlib import Path

import pytest

from media_worker.processing import (
    MediaProcessingError,
    UnsupportedMediaError,
    probe_media,
    process_audio,
    process_media,
    process_photo,
    process_video,
)
from tests.conftest import Samples
from tests.support import first_stream, metadata_tags, probe

SENSITIVE_PARTS = ("gps", "location", "title", "comment", "secret")


def assert_no_sensitive_metadata(path: Path) -> None:
    suspicious = {
        name: value
        for name, value in metadata_tags(path).items()
        if any(part in f"{name} {value}".lower() for part in SENSITIVE_PARTS)
    }
    assert suspicious == {}


def test_probe_detects_the_real_media_type(samples: Samples) -> None:
    photo = probe_media(samples.photo)
    video = probe_media(samples.video)
    audio = probe_media(samples.audio)

    assert (photo.kind, photo.mime_type) == ("photo", "image/jpeg")
    assert (video.kind, video.mime_type) == ("video", "video/mp4")
    assert (audio.kind, audio.mime_type) == ("audio", "audio/mp4")


def test_photo_is_reencoded_without_exif_and_gets_a_thumbnail(
    samples: Samples, tmp_path: Path
) -> None:
    assert b"Exif" in samples.photo.read_bytes()

    output = tmp_path / "photo.jpg"
    thumbnail = tmp_path / "thumbnail.jpg"
    result = process_photo(samples.photo, output, thumbnail)

    assert result.mime_type == "image/jpeg"
    assert result.thumbnail_path == thumbnail
    assert b"Exif" not in output.read_bytes()
    assert b"Exif" not in thumbnail.read_bytes()

    payload = probe(output)
    stream = first_stream(payload, "video")
    assert stream["codec_name"] == "mjpeg"
    assert (
        "jpeg" in payload["format"]["format_name"] or "image2" in payload["format"]["format_name"]
    )
    assert_no_sensitive_metadata(output)

    thumbnail_stream = first_stream(probe(thumbnail), "video")
    assert thumbnail_stream["codec_name"] == "mjpeg"
    assert max(thumbnail_stream["width"], thumbnail_stream["height"]) <= 480


def test_video_is_h264_mp4_with_aac_and_a_thumbnail(samples: Samples, tmp_path: Path) -> None:
    assert "location" in {name.lower() for name in metadata_tags(samples.video)}

    output = tmp_path / "video.mp4"
    thumbnail = tmp_path / "thumbnail.jpg"
    result = process_video(samples.video, output, thumbnail)

    assert result.mime_type == "video/mp4"
    payload = probe(output)
    video_stream = first_stream(payload, "video")
    audio_stream = first_stream(payload, "audio")
    assert video_stream["codec_name"] == "h264"
    assert audio_stream["codec_name"] == "aac"
    assert "mp4" in payload["format"]["format_name"]
    assert video_stream["width"] <= 1280
    assert video_stream["height"] <= 720
    assert_no_sensitive_metadata(output)

    data = output.read_bytes()
    assert data.find(b"moov") < data.find(b"mdat")

    thumbnail_stream = first_stream(probe(thumbnail), "video")
    assert thumbnail_stream["codec_name"] == "mjpeg"
    assert max(thumbnail_stream["width"], thumbnail_stream["height"]) <= 480


def test_hd_video_is_downscaled_to_720p(samples: Samples, tmp_path: Path) -> None:
    output = tmp_path / "hd.mp4"
    thumbnail = tmp_path / "thumbnail.jpg"
    process_video(samples.hd_video, output, thumbnail)

    stream = first_stream(probe(output), "video")
    assert stream["width"] <= 1280
    assert stream["height"] <= 720
    assert stream["width"] * stream["height"] < 1920 * 1080


def test_audio_is_aac_m4a_without_metadata(samples: Samples, tmp_path: Path) -> None:
    assert "location" in {name.lower() for name in metadata_tags(samples.audio)}

    output = tmp_path / "audio.m4a"
    result = process_audio(samples.audio, output)

    assert result.mime_type == "audio/mp4"
    assert result.thumbnail_path is None
    payload = probe(output)
    assert first_stream(payload, "audio")["codec_name"] == "aac"
    assert "mp4" in payload["format"]["format_name"]
    assert_no_sensitive_metadata(output)


def test_process_media_dispatches_photos(samples: Samples, tmp_path: Path) -> None:
    workdir = tmp_path / "work"
    result = process_media(samples.photo, workdir)

    assert result.kind == "photo"
    assert result.path == workdir / "processed.jpg"
    assert result.thumbnail_path == workdir / "thumbnail.jpg"
    assert result.path.is_file()
    assert result.thumbnail_path.is_file()


def test_non_media_input_is_rejected(tmp_path: Path) -> None:
    source = tmp_path / "notes.txt"
    source.write_text("this is not a media file", encoding="utf-8")

    with pytest.raises(UnsupportedMediaError):
        probe_media(source)
    with pytest.raises(MediaProcessingError):
        process_media(source, tmp_path / "work")


def test_processing_functions_reject_the_wrong_kind(samples: Samples, tmp_path: Path) -> None:
    with pytest.raises(UnsupportedMediaError):
        process_photo(samples.video, tmp_path / "out.jpg", tmp_path / "thumb.jpg")
    with pytest.raises(UnsupportedMediaError):
        process_video(samples.photo, tmp_path / "out.mp4", tmp_path / "thumb.jpg")
    with pytest.raises(UnsupportedMediaError):
        process_audio(samples.video, tmp_path / "out.m4a")


def test_missing_input_is_reported(tmp_path: Path) -> None:
    with pytest.raises(MediaProcessingError, match="does not exist"):
        probe_media(tmp_path / "missing.jpg")
