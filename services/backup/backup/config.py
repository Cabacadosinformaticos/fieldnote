from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

KEY_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    database_url: str = "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"

    s3_endpoint: str = "http://127.0.0.1:8080"
    s3_bucket: str = "media"
    backups_bucket: str = "backups"
    s3_access_key: str = "GK0123456789abcdef01234567"
    s3_secret_key: str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    s3_region: str = "garage"

    # The key lives outside the stack and is mounted read-only. The retention is capped at the
    # seven days before an erasure started in the app becomes permanent (security.md).
    backup_key_file: Path = Path("/run/secrets/backup.key")
    retention_days: int = Field(default=7, ge=1, le=7)

    # Garage's admin API is used once to create the backups bucket and allow the S3 key.
    garage_admin_endpoint: str | None = None
    garage_admin_token: str | None = None

    pg_dump: str = "pg_dump"
    pg_restore: str = "pg_restore"


def load_key(path: Path) -> bytes:
    try:
        key = Path(path).read_bytes()
    except OSError as exc:
        raise ValueError(f"cannot read the backup key at {path}: {exc}") from exc
    if len(key) != KEY_BYTES:
        raise ValueError(f"the backup key must be exactly {KEY_BYTES} bytes, got {len(key)}")
    return key
