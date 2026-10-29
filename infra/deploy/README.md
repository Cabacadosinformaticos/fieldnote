# Development deployment

Single-node development stack run with Docker Compose: Traefik, PostgreSQL,
RabbitMQ, Garage, Mailpit, the API, the outbox relay, the media worker, the
erasure job, the scheduler, the backup job, Prometheus and Grafana. Every
service is in the `dev` profile.

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
| Prometheus | http://127.0.0.1:9090 |
| Grafana | http://127.0.0.1:3000 |
| PostgreSQL | `127.0.0.1:5432`, user and database `fieldnote` |

`garage-init` is a one-shot service. It assigns the single-node layout, applies
it, creates the `media` bucket, imports the S3 key from `.env` and grants it
read/write access. It is idempotent, so restarting the stack is safe.

## Background services

These services run after `migrate` and are restarted by Docker if they exit.

| Service | What it does |
|---|---|
| `erasure-job` | runs `python -m app.erasure_job` every `ERASURE_JOB_INTERVAL_SECONDS` (default 300) to settle the erasures that are due |
| `scheduler` | runs `python -m scheduler.main`, which loops and holds the scheduler lease |
| `backup` | runs `python -m backup run` once at start and then every `BACKUP_INTERVAL_SECONDS` (default 86400) |

## Backups

`backup` writes one encrypted archive per run to the `backups` Garage bucket.
The archive contains a `pg_dump -Fc` of the database and a copy of every object
in the `media` bucket, packed in a tar stream and encrypted with AES-256-GCM in
1 MiB chunks with a random nonce per chunk. Archives older than
`BACKUP_RETENTION_DAYS` (default and maximum 7) are removed after each run.

The encryption key is 32 random bytes kept outside the stack. Compose mounts it
read-only as the `backup_key` secret at `/run/secrets/backup.key`; it never
enters the image or `.env`. Generate it once and keep a copy somewhere else,
because an archive cannot be read without it:

```sh
head -c 32 /dev/urandom > infra/deploy/secrets/backup.key
```

`infra/deploy/secrets/` and `*.key` are gitignored (`git status --ignored
infra/deploy/secrets` shows `!!`).

Participants whose erasure is pending (`erasure_scheduled`) are left out of the
dump together with their dependent rows, and their objects under
`entries/<participant id>/` are skipped. This keeps NFR-13 intact: restoring a
backup never brings back data that was on its way to erasure, and the 7-day
retention is never longer than the 7-day erasure window.

On-demand run and inspection:

```sh
docker compose -f infra/deploy/compose.yaml exec -T backup python -m backup run
docker compose -f infra/deploy/compose.yaml exec -T backup python -m backup stats
docker compose -f infra/deploy/compose.yaml exec -T backup \
  python -m backup download <archive-name> archive.fnb
docker compose -f infra/deploy/compose.yaml cp backup:/app/archive.fnb ./archive.fnb
```

`python -m backup restore <archive>` restores into an **empty** database: it
runs `pg_restore --no-owner --no-acl --exit-on-error`, uploads the bucket
objects with their content types and prints the entry, media-record and
bucket-object counts. Point `FIELDNOTE_DATABASE_URL` and the S3 variables at
the target stack; `infra/chaos/fs9-restore-backup.sh` does exactly that against
a clean throwaway PostgreSQL and Garage and checks the counts.

## Monitoring

Prometheus scrapes the API metrics endpoint, Traefik, RabbitMQ and Garage. In
the cluster profile it also scrapes the Patroni REST API. The targets are listed
at http://127.0.0.1:9090/api/v1/targets.

Grafana provisions its Prometheus data source and the `Fieldnote` dashboard
from `grafana/`. Anonymous access is read-only (Viewer); the administrator logs
in with `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`.

The API serves Prometheus metrics at `/api/v1/metrics` on port 8000. Traefik
does **not** forward that path: `traefik/dynamic*.yml` routes it to the built-in
`noop@internal` service, so it answers 418 from the public gateway and is only
reachable by Prometheus inside the Compose network.

The media worker does not expose metrics and is not scraped.

## Cluster

`compose.cluster.yaml` runs the stack from `architecture.md` as three logical
nodes on one Docker host. It is a separate Compose project (`fieldnote-cluster`)
with its own network and volumes, so it can run beside the dev stack.

### Start

```sh
docker compose -f compose.cluster.yaml --profile cluster up -d --build --wait
```

The `cluster` profile starts all three nodes. Each node also has its own
profile (`node1`, `node2`, `node3`), so a single node can be started alone.

### Stop

```sh
docker compose -f compose.cluster.yaml --profile cluster down
docker compose -f compose.cluster.yaml --profile cluster down -v   # delete data
```

### Stop and restart one node

```sh
docker compose -f compose.cluster.yaml stop etcd2 pg2 rabbitmq2 garage2 api2 traefik2
docker compose -f compose.cluster.yaml --profile node2 up -d --wait
```

After a restart, check that the node rejoined:

```sh
docker compose -f compose.cluster.yaml exec pg2 patronictl -c /etc/patroni.yml list
docker compose -f compose.cluster.yaml exec rabbitmq2 rabbitmqctl cluster_status
docker compose -f compose.cluster.yaml exec garage1 /garage status
```

### Ports

| Service | URL / port |
|---|---|
| Traefik gateway, node1 | http://127.0.0.1:8090 |
| Traefik gateway, node2 | http://127.0.0.1:8092 |
| API health (through either gateway) | http://127.0.0.1:8090/api/v1/health |
| Media, Garage path-style | http://127.0.0.1:8090/media/ |
| RabbitMQ management, node1 only | http://127.0.0.1:15673 |
| Prometheus, node3 | http://127.0.0.1:9091 |
| Grafana, node3 | http://127.0.0.1:3001 |

These are the only published ports. PostgreSQL, etcd, RabbitMQ AMQP, Garage S3
and the Garage admin API are reachable only inside the project network.

Prometheus and Grafana run on node 3 only and are not replicated. Losing them
hides the metrics during a demonstration but does not affect the service. The
scheduler runs two replicas, on nodes 1 and 2; the erasure job and the single
`backup1` replica run on node 1.

### Memory use

Measured with `docker stats --no-stream` on an idle cluster: about 1 GiB in
total. Per member: etcd ~25 MiB, PostgreSQL ~75-110 MiB, RabbitMQ ~130 MiB,
Garage ~5 MiB, API ~70 MiB, Traefik ~20 MiB. The dev stack adds about 290 MiB.

## New variables for .env.example

The cluster file gives each of these a default, so it starts without a `.env`.
Set real values for anything shared with a deployed cluster.

```sh
RABBITMQ_ERLANG_COOKIE=fieldnote-cluster-cookie-dev
PATRONI_SUPERUSER_PASSWORD=patroni-superuser-dev
PATRONI_REPLICATION_PASSWORD=patroni-replication-dev
PATRONI_RESTAPI_PASSWORD=patroni-restapi-dev
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=fieldnote-grafana-dev
```

| Variable | Default | Used for |
|---|---|---|
| `RABBITMQ_ERLANG_COOKIE` | `fieldnote-cluster-cookie-dev` | shared Erlang cookie that lets the three RabbitMQ nodes form one cluster |
| `PATRONI_SUPERUSER_PASSWORD` | `patroni-superuser-dev` | password of the PostgreSQL `postgres` superuser on the Patroni nodes |
| `PATRONI_REPLICATION_PASSWORD` | `patroni-replication-dev` | password of the `replicator` role used for streaming replication |
| `PATRONI_RESTAPI_PASSWORD` | `patroni-restapi-dev` | password of the Patroni REST API (`patroni` user) |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana administrator account |
| `GRAFANA_ADMIN_PASSWORD` | `fieldnote-grafana-dev` | Grafana administrator password; change it outside the lab |
| `PROMETHEUS_PORT` | `9091` | host port of Prometheus in the cluster profile (dev uses 9090) |
| `GRAFANA_PORT` | `3001` | host port of Grafana in the cluster profile (dev uses 3000) |
| `ERASURE_JOB_INTERVAL_SECONDS` | `300` | how often the erasure job runs |
| `BACKUP_BUCKET` | `backups` | Garage bucket that holds the encrypted archives |
| `BACKUP_RETENTION_DAYS` | `7` | days an archive is kept (1-7; 7 is the erasure window) |
| `BACKUP_INTERVAL_SECONDS` | `86400` | how often the backup service writes an archive |
