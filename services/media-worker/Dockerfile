FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.13 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 fieldnote

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY media_worker ./media_worker

RUN uv sync --locked --no-dev && chown -R fieldnote:fieldnote /app

USER fieldnote

CMD ["python", "-m", "media_worker.main"]
