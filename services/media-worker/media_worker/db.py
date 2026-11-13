"""All SQL the media worker runs, kept in one module for review."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import psycopg

logger = logging.getLogger(__name__)

MARK_PROCESSED_SQL = """
UPDATE media_object
SET status = 'processed'::media_status, sha256 = %s, size_bytes = %s, mime_type = %s
WHERE id = %s
"""

MARK_FAILED_SQL = "UPDATE media_object SET status = 'failed'::media_status WHERE id = %s"

MEDIA_TARGET_SQL = """
SELECT e.id, p.alias
FROM media_object mo
LEFT JOIN entry e ON e.id = mo.entry_id
LEFT JOIN participant p ON p.id = e.participant_id
WHERE mo.id = %s
"""

RECORD_MEDIA_FAILED_SQL = """
INSERT INTO audit_log (actor_type, actor_id, action, target, details, origin_client)
VALUES ('system'::audit_actor_type, NULL, 'media_failed', %s, %s, 'automatic_task')
"""


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

    def mark_failed(self, media_object_id: UUID, *, reason: str) -> None:
        """Mark the file failed and write one ``media_failed`` audit row (FR-68).

        The target is the entry or the participant alias, never the participant's identity, and
        the origin is the automatic task, because the worker, not a person, took the decision.
        """
        with psycopg.connect(
            self._dsn,
            connect_timeout=self._connect_timeout,
        ) as connection:
            cursor = connection.execute(MARK_FAILED_SQL, (media_object_id,))
            found = cursor.rowcount > 0
            if found:
                row = connection.execute(MEDIA_TARGET_SQL, (media_object_id,)).fetchone()
                connection.execute(
                    RECORD_MEDIA_FAILED_SQL,
                    (_media_target(row, media_object_id), json.dumps({"reason": reason})),
                )
        if not found:
            logger.warning("media object %s not found while marking it failed", media_object_id)

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


def _media_target(row: tuple[Any, ...] | None, media_object_id: UUID) -> str:
    if row is None:
        return str(media_object_id)
    entry_id, alias = row
    if alias:
        return str(alias)
    if entry_id is not None:
        return str(entry_id)
    return str(media_object_id)


def _to_libpq_dsn(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
