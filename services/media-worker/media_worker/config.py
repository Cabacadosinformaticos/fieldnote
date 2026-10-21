from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    database_url: str = "postgresql+psycopg://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
    environment: str = "development"

    s3_endpoint: str = "http://localhost:8080"
    s3_bucket: str = "media"
    s3_access_key: str = "GK0123456789abcdef01234567"
    s3_secret_key: str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    s3_region: str = "garage"

    rabbitmq_url: str = "amqp://fieldnote:fieldnote@127.0.0.1:5672/"

    media_queue: str = "media.process"
    media_dead_letter_queue: str = "media.process.dead"
    media_max_delivery_attempts: int = 5
    ffmpeg_timeout_seconds: int = 300


settings = Settings()
