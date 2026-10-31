"""Expo Push HTTP API client.

The notification text is neutral and carries no study name; the payload carries only the prompt
id, with which the app finds the study locally (security.md, NFR-52). The client batches up to the
100 messages Expo accepts per request. Receipts are not fetched: the app has a local-notification
fallback and pulls pending prompts when it opens (architecture.md, notifications).
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

logger = logging.getLogger(__name__)

EXPO_BATCH_SIZE = 100

_MESSAGES = {
    "pt": ("Fieldnote", "Tem uma nova atividade disponível."),
    "en": ("Fieldnote", "A new activity is available."),
}


@dataclass(frozen=True)
class PushMessage:
    prompt_id: UUID
    push_token: str
    locale: str | None = None


@dataclass(frozen=True)
class PushResult:
    prompt_id: UUID
    delivered: bool
    error: str | None = None


class PushTransport(Protocol):
    def post(
        self, url: str, headers: dict[str, str], body: bytes, timeout: float
    ) -> tuple[int, bytes]:
        """Return the HTTP status and the response body."""


class UrllibTransport:
    def post(
        self, url: str, headers: dict[str, str], body: bytes, timeout: float
    ) -> tuple[int, bytes]:
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()


class ExpoPushClient:
    def __init__(
        self,
        access_token: str | None,
        *,
        enabled: bool = True,
        url: str = "https://exp.host/--/api/v2/push/send",
        timeout_seconds: float = 10.0,
        transport: PushTransport | None = None,
    ) -> None:
        self.access_token = access_token
        self.enabled = enabled
        self.url = url
        self.timeout_seconds = timeout_seconds
        self.transport = transport or UrllibTransport()

    def send(self, messages: Sequence[PushMessage]) -> list[PushResult]:
        if not messages:
            return []
        if not self.enabled:
            # Switched off by configuration: log the prompt ids instead of sending.
            for message in messages:
                logger.info("push disabled, would send prompt %s", message.prompt_id)
            return [
                PushResult(message.prompt_id, delivered=False, error="push_disabled")
                for message in messages
            ]

        results: list[PushResult] = []
        for start in range(0, len(messages), EXPO_BATCH_SIZE):
            results.extend(self._send_batch(messages[start : start + EXPO_BATCH_SIZE]))
        return results

    def _send_batch(self, messages: Sequence[PushMessage]) -> list[PushResult]:
        payload = [self._payload(message) for message in messages]
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        body = json.dumps(payload).encode("utf-8")
        try:
            status, response_body = self.transport.post(
                self.url, headers, body, self.timeout_seconds
            )
        except OSError as error:
            logger.warning("Expo Push request failed: %s", error)
            return [
                PushResult(message.prompt_id, delivered=False, error=str(error))
                for message in messages
            ]
        if not 200 <= status < 300:
            logger.warning("Expo Push answered HTTP %s", status)
            return [
                PushResult(
                    message.prompt_id,
                    delivered=False,
                    error=f"http_{status}",
                )
                for message in messages
            ]

        tickets = _tickets(response_body)
        results: list[PushResult] = []
        for index, message in enumerate(messages):
            ticket = tickets[index] if index < len(tickets) else {}
            if ticket.get("status") == "ok":
                results.append(PushResult(message.prompt_id, delivered=True))
            else:
                error = str(ticket.get("message") or "unknown_error")
                logger.warning("Expo Push rejected prompt %s: %s", message.prompt_id, error)
                results.append(PushResult(message.prompt_id, delivered=False, error=error))
        return results

    @staticmethod
    def _payload(message: PushMessage) -> dict[str, object]:
        title, body = _MESSAGES["en" if message.locale == "en" else "pt"]
        return {
            "to": message.push_token,
            "title": title,
            "body": body,
            "data": {"prompt_id": str(message.prompt_id)},
            "sound": "default",
            "priority": "high",
        }


def _tickets(response_body: bytes) -> list[dict[str, object]]:
    try:
        parsed = json.loads(response_body or b"{}")
    except json.JSONDecodeError:
        logger.warning("Expo Push returned a body that is not JSON")
        return []
    data = parsed.get("data") if isinstance(parsed, dict) else None
    return data if isinstance(data, list) else []


__all__ = ["EXPO_BATCH_SIZE", "ExpoPushClient", "PushMessage", "PushResult", "PushTransport"]
