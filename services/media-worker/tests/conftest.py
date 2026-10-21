from dataclasses import dataclass
from pathlib import Path

import pytest

from tests.support import make_audio, make_jpeg_with_gps, make_video


@dataclass(frozen=True)
class Samples:
    photo: Path
    video: Path
    hd_video: Path
    audio: Path


@pytest.fixture(scope="session")
def samples(tmp_path_factory: pytest.TempPathFactory) -> Samples:
    directory = tmp_path_factory.mktemp("media-samples")

    photo = directory / "photo.jpg"
    make_jpeg_with_gps(photo)

    video = directory / "video.mp4"
    make_video(video, width=640, height=360, duration=3)

    hd_video = directory / "hd-video.mp4"
    make_video(hd_video, width=1920, height=1080, duration=1, with_audio=False)

    audio = directory / "audio.m4a"
    make_audio(audio)

    return Samples(photo=photo, video=video, hd_video=hd_video, audio=audio)
