from http import HTTPStatus
from pathlib import Path

import pika
from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

from app.config import settings
from app.db import engine
from app.routers import discover_routers
from app.security import origin

API_PREFIX = "/api/v1"

app = FastAPI(title="Fieldnote API", version="0.1.0")
router = APIRouter(prefix=API_PREFIX)


@app.middleware("http")
async def audit_origin(request: Request, call_next):
    token = origin.bind(request)
    try:
        return await call_next(request)
    finally:
        origin.reset(token)


def _error_code(status_code: int) -> str:
    try:
        phrase = HTTPStatus(status_code).phrase
    except ValueError:
        return "http_error"
    return phrase.lower().replace(" ", "_").replace("'", "")


def _dashboard_file(root: Path, path: str) -> Path | None:
    """Resolve a request path inside the dashboard directory, refusing traversal."""
    candidate = (root / path).resolve()
    if (candidate == root or root in candidate.parents) and candidate.is_file():
        return candidate
    return None


def _dashboard_response(path: str) -> Response | None:
    """The built dashboard for a non-API GET, or None when it is not available."""
    if path == "/api" or path.startswith("/api/"):
        # Never shadow the API: an unknown API path keeps the API's own 404.
        return None
    # Resolved, so a relative setting compares with the resolved file paths below.
    root = Path(settings.dashboard_dir).resolve()
    if not root.is_dir():
        return None
    if (relative := path.lstrip("/")) and (asset := _dashboard_file(root, relative)):
        return FileResponse(asset)
    index = root / "index.html"
    return FileResponse(index) if index.is_file() else None


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> Response:
    # An unmatched GET that is not under /api is a client-side route of the dashboard.
    if (
        exc.status_code == 404
        and request.method == "GET"
        and (page := _dashboard_response(request.url.path))
    ):
        return page
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": getattr(exc, "code", _error_code(exc.status_code)),
                "message": getattr(exc, "message", str(exc.detail)),
            }
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, _exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": "Request validation failed."}},
    )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def ready() -> JSONResponse:
    """Ready only when this replica reaches the database primary and the broker.

    The gateways route on this check, so a replica cut off from the cluster stops receiving
    requests, as the fault model expects.
    """
    checks = {"database": _database_ok(), "broker": _broker_ok()}
    ready_now = all(checks.values())
    return JSONResponse(
        status_code=200 if ready_now else 503,
        content={"status": "ok" if ready_now else "unavailable", "checks": checks},
    )


def _database_ok() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return False
    return True


def _broker_ok() -> bool:
    """Ready when any broker address of the cluster accepts a connection."""
    for address in settings.rabbitmq_url.split(","):
        url = address.strip()
        if not url:
            continue
        parameters = pika.URLParameters(url)
        parameters.socket_timeout = 2
        parameters.blocked_connection_timeout = 2
        parameters.connection_attempts = 1
        try:
            pika.BlockingConnection(parameters).close()
        except Exception:
            continue
        return True
    return False


app.include_router(router)
for module_router in discover_routers():
    app.include_router(module_router, prefix=API_PREFIX)
