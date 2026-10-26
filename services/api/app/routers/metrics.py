"""Prometheus metrics at ``/api/v1/metrics``.

The route is scraped directly by Prometheus on the internal network. Traefik does not forward
it: ``traefik/dynamic.yml`` sends the path to the internal ``noop`` service so it is never
reachable from the public gateway.

The request counter and histogram are fed by an ASGI middleware installed when this module is
discovered by ``app.main``. Entries, outbox backlog and database reachability are read from the
database on every scrape by a custom collector, so they stay correct without hacks in the
routers that write them.
"""

from __future__ import annotations

import time
from collections.abc import Iterator

from fastapi import APIRouter
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, Counter, Histogram, generate_latest
from prometheus_client.core import GaugeMetricFamily
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.db import SessionLocal
from app.models import Entry, OutboxEvent

METRICS_PATH = "/api/v1/metrics"

REQUEST_COUNT = Counter(
    "fieldnote_api_requests_total",
    "API requests served, by method, route and response status.",
    ["method", "route", "status"],
)
REQUEST_DURATION = Histogram(
    "fieldnote_api_request_duration_seconds",
    "API request latency in seconds, by method, route and response status.",
    ["method", "route", "status"],
)

router = APIRouter(tags=["monitoring"])


class MetricsMiddleware:
    """Count every HTTP request with its route template rather than its raw path."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") == METRICS_PATH:
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status = 500

        async def observe(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, observe)
        finally:
            route = scope.get("route")
            route_path = getattr(route, "path", None) or "unmatched"
            labels = {
                "method": scope.get("method", ""),
                "route": route_path,
                "status": str(status),
            }
            REQUEST_COUNT.labels(**labels).inc()
            REQUEST_DURATION.labels(**labels).observe(time.perf_counter() - started)


class DatabaseCollector:
    """Expose the rows the failure demonstration watches, read at scrape time."""

    def collect(self) -> Iterator[GaugeMetricFamily]:
        database_up = GaugeMetricFamily(
            "fieldnote_database_up", "1 when the API database answers a query, 0 otherwise."
        )
        entries = GaugeMetricFamily(
            "fieldnote_entries_created", "Entries currently stored in the database."
        )
        backlog = GaugeMetricFamily(
            "fieldnote_outbox_backlog", "Outbox events not yet published to RabbitMQ."
        )
        try:
            with SessionLocal() as session:
                session.execute(text("SELECT 1"))
                entry_count = session.scalar(select(func.count()).select_from(Entry)) or 0
                backlog_count = (
                    session.scalar(
                        select(func.count())
                        .select_from(OutboxEvent)
                        .where(OutboxEvent.published_at.is_(None))
                    )
                    or 0
                )
        except SQLAlchemyError:
            database_up.add_metric([], 0)
            yield database_up
            return

        database_up.add_metric([], 1)
        entries.add_metric([], entry_count)
        backlog.add_metric([], backlog_count)
        yield database_up
        yield entries
        yield backlog


REGISTRY.register(DatabaseCollector())


@router.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Installed at import time, before ``app.main`` builds its middleware stack. Importing here,
# after ``router`` exists, keeps the discovery import cycle safe in either import order.
from app.main import app as _app  # noqa: E402

_app.add_middleware(MetricsMiddleware)
