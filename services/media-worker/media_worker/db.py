"""All SQL the media worker runs, kept in one module for review."""

from __future__ import annotations

import logging
from uuid import UUID

import psycopg

logger = logging.getLogger(__name__)

MARK_PROCESSED_SQL = """
UPDATE media_object
SET status = 'processed'::media_status, sha256 = %s, size_bytes = %s, mime_type = %s
WHERE id = %s
"""

MARK_FAILED_SQL = "UPDATE media_object SET status = 'failed'::media_status WHERE id = %s"


class MediaObjectRepository:
    def __init__(self, database_url: str, *, connect_timeout: int = 5) -> None:
        self._dsn = _to_libpq_dsn(database_url)
        self._connect_timeout = connect_timeout

    def mark_processed(
        self,
        media_object_id: UUID,
        *,
        sha256: str,
        size_bytes: int,
        mime_type: str,
    ) -> None:
        self._execute(
            MARK_PROCESSED_SQL,
            (sha256, size_bytes, mime_type, media_object_id),
            media_object_id,
            "processed",
        )

    def mark_failed(self, media_object_id: UUID) -> None:
        self._execute(MARK_FAILED_SQL, (media_object_id,), media_object_id, "failed")

    def _execute(
        self,
        sql: str,
        parameters: tuple[object, ...],
        media_object_id: UUID,
        status: str,
    ) -> None:
        with psycopg.connect(
            self._dsn,
            connect_timeout=self._connect_timeout,
        ) as connection:
            cursor = connection.execute(sql, parameters)
        if cursor.rowcount == 0:
            logger.warning("media object %s not found while marking it %s", media_object_id, status)


def _to_libpq_dsn(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
