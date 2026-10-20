# Development deployment

Single-node development stack run with Docker Compose: Traefik, PostgreSQL,
RabbitMQ, Garage, Mailpit and the API. Every service is in the `dev` profile.

## Start

```sh
cp .env.example .env
docker compose --profile dev up -d --build
```

## Stop and reset

```sh
docker compose --profile dev down          # stop, keep volumes
docker compose --profile dev down -v       # stop and delete all data
```

## URLs and ports

| Service | URL / port |
|---|---|
| Traefik gateway | http://localhost:8080 |
| API health | http://localhost:8080/api/v1/health |
| Media (Garage, path-style) | http://localhost:8080/media/ |
| Traefik dashboard (dev only) | http://localhost:8081/dashboard/ |
| Mailpit UI | http://localhost:8025 |
| Mailpit SMTP | `mailpit:1025` on the `cluster` network |
| RabbitMQ management | http://localhost:15672 |
| PostgreSQL | `127.0.0.1:5432`, user and database `fieldnote` |

`garage-init` is a one-shot service. It assigns the single-node layout, applies
it, creates the `media` bucket, imports the S3 key from `.env` and grants it
read/write access. It is idempotent, so restarting the stack is safe.
