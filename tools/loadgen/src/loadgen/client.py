"""HTTP access through the active gateway, with the second gateway as a fallback.

The client keeps a single base URL. When a request cannot reach it, or the gateway answers 5xx,
the client switches to the fallback for every later request and records how long the failed
request took, which is the client-side measure of the gateway failover.
"""

from __future__ import annotations

import threading
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

API_ROOT = "/api/v1"


class ApiError(RuntimeError):
    """The API refused a request with a 4xx answer."""

    def __init__(self, method: str, url: str, status: int, code: str | None, message: str) -> None:
        super().__init__(f"{method} {url} answered HTTP {status}: {message}")
        self.status = status
        self.code = code
        self.body = message


class RetryableError(RuntimeError):
    """A transport error or a 5xx: the caller retries the same logical operation."""


def normalise_base(value: str) -> str:
    cleaned = value.strip().rstrip("/")
    # IPv6 first on the Windows host reaches nothing because Docker publishes IPv4 only.
    if "//localhost" in cleaned:
        cleaned = cleaned.replace("//localhost", "//127.0.0.1")
    return cleaned


def body_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None


def error_code(response: httpx.Response) -> str | None:
    payload = body_json(response)
    error = payload.get("error") if isinstance(payload, dict) else None
    return error.get("code") if isinstance(error, dict) else None


def checked(response: httpx.Response, expected: tuple[int, ...], method: str, url: str) -> Any:
    """Return the JSON body of a successful call or raise the matching load generator error."""
    if response.status_code in expected:
        return body_json(response) if response.status_code != 204 else None
    payload = body_json(response)
    error = payload.get("error") if isinstance(payload, dict) else None
    message = error.get("message") if isinstance(error, dict) else response.text
    raise ApiError(method, url, response.status_code, error_code(response), message or "")


class GatewayClient:
    def __init__(self, base: str, second_base: str | None, timeout: float) -> None:
        self._bases = [normalise_base(base)]
        if second_base:
            fallback = normalise_base(second_base)
            if fallback != self._bases[0]:
                self._bases.append(fallback)
        self._active = 0
        self._lock = threading.Lock()
        self._client = httpx.Client(
            timeout=httpx.Timeout(timeout, connect=min(timeout, 10.0)),
            follow_redirects=False,
        )
        self.switches = 0
        self.first_switch_ms: float | None = None

    def close(self) -> None:
        self._client.close()

    @property
    def base_url(self) -> str:
        with self._lock:
            return self._bases[self._active]

    def api(self, path: str) -> str:
        return f"{self.base_url}{API_ROOT}{path}"

    def media_target(self, signed_url: str) -> tuple[str, str]:
        """Return the URL to call and the Host header the signature covers.

        The signed URL names the origin the phones use (``10.0.2.2`` or ``127.0.0.1:8080``).
        From the host we connect to the active gateway and keep the signed Host header, so the
        S3 signature stays valid while the physical gateway can be the fallback one.
        """
        signed = urlsplit(signed_url)
        base = urlsplit(self.base_url)
        port = base.port or (443 if base.scheme == "https" else 80)
        target = f"{base.scheme}://{base.hostname}:{port}{signed.path}"
        if signed.query:
            target = f"{target}?{signed.query}"
        return target, signed.netloc

    def request(
        self,
        method: str,
        url: str,
        *,
        token: str | None = None,
        scheme: str = "Bearer",
        json: Any | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        request_headers = dict(headers or {})
        if token is not None:
            request_headers["Authorization"] = f"{scheme} {token}"
        if not url.startswith("http"):
            url = f"{self.base_url}{url}"
        started = time.monotonic()
        try:
            response = self._client.request(
                method, url, headers=request_headers, json=json, content=content
            )
        except httpx.HTTPError as exc:
            self._failover(started)
            raise RetryableError(f"{method} {url}: {exc}") from exc
        if response.status_code >= 500:
            self._failover(started)
            raise RetryableError(f"{method} {url}: HTTP {response.status_code}")
        return response

    def _failover(self, started: float) -> None:
        with self._lock:
            if self._active + 1 >= len(self._bases):
                return
            self._active += 1
            self.switches += 1
            if self.first_switch_ms is None:
                self.first_switch_ms = (time.monotonic() - started) * 1000.0


__all__ = [
    "API_ROOT",
    "ApiError",
    "GatewayClient",
    "RetryableError",
    "checked",
    "error_code",
    "normalise_base",
]
