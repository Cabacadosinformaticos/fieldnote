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


settings = Settings()
