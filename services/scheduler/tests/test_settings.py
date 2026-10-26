"""Settings and time-zone handling."""

from __future__ import annotations

from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from scheduler.settings import Settings


def test_defaults_match_the_architecture() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    )
    assert settings.lease_ttl_seconds == 15
    assert settings.lease_renew_seconds == 5
    assert settings.plan_hour == 22
    assert settings.expo_access_token is None
    assert settings.libpq_database_url == (
        "postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    )


def test_study_time_zone_is_used(settings: Settings) -> None:
    assert settings.zone("Europe/Lisbon") == ZoneInfo("Europe/Lisbon")


def test_unknown_study_time_zone_falls_back_to_the_default(settings: Settings) -> None:
    assert settings.zone("Not/AZone") == ZoneInfo(settings.default_timezone)


def test_invalid_values_are_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(lease_ttl_seconds=1)
    with pytest.raises(ValidationError):
        Settings(lease_ttl_seconds=10, lease_renew_seconds=10)
    with pytest.raises(ValidationError):
        Settings(plan_hour=24)
