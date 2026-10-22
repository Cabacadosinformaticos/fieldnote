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

These are the only published ports. PostgreSQL, etcd, RabbitMQ AMQP, Garage S3
and the Garage admin API are reachable only inside the project network.

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
```

| Variable | Used for |
|---|---|
| `RABBITMQ_ERLANG_COOKIE` | shared Erlang cookie that lets the three RabbitMQ nodes form one cluster |
| `PATRONI_SUPERUSER_PASSWORD` | password of the PostgreSQL `postgres` superuser on the Patroni nodes |
| `PATRONI_REPLICATION_PASSWORD` | password of the `replicator` role used for streaming replication |
| `PATRONI_RESTAPI_PASSWORD` | password of the Patroni REST API (`patroni` user) |
