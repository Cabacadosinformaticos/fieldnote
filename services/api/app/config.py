from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Only used when FIELDNOTE_ENVIRONMENT is not production. Production refuses to start without its
# own secret.
_DEVELOPMENT_JWT_SECRET = "fieldnote-development-jwt-secret-not-for-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    database_url: str = "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    environment: str = "development"

    s3_endpoint: str = "http://localhost:8080"
    s3_bucket: str = "media"
    s3_access_key: str = "GK0123456789abcdef01234567"
    s3_secret_key: str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    s3_region: str = "garage"

    # One broker URL, or a comma-separated list of cluster addresses; readiness needs any.
    rabbitmq_url: str = "amqp://fieldnote:fieldnote@127.0.0.1:5672/"

    # Origin of the gateway as the phones see it; signed upload URLs are built on it.
    media_public_endpoint: str = "http://127.0.0.1:8080"
    # Origin of the gateway as the researcher's browser sees it; signed download URLs use it.
    media_dashboard_endpoint: str = "http://127.0.0.1:8080"

    jwt_secret: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    refresh_cookie_name: str = "fieldnote_refresh"
    refresh_cookie_path: str = "/api/v1/auth"
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "strict"

    login_max_failures: int = 5
    login_lockout_minutes: int = 15
    login_failure_delay_seconds: float = 0.25
    login_failure_delay_max_failures: int = 5

    totp_issuer: str = "Fieldnote"
    totp_digits: int = 6
    totp_period_seconds: int = 30
    totp_valid_window: int = 1

    @model_validator(mode="after")
    def _validate_security_settings(self) -> "Settings":
        if self.environment.strip().lower() == "production":
            if not self.jwt_secret:
                raise ValueError(
                    "FIELDNOTE_JWT_SECRET is required when FIELDNOTE_ENVIRONMENT is production."
                )
            if not self.cookie_secure:
                raise ValueError(
                    "FIELDNOTE_COOKIE_SECURE must be true when FIELDNOTE_ENVIRONMENT is production."
                )
        elif self.jwt_secret is None:
            self.jwt_secret = _DEVELOPMENT_JWT_SECRET
        return self


settings = Settings()
