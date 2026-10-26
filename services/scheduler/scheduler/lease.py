"""The leader lease that makes one scheduler replica active at a time.

The row lives in ``leader_lease`` and is renewed every ``lease_renew_seconds`` with a TTL of
``lease_ttl_seconds`` (5 s and 15 s in the architecture). The standby takes the row only after it
expires, so a crashed leader is replaced within one TTL plus one polling period.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import datetime

import psycopg
from psycopg import Connection

from . import db

logger = logging.getLogger(__name__)


class LeaderLease:
    def __init__(
        self,
        name: str,
        holder: str,
        ttl_seconds: int,
        renew_seconds: float,
        *,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.name = name
        self.holder = holder
        self.ttl_seconds = ttl_seconds
        self.renew_seconds = renew_seconds
        self._monotonic = monotonic
        self._next_renew = 0.0
        self.held = False
        self.expires_at: datetime | None = None

    def refresh(self, conn: Connection) -> bool:
        """Acquire the lease, or renew it when the renewal interval has passed.

        A database error during a renewal clears ``held`` before propagating: the replica stops
        sending at once, even if the network failure is transient.
        """
        now = self._monotonic()
        if self.held and now < self._next_renew:
            return True
        try:
            if self.held:
                row = db.renew_lease(conn, self.name, self.holder, self.ttl_seconds)
                if row is None:
                    self._lose("lease renewal found another holder")
                    return False
                self.expires_at = row.expires_at
            else:
                row = db.acquire_lease(conn, self.name, self.holder, self.ttl_seconds)
                if row is None:
                    return False
                logger.info("acquired the scheduler lease as %s", self.holder)
                self.expires_at = row.expires_at
            self.held = True
            self._next_renew = now + self.renew_seconds
            return True
        except psycopg.Error:
            self._lose("database error while refreshing the lease")
            raise

    def renew_now(self, conn: Connection) -> bool:
        """Renew immediately, used after a long stretch of planning or sending."""
        if not self.held:
            return False
        try:
            row = db.renew_lease(conn, self.name, self.holder, self.ttl_seconds)
        except psycopg.Error:
            self._lose("database error while renewing the lease")
            raise
        if row is None:
            self._lose("lease renewal found another holder")
            return False
        self.expires_at = row.expires_at
        self._next_renew = self._monotonic() + self.renew_seconds
        return True

    def release(self, conn: Connection) -> None:
        if not self.held:
            return
        try:
            db.release_lease(conn, self.name, self.holder)
        except psycopg.Error:
            logger.warning("could not release the scheduler lease", exc_info=True)
        finally:
            self.held = False

    def mark_lost(self) -> None:
        self._lose("database call failed; stopping sends until the lease is renewed")

    def _lose(self, reason: str) -> None:
        if self.held:
            logger.warning("lost the scheduler lease: %s", reason)
        self.held = False


__all__ = ["LeaderLease"]
