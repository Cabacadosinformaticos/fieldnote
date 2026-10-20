from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIELDNOTE_", extra="ignore")

    database_url: str = "postgresql+psycopg://fieldnote:fieldnote@localhost:5432/fieldnote"
    environment: str = "development"


settings = Settings()
