"""Response bodies for the export page: the list of earlier exports of a study."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import EntryType


class ExportHistoryItem(BaseModel):
    id: int
    who: str
    when: datetime
    entry_count: int | None = None
    scope: str = "all"
    filter: dict[str, object] | None = None
    include_location: bool = False
    include_identity: bool = False
    include_media: bool = False
    media_types: list[EntryType] = Field(default_factory=list)
    include_csv: bool = True


class ExportHistoryResponse(BaseModel):
    items: list[ExportHistoryItem] = Field(default_factory=list)
