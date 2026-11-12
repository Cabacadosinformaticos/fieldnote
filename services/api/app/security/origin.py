"""Where an audit row came from: the client, the address and the browser.

The middleware in ``app.main`` binds the values for one request. A process that runs outside a
request (the erasure job, the outbox relay) binds its own client kind at start-up, so a row it
writes still records its origin. Nothing here is trusted for authorisation: the values only feed
the audit log.
"""

from contextvars import ContextVar, Token
from dataclasses import dataclass

from starlette.requests import Request

PORTAL = "portal"
APP_ANDROID = "app_android"
APP_IOS = "app_ios"
SCHEDULED_TASK = "scheduled_task"
AUTOMATIC_TASK = "automatic_task"

_APP_PATHS = ("/api/v1/participation", "/api/v1/account", "/api/v1/pool")
_APP_SCHEMES = frozenset({"device", "account"})

# Browsers in the order in which their token must be looked for, because Chrome and Edge also
# send "Safari/" in their user agent.
_BROWSERS = (
    (("Edg/", "EdgiOS/", "EdgA/"), "Edge"),
    (("Firefox/", "FxiOS/"), "Firefox"),
    (("Chrome/", "CriOS/"), "Chrome"),
    (("Safari/",), "Safari"),
)


@dataclass(frozen=True)
class RequestOrigin:
    client: str
    ip: str | None
    browser: str | None


_request_origin: ContextVar[RequestOrigin | None] = ContextVar("request_origin", default=None)
_process_client: ContextVar[str | None] = ContextVar("process_origin_client", default=None)


def bind(request: Request) -> Token[RequestOrigin | None]:
    """Record the origin of this request for the life of the request."""
    user_agent = request.headers.get("user-agent", "")
    return _request_origin.set(
        RequestOrigin(
            client=_client(request),
            ip=_address(request),
            browser=_browser(user_agent),
        )
    )


def reset(token: Token[RequestOrigin | None]) -> None:
    _request_origin.reset(token)


def current() -> RequestOrigin | None:
    return _request_origin.get()


def set_process_client(client: str) -> Token[str | None]:
    """Set the origin of the rows a process writes outside any request."""
    return _process_client.set(client)


def reset_process_client(token: Token[str | None]) -> None:
    _process_client.reset(token)


def process_client() -> str | None:
    return _process_client.get()


def _client(request: Request) -> str:
    scheme, _, _ = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() in _APP_SCHEMES or request.url.path.startswith(_APP_PATHS):
        return APP_IOS if _is_ios(request.headers.get("user-agent", "")) else APP_ANDROID
    return PORTAL


def _is_ios(user_agent: str) -> bool:
    lowered = user_agent.lower()
    return any(marker in lowered for marker in ("iphone", "ipad", "ios"))


def _address(request: Request) -> str | None:
    """The client address, taken from the first entry Traefik writes in X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client is not None else None


def _browser(user_agent: str) -> str | None:
    for markers, name in _BROWSERS:
        if any(marker in user_agent for marker in markers):
            return name
    return None
