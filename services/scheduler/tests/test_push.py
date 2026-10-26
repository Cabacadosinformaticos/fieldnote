"""Expo Push client: batching, payload privacy and the development fallback."""

from __future__ import annotations

import json
from uuid import UUID, uuid4

from scheduler.push import EXPO_BATCH_SIZE, ExpoPushClient, PushMessage

URL = "https://exp.example.test/push"


class FakeTransport:
    def __init__(self, tickets: list[dict[str, object]] | None = None, status: int = 200) -> None:
        self.calls: list[tuple[str, dict[str, str], list[dict[str, object]], float]] = []
        self._tickets = tickets
        self._status = status

    def post(
        self, url: str, headers: dict[str, str], body: bytes, timeout: float
    ) -> tuple[int, bytes]:
        payload = json.loads(body)
        self.calls.append((url, headers, payload, timeout))
        tickets = self._tickets
        if tickets is None:
            tickets = [{"status": "ok"} for _ in payload]
        return self._status, json.dumps({"data": tickets}).encode()


def _messages(count: int) -> list[PushMessage]:
    return [
        PushMessage(prompt_id=uuid4(), push_token=f"ExponentPushToken[{index}]", locale="pt")
        for index in range(count)
    ]


def test_messages_are_batched_and_carry_only_the_prompt_id() -> None:
    transport = FakeTransport()
    client = ExpoPushClient("secret", url=URL, timeout_seconds=3, transport=transport)
    messages = _messages(EXPO_BATCH_SIZE + 25)

    results = client.send(messages)

    assert len(transport.calls) == 2
    assert [len(call[2]) for call in transport.calls] == [EXPO_BATCH_SIZE, 25]
    assert all(result.delivered for result in results)
    url, headers, first_batch, timeout = transport.calls[0]
    assert (url, timeout) == (URL, 3)
    assert headers["Authorization"] == "Bearer secret"
    assert set(first_batch[0]) == {"to", "title", "body", "data", "sound", "priority"}
    prompt_id = messages[0].prompt_id
    assert first_batch[0]["data"] == {"prompt_id": str(prompt_id)}
    assert isinstance(prompt_id, UUID)


def test_english_locale_uses_the_english_text() -> None:
    transport = FakeTransport()
    client = ExpoPushClient("secret", url=URL, transport=transport)
    messages = [PushMessage(uuid4(), "ExponentPushToken[en]", locale="en")]
    client.send(messages)
    payload = transport.calls[0][2][0]
    assert payload["body"] == "A new activity is available."


def test_without_an_expo_token_nothing_is_sent() -> None:
    transport = FakeTransport()
    client = ExpoPushClient(None, url=URL, transport=transport)

    results = client.send(_messages(2))

    assert transport.calls == []
    assert [result.delivered for result in results] == [False, False]
    assert all(result.error == "push_not_configured" for result in results)


def test_error_tickets_are_reported() -> None:
    transport = FakeTransport(tickets=[{"status": "error", "message": "DeviceNotRegistered"}])
    client = ExpoPushClient("secret", url=URL, transport=transport)

    results = client.send(_messages(1))

    assert results[0].delivered is False
    assert results[0].error == "DeviceNotRegistered"


def test_http_failure_marks_every_message_undelivered() -> None:
    transport = FakeTransport(status=503)
    client = ExpoPushClient("secret", url=URL, transport=transport)

    results = client.send(_messages(2))

    assert all(not result.delivered for result in results)
    assert all(result.error == "http_503" for result in results)
