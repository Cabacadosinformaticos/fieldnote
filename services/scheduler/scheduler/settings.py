"""Runtime settings of the scheduler service.

The pure planner in :mod:`scheduler.model` never reads the environment; this module is the only
place where the process configuration enters the library.
"""

from __future__ import annotations

import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    database_url: str = "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    database_connect_timeout_seconds: int = 5

    # Expo accepts sends without a token unless the project enforces push security.
    push_enabled: bool = True
    expo_access_token: str | None = None
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    expo_push_timeout_seconds: float = 10.0

    # Studies close their activity windows at 22:00, so planning the next day at 22:00 local
    # leaves a complete day of prompts ahead (scheduler.md: "every night").
    plan_hour: int = Field(default=22, ge=0, le=23)
    default_timezone: str = "UTC"

    lease_name: str = "scheduler"
    lease_ttl_seconds: int = Field(default=15, ge=3)
    lease_renew_seconds: float = Field(default=5.0, ge=0.5)

    tick_seconds: float = Field(default=5.0, gt=0)
    replan_poll_seconds: float = Field(default=10.0, gt=0)

    plan_node_limit: int = Field(default=1_000_000, ge=1)
    plan_time_limit_seconds: float = Field(default=10.0, gt=0)
    send_batch_size: int = Field(default=100, ge=1, le=100)

    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def _normalise_log_level(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def _renew_before_expiry(self) -> Settings:
        if self.lease_renew_seconds >= self.lease_ttl_seconds:
            raise ValueError("lease_renew_seconds must be shorter than lease_ttl_seconds")
        return self

    @property
    def libpq_database_url(self) -> str:
        """The URL with the SQLAlchemy dialect suffix removed, for psycopg."""
        return self.database_url.replace("postgresql+psycopg://", "postgresql://").replace(
            "postgresql+psycopg2://", "postgresql://"
        )

    def zone(self, name: str | None) -> ZoneInfo:
        """The zone of a study, falling back to the configured default when it is unknown."""
        candidate = (name or self.default_timezone).strip() or self.default_timezone
        try:
            return ZoneInfo(candidate)
        except (ZoneInfoNotFoundError, ValueError):
            logger.warning("unknown study time zone %r, using %s", name, self.default_timezone)
            return ZoneInfo(self.default_timezone)


__all__ = ["Settings"]
