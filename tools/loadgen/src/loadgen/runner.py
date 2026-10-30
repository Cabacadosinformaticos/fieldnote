"""Create a study, join simulated phones and send entries for a fixed time.

The researcher is created through the administrator API, exactly like ``tools/demo-data/seed.py``
creates its accounts, and then signs in as a researcher to design and run the study. Every phone
has its own device token; each entry has its own UUID and is retried with that UUID on transport
errors or 5xx answers, which is the resend behaviour of the mobile app.
"""

from __future__ import annotations

import hashlib
import random
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from loadgen.client import (
    ApiError,
    GatewayClient,
    RetryableError,
    body_json,
    checked,
    error_code,
)
from loadgen.media import make_png
from loadgen.stats import Comparison, compare_entries, latency_percentiles
from loadgen.totp import generate_code

TEXT_BODIES = (
    "A light rain is falling and the path is empty.",
    "Sitting by the pond, listening to the ducks.",
    "Walked here after lunch and stayed for twenty minutes.",
    "The benches in the shade are all taken today.",
    "Came to read before the day gets busy.",
    "The flowers near the greenhouse are open now.",
    "Passing through on the way to the bus and stopped to look.",
    "The playground is full and the café is closed.",
)

RETRYABLE_ENTRY_CODES = frozenset({"media_not_uploaded", "media_object_not_found"})


def log(message: str) -> None:
    print(f"loadgen: {message}", file=sys.stderr, flush=True)


class LoadgenError(RuntimeError):
    """The run could not be prepared (credentials, study, participants)."""


@dataclass(frozen=True)
class RunConfig:
    base: str
    second_base: str | None
    participants: int
    minutes: float
    rate: float
    media_ratio: float
    retries: int
    seed: int
    timeout: float
    media_timeout: float
    admin_email: str
    admin_password: str
    admin_totp_secret: str | None


@dataclass(frozen=True)
class Participant:
    index: int
    alias: str
    token: str


@dataclass(frozen=True)
class SendResult:
    entry_id: str
    success: bool
    latency_ms: float
    retries: int
    with_media: bool
    error: str | None = None


@dataclass(frozen=True)
class Summary:
    study_id: str
    researcher_email: str
    participants: int
    attempts: int
    sent: int
    retried: int
    comparison: Comparison
    latencies: list[float]
    media_total: int
    media_readable: int
    media_failures: list[str]
    send_failures: list[str]
    switches: int
    first_switch_ms: float | None

    @property
    def ok(self) -> bool:
        return self.comparison.ok and self.media_readable == self.media_total


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _call(
    client: GatewayClient,
    method: str,
    path: str,
    *,
    token: str | None = None,
    scheme: str = "Bearer",
    expected: tuple[int, ...] = (200,),
    json: Any | None = None,
) -> Any:
    """Call the API and return the decoded body, raising for unexpected answers."""
    url = client.api(path)
    response = client.request(method, url, token=token, scheme=scheme, json=json)
    return checked(response, expected, method, url)


def _login(
    client: GatewayClient,
    email: str,
    password: str,
    totp_secret: str | None = None,
) -> str:
    payload = {"email": email, "password": password}
    url = client.api("/auth/login")
    response = client.request("POST", url, json=payload)
    if response.status_code == 200:
        return response.json()["access_token"]

    code = error_code(response)
    secret = totp_secret
    if code == "totp_enrolment_required":
        enrolment = _call(
            client,
            "POST",
            "/auth/totp/enrolment",
            json={"email": email, "password": password},
        )
        secret = enrolment["secret"]
    elif code != "totp_required":
        raise ApiError("POST", url, response.status_code, code, response.text)

    if not secret:
        raise LoadgenError(
            "the administrator already uses TOTP; pass --admin-totp-secret for that account"
        )
    for attempt in range(3):
        result = client.request(
            "POST",
            url,
            json={**payload, "totp_code": generate_code(secret)},
        )
        if result.status_code == 200:
            return result.json()["access_token"]
        if (
            result.status_code == 401
            and error_code(result) == "invalid_credentials"
            and attempt < 2
        ):
            time.sleep(1.0)
            continue
        body = body_json(result)
        error = body.get("error") if isinstance(body, dict) else None
        message = error.get("message") if isinstance(error, dict) else result.text
        raise ApiError(
            "POST", url, result.status_code, error_code(result), message or ""
        )
    raise LoadgenError("could not sign in as the administrator")


def _retryable_api_error(exc: ApiError) -> bool:
    return exc.status in (409, 503) and exc.code in RETRYABLE_ENTRY_CODES


class LoadGenerator:
    def __init__(self, config: RunConfig) -> None:
        self.config = config
        self.client = GatewayClient(config.base, config.second_base, config.timeout)
        self.study_id = ""
        self.activity_id = ""
        self.run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]

    def execute(self) -> int:
        try:
            summary = self._run()
        except (ApiError, RetryableError, LoadgenError) as exc:
            print(f"loadgen: error: {exc}", file=sys.stderr, flush=True)
            return 2
        finally:
            self.client.close()
        self._print_summary(summary)
        return 0 if summary.ok else 1

    def _run(self) -> Summary:
        log(f"signing in to {self.client.base_url} as {self.config.admin_email}")
        admin_token = _login(
            self.client,
            self.config.admin_email,
            self.config.admin_password,
            self.config.admin_totp_secret,
        )

        researcher_email = f"loadgen-{self.run_id}@fieldnote.test"
        created = _call(
            self.client,
            "POST",
            "/admin/accounts",
            token=admin_token,
            expected=(201,),
            json={"email": researcher_email, "role": "researcher"},
        )
        researcher_password = created["temporary_password"]
        researcher_token = _login(self.client, researcher_email, researcher_password)
        log(f"researcher {researcher_email} signed in")

        self.study_id = self._create_study(researcher_token)
        self.activity_id = self._create_activity(researcher_token)
        _call(self.client, "POST", f"/studies/{self.study_id}/start", token=researcher_token)
        log(f"study {self.study_id} is running")

        participants = self._join_participants(researcher_token)
        log(f"{len(participants)} phones joined; sending for {self.config.minutes:g} min")
        results = self._send_entries(participants)
        log("sending finished; reading the entries back as the researcher")

        entries = self._list_entries(researcher_token)
        expected_ids = [result.entry_id for result in results]
        expected = set(expected_ids)
        entries = self._wait_for_media(researcher_token, entries, expected)
        comparison = compare_entries(expected_ids, [entry["id"] for entry in entries])
        media_total, media_readable, media_failures = self._verify_media(
            researcher_token, entries, expected
        )
        return Summary(
            study_id=self.study_id,
            researcher_email=researcher_email,
            participants=len(participants),
            attempts=len(results),
            sent=sum(1 for result in results if result.success),
            retried=sum(result.retries for result in results),
            comparison=comparison,
            latencies=[result.latency_ms for result in results if result.success],
            media_total=media_total,
            media_readable=media_readable,
            media_failures=media_failures,
            send_failures=[
                f"{result.entry_id}: {result.error}"
                for result in results
                if not result.success
            ],
            switches=self.client.switches,
            first_switch_ms=self.client.first_switch_ms,
        )

    # Setup -----------------------------------------------------------------------------------

    def _create_study(self, token: str) -> str:
        today = datetime.now(UTC).date().isoformat()
        study = _call(
            self.client,
            "POST",
            "/studies",
            token=token,
            expected=(201,),
            json={
                "title": f"Load test {self.run_id}",
                "description": "Entries generated by tools/loadgen.",
                "starts_on": today,
                "ends_on": today,
                "timezone": "Europe/Lisbon",
                "max_prompts_per_day": 4,
                "max_prompts_per_slot": 2,
                "schedule_style": "varied",
            },
        )
        return study["id"]

    def _create_activity(self, token: str) -> str:
        activity = _call(
            self.client,
            "POST",
            f"/studies/{self.study_id}/activities",
            token=token,
            expected=(201,),
            json={
                "title": "Load entry",
                "instructions": "Send a text or a photo.",
                "entry_types": ["text", "photo"],
                "prompts_per_day": 1,
                "window_start": "00:00:00",
                "window_end": "23:59:59",
                "min_gap_minutes": 0,
                "capture_location": False,
                "allow_free_entries": True,
                "max_free_entries_per_day": None,
                "expected_minutes": 1,
            },
        )
        return activity["id"]

    def _join_participants(self, researcher_token: str) -> list[Participant]:
        participants: list[Participant] = []
        for index in range(self.config.participants):
            alias = f"load-{index:03d}"
            added = _call(
                self.client,
                "POST",
                f"/studies/{self.study_id}/participants",
                token=researcher_token,
                expected=(201,),
                json={"alias": alias},
            )
            code = added["invite_code"]["code"]
            android_id = f"loadgen-{self.run_id}-{index:03d}"
            lookup = _call(
                self.client,
                "POST",
                "/participation/invitations/lookup",
                json={"code": code, "android_id": android_id},
            )
            accepted = _call(
                self.client,
                "POST",
                "/participation/invitations/accept",
                json={
                    "code": code,
                    "android_id": android_id,
                    "locale": "pt",
                    "consent_version": lookup["consent_version"],
                    "answers": [],
                },
            )
            if accepted.get("outcome") not in {
                "joined",
                "returned",
                "already_participating",
            }:
                raise LoadgenError(f"participant {alias} did not join: {accepted.get('outcome')}")
            device_token = accepted.get("device_token")
            if not device_token:
                raise LoadgenError(f"participant {alias} did not receive a device token")
            participants.append(Participant(index, alias, device_token))
        return participants

    # Sending ---------------------------------------------------------------------------------

    def _send_entries(self, participants: list[Participant]) -> list[SendResult]:
        interval = 60.0 / self.config.rate
        duration = self.config.minutes * 60.0
        start = time.monotonic() + 0.1
        results: list[SendResult] = []
        lock = threading.Lock()

        def worker(participant: Participant) -> None:
            rng = random.Random(f"{self.config.seed}:{participant.index}")
            sequence = 0
            scheduled = start + rng.uniform(0.0, min(interval, 5.0))
            local: list[SendResult] = []
            while scheduled < start + duration:
                delay = scheduled - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                sequence += 1
                local.append(self._send_one(participant, sequence))
                scheduled = max(scheduled + interval, time.monotonic())
            with lock:
                results.extend(local)

        with ThreadPoolExecutor(max_workers=len(participants)) as pool:
            list(pool.map(worker, participants))
        return results

    def _send_one(self, participant: Participant, sequence: int) -> SendResult:
        rng = random.Random(f"{self.config.seed}:{participant.index}:{sequence}")
        entry_id = str(uuid.uuid4())
        with_media = rng.random() < self.config.media_ratio
        image = make_png(rng.getrandbits(32)) if with_media else None
        body = TEXT_BODIES[(participant.index + sequence) % len(TEXT_BODIES)]
        payload: dict[str, Any] = {
            "id": entry_id,
            "activity_id": self.activity_id,
            "entry_type": "photo" if with_media else "text",
            "content_sha256": _sha256(image if with_media else body.encode("utf-8")),
            "recorded_at": datetime.now(UTC).isoformat(),
        }
        if not with_media:
            payload["body"] = body

        started = time.monotonic()
        retries = 0
        media_id: str | None = None
        while True:
            try:
                if with_media and media_id is None:
                    assert image is not None
                    media_id = self._upload(participant, entry_id, image)
                request_body = dict(payload)
                if with_media:
                    request_body["media_object_ids"] = [media_id]
                url = self.client.api("/entries")
                response = self.client.request(
                    "POST",
                    url,
                    token=participant.token,
                    scheme="Device",
                    json=request_body,
                )
                checked(response, (200,), "POST", url)
                return SendResult(
                    entry_id=entry_id,
                    success=True,
                    latency_ms=(time.monotonic() - started) * 1000.0,
                    retries=retries,
                    with_media=with_media,
                )
            except (RetryableError, ApiError) as exc:
                if isinstance(exc, ApiError) and not _retryable_api_error(exc):
                    return SendResult(
                        entry_id=entry_id,
                        success=False,
                        latency_ms=(time.monotonic() - started) * 1000.0,
                        retries=retries,
                        with_media=with_media,
                        error=str(exc),
                    )
                retries += 1
                if retries > self.config.retries:
                    return SendResult(
                        entry_id=entry_id,
                        success=False,
                        latency_ms=(time.monotonic() - started) * 1000.0,
                        retries=retries,
                        with_media=with_media,
                        error=str(exc),
                    )
                media_id = None
                time.sleep(min(0.5 * (2 ** (retries - 1)), 5.0))

    def _upload(self, participant: Participant, entry_id: str, payload: bytes) -> str:
        ticket = _call(
            self.client,
            "POST",
            "/media/upload-url",
            token=participant.token,
            scheme="Device",
            expected=(201,),
            json={
                "entry_id": entry_id,
                "mime_type": "image/png",
                "size_bytes": len(payload),
                "sha256": _sha256(payload),
            },
        )
        target, host = self.client.media_target(ticket["upload_url"])
        response = self.client.request(
            "PUT",
            target,
            headers={
                "Host": host,
                "Content-Type": "image/png",
                "Content-Length": str(len(payload)),
            },
            content=payload,
        )
        if response.status_code not in (200, 204):
            raise ApiError("PUT", target, response.status_code, None, response.text[:200])
        return ticket["media_object_id"]

    # Verification ----------------------------------------------------------------------------

    def _list_entries(self, token: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            params: dict[str, Any] = {"limit": 200}
            if cursor:
                params["cursor"] = cursor
            page = _call(
                self.client,
                "GET",
                f"/studies/{self.study_id}/entries?{urlencode(params)}",
                token=token,
            )
            items.extend(page["items"])
            cursor = page.get("next_cursor")
            if not cursor:
                return items

    def _wait_for_media(
        self, token: str, entries: list[dict[str, Any]], expected_ids: set[str]
    ) -> list[dict[str, Any]]:
        """Wait until the media worker has processed or failed every attached image.

        The API only signs a download URL once processing succeeded, so reading the files back
        before that would report every image as unreadable.
        """
        if self.config.media_timeout <= 0:
            return entries
        deadline = time.monotonic() + self.config.media_timeout
        while True:
            pending = sum(
                1
                for entry in entries
                if entry["id"] in expected_ids
                for media in entry.get("media", [])
                if media.get("status") not in {"processed", "failed"}
            )
            if pending == 0:
                return entries
            if time.monotonic() >= deadline:
                log(f"{pending} media files are still not processed after "
                    f"{self.config.media_timeout:g}s")
                return entries
            time.sleep(2.0)
            entries = self._list_entries(token)

    def _verify_media(
        self, token: str, entries: list[dict[str, Any]], expected_ids: set[str]
    ) -> tuple[int, int, list[str]]:
        total = 0
        readable = 0
        failures: list[str] = []
        for entry in entries:
            if entry["id"] not in expected_ids:
                continue
            media = entry.get("media", [])
            if not media:
                continue
            unresolvable = [item for item in media if item.get("status") != "processed"]
            if unresolvable:
                total += len(media)
                failures.extend(
                    f"{item.get('id')}: status {item.get('status')}" for item in unresolvable
                )
                continue
            detail = _call(
                self.client,
                "GET",
                f"/studies/{self.study_id}/entries/{entry['id']}",
                token=token,
            )
            urls = {item["id"]: item.get("url") for item in detail.get("media", [])}
            for item in media:
                total += 1
                url = urls.get(item["id"])
                if url and self._download(url):
                    readable += 1
                else:
                    failures.append(f"{item['id']}: not readable")
        return total, readable, failures

    def _download(self, signed_url: str) -> bool:
        for attempt in range(3):
            target, host = self.client.media_target(signed_url)
            try:
                response = self.client.request("GET", target, headers={"Host": host})
            except RetryableError:
                response = None
            if response is not None and response.status_code == 200 and response.content:
                return True
            if attempt < 2:
                time.sleep(0.5)
        return False

    # Report ----------------------------------------------------------------------------------

    def _print_summary(self, summary: Summary) -> None:
        percentiles = latency_percentiles(summary.latencies)
        print(f"study: {summary.study_id}")
        print(f"researcher: {summary.researcher_email}")
        print(f"participants: {summary.participants}")
        print(f"attempts: {summary.attempts}")
        print(f"sent: {summary.sent}")
        print(f"confirmed: {summary.comparison.confirmed}")
        print(f"retried: {summary.retried}")
        print(f"duplicates: {summary.comparison.duplicates}")
        print(f"losses: {summary.comparison.losses}")
        print(f"unexpected: {summary.comparison.unexpected}")
        print(f"latency p50: {percentiles['p50']:.1f} ms")
        print(f"latency p90: {percentiles['p90']:.1f} ms")
        print(f"latency p99: {percentiles['p99']:.1f} ms")
        print(f"media files: {summary.media_readable}/{summary.media_total} readable")
        print(f"failed sends: {len(summary.send_failures)}")
        print(f"gateway switches: {summary.switches}")
        if summary.first_switch_ms is None:
            print("first switch: none")
        else:
            print(f"first switch: {summary.first_switch_ms:.1f} ms")
        for failure in summary.send_failures:
            log(f"send failure: {failure}")
        for failure in summary.media_failures:
            log(f"media failure: {failure}")
        print("LOADGEN PASS" if summary.ok else "LOADGEN FAIL", flush=True)


__all__ = ["LoadGenerator", "RunConfig"]
