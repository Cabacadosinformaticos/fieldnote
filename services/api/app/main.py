from http import HTTPStatus

import pika
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

from app.config import settings
from app.db import engine
from app.routers import discover_routers

API_PREFIX = "/api/v1"

app = FastAPI(title="Fieldnote API", version="0.1.0")
router = APIRouter(prefix=API_PREFIX)


def _error_code(status_code: int) -> str:
    try:
        phrase = HTTPStatus(status_code).phrase
    except ValueError:
        return "http_error"
    return phrase.lower().replace(" ", "_").replace("'", "")


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
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
    parameters = pika.URLParameters(settings.rabbitmq_url)
    parameters.socket_timeout = 2
    parameters.blocked_connection_timeout = 2
    parameters.connection_attempts = 1
    try:
        pika.BlockingConnection(parameters).close()
    except Exception:
        return False
    return True


app.include_router(router)
for module_router in discover_routers():
    app.include_router(module_router, prefix=API_PREFIX)
