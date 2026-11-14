FROM node:24-slim AS dashboard-build

WORKDIR /dashboard

# The dashboard context has no .dockerignore, so copy only what the build needs: host
# node_modules and a stale dist must not leak into the image.
COPY --from=dashboard package.json package-lock.json ./
RUN npm ci
COPY --from=dashboard index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY --from=dashboard src ./src
# Both typescript and typescript5 ship a tsc binary, and npm does not link them
# deterministically. The project's npm run build compiles with the TypeScript 5 one.
RUN ln -sf ../typescript5/bin/tsc node_modules/.bin/tsc && npm run build

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.13 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN useradd --create-home --uid 10001 fieldnote

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
COPY --from=dashboard-build /dashboard/dist ./dashboard

RUN uv sync --locked --no-dev && chown -R fieldnote:fieldnote /app

USER fieldnote

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
