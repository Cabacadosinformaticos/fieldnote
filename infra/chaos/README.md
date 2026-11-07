# Failure-injection scripts

These scripts run the demonstration scenarios of the
[fault model](../../Fieldnote/04_Documentacao_Tecnica/fault-model.md) against the
three-node cluster profile in `infra/deploy/compose.cluster.yaml`. Each script
prints the state before the failure, injects it, measures the expected behaviour,
restores the service, waits until the cluster is healthy again, and prints
`PASS` or `FAIL` with the measured numbers.

They use the published ports (`127.0.0.1:8090` and `127.0.0.1:8092`) and
`docker`/`docker compose`; the entry-load scenarios also run the load generator
in `tools/loadgen`, and scenario 8 drives the phone with `adb`. Everything else
is observed from inside the containers. From the Windows host the scripts always
use `127.0.0.1`, never `localhost`.

## Before running

The cluster is a separate Compose project (`fieldnote-cluster`) and must be
healthy:

```sh
docker compose -f infra/deploy/compose.cluster.yaml --profile cluster up -d --build --wait
docker compose -f infra/deploy/compose.cluster.yaml exec -T pg1 patronictl list
```

Requirements on the host: `bash`, `docker` with Compose v2, `python3` (or
`python`) for the HTTP, JSON and database probes, and `uv` for scenarios 5 and
10 (they run the load generator). Scenario 8 additionally needs `adb` and a
running Android emulator (or device). On Windows use Git Bash; the scripts avoid
container-side absolute paths, which Git Bash would rewrite into
`C:/Program Files/Git/...` before Docker sees them.

## Scenarios

| Fault model # | Scenario | Script | Runs without a phone |
|---|---|---|---|
| 1 | Kill an API container | `fs1-kill-api.sh` | yes |
| 2 | Stop a whole logical node, start it later | `fs2-stop-node.sh` | yes |
| 3 | Kill the database primary | `fs3-kill-primary.sh` | yes |
| 4 | Kill the synchronous database replica | `fs4-kill-sync-replica.sh` | yes |
| 5 | Kill an object storage node during media uploads | `fs5-kill-storage-node.sh` | yes |
| 6 | Kill a broker node | `fs6-kill-broker.sh` | yes |
| 7 | Disconnect a node from the `cluster` network | `fs7-partition-node.sh` | yes |
| 8 | Phone in airplane mode during 3 entries | `fs8-airplane-mode.sh` | no, needs the phone and a researcher token |
| 9 | Restore the latest encrypted backup | `fs9-restore-backup.sh` | yes |
| 10 | Stop gateway 1 while clients are in use | `fs10-stop-gateway.sh` | yes |
| 11 | Kill the active scheduler replica | `fs11-kill-scheduler.sh` | yes |

Scenario 9 (restoring the latest encrypted backup) runs against the **dev**
Compose project (`fieldnote`), not the cluster: it writes an on-demand backup,
starts its own empty PostgreSQL and Garage in the separate `fieldnote-fs9`
project, restores into them and removes them again. Scenarios 5 and 10 start the
load generator; scenario 8 needs the emulator, the EAS-built app installed on
it, and a researcher token for the study.

## Running

From the repository root:

```sh
bash infra/chaos/fs1-kill-api.sh [api1|api2|api3]
bash infra/chaos/fs2-stop-node.sh [node1|node2|node3]
bash infra/chaos/fs3-kill-primary.sh
bash infra/chaos/fs4-kill-sync-replica.sh
bash infra/chaos/fs5-kill-storage-node.sh [garage1|garage2|garage3]
bash infra/chaos/fs6-kill-broker.sh [rabbitmq1|rabbitmq2|rabbitmq3]
bash infra/chaos/fs7-partition-node.sh [node1|node2|node3]
bash infra/chaos/fs10-stop-gateway.sh
bash infra/chaos/fs11-kill-scheduler.sh
```

Scenario 8 needs a study and a researcher token, and it waits for a person at
the phone:

```sh
FIELDNOTE_RESEARCHER_TOKEN="$TOKEN" \
  bash infra/chaos/fs8-airplane-mode.sh <study_id> [--auto] [--delay 45]
```

`--auto` replaces the "press Enter" prompt with a fixed delay. It does not
create entries, so it still fails unless 3 entries were recorded during the
offline window.

Scenario 10 sends text entries only: the cluster API's S3 endpoint is
`http://traefik1:8080`, so an entry that carries media cannot be created on any
API replica while gateway 1 is down. Scenario 5 covers media uploads while a
storage node is lost.

Scenario 9 needs the dev stack running and the backup key file
(`infra/deploy/secrets/backup.key`, 32 bytes, gitignored). It builds the
`backup` image, starts the dev `backup` service if needed, and uses
`127.0.0.1:55432`, `127.0.0.1:13900` and `127.0.0.1:13903` for the throwaway
stack; override them with `FS9_PG_PORT`, `FS9_GARAGE_S3_PORT` and
`FS9_GARAGE_ADMIN_PORT` if they are taken. The throwaway project and its
volumes are removed from an `EXIT`/`INT`/`TERM` trap, also on failure, and the
dev stack is never stopped:

```sh
bash infra/chaos/fs9-restore-backup.sh
```

`fs2` and `fs7` default to a node that holds neither the Patroni leader nor the
synchronous standby, so they test the loss of a node and not a database
failover. Passing a node explicitly overrides that choice; a failover may then
also happen and the measured numbers will include it.

Every script returns `0` on `PASS` and `1` on `FAIL`, so they chain:

```sh
bash infra/chaos/fs3-kill-primary.sh && bash infra/chaos/fs2-stop-node.sh
```

A `restore()` function runs from an `EXIT`/`INT`/`TERM` trap. An interrupted
script therefore also starts the containers it stopped, reconnects the network
it disconnected, and restores the Docker restart policy changed by the crash
helper. Scenario 8 additionally turns Wi-Fi and data back on if it exits early.

## Load generator

`tools/loadgen` is a small `uv` project used by scenarios 5 and 10 (and runnable
on its own). It signs in as an administrator, creates a researcher account and a
running study, joins N simulated phones, and has each phone send entries with a
generated image for part of them. Every entry has its own client UUID, and a
network error or a 5xx response is retried with the same UUID.

```sh
cd tools/loadgen
uv run loadgen --base http://127.0.0.1:8090 --second-base http://127.0.0.1:8092 \
  --participants 30 --minutes 2 --rate 1 \
  --admin-email loadgen@example.test --admin-password '...'
```

The administrator is required because the API only lets an administrator create
the researcher account. A fresh account can enrol its TOTP secret on first
login; for an account that is already enrolled, pass
`--admin-totp-secret` (or set `FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET`). The
scenarios create a fresh `loadgen-fs5-…@fieldnote.test` /
`loadgen-fs10-…@fieldnote.test` account per run, so they need no setup.

The researcher account is created without a password: the generator reads the
single-use welcome link from the cluster's Mailpit (`127.0.0.1:8026`) and follows
it. Pass `--mailpit-url` (or set `FIELDNOTE_LOADGEN_MAILPIT_URL`) when Mailpit is
elsewhere; the generator refuses a host that is not the local machine.

The report prints `sent`, `confirmed`, `retried`, `duplicates` and `losses`
(the latter compared with the researcher's `GET /studies/{id}/entries`), the
latency p50/p90/p99, how many uploaded files are readable, and how often and how
fast the client switched to `--second-base`. It exits non-zero on a lost or
duplicated entry or an unreadable file. Other options: `--media-ratio`,
`--retries`, `--seed`, `--timeout`, `--media-timeout` and
`--admin-password-stdin`. Tests and lint:

```sh
cd tools/loadgen && uv run ruff check . && uv run pytest -q
```

## What each script prints

Common lines, from `lib.sh`:

- `state before:` the Patroni table plus the member counts of every cluster and
  the HTTP status of both gateways.
- `measured:` the numbers the fault model states: time to a new leader or sync
  standby, time until the surviving clusters reach 2 of 3 members, gateway
  health samples, time to full recovery, and whether an API can open a database
  connection.
- `PASS …` or `FAIL …`, followed by the state after recovery.

Specific measurements:

| Script | Measured |
|---|---|
| `fs1` | milliseconds until each gateway is continuously healthy again, until the killed API is healthy after the explicit start, until all 3 APIs are healthy |
| `fs2` | milliseconds until the node's containers are down, until Patroni/RabbitMQ/Garage show 2 of 3 members, and until all 3 rejoined after the restart |
| `fs3` | milliseconds until a leader other than the killed one appears; failed gateway samples during the pause; time until the old primary is streaming again |
| `fs4` | milliseconds until Patroni gives the sync role to the other replica; failed gateway samples; time until 3 members are back |
| `fs5` | milliseconds until Garage drops to 2 of 3 healthy nodes; the load generator's entries sent/confirmed, losses, duplicates and readable files; time until the killed node rejoins |
| `fs6` | milliseconds until the running broker set is 2, whether there is any partition, time until 3 brokers are running again |
| `fs7` | milliseconds until the connected pair shows 2 of 3 members, whether the isolated API can reach PostgreSQL, time until the node rejoins after reconnection |
| `fs8` | entries before and after, the 3 new entry ids, and how long the queued entries took to appear after the network returned |
| `fs9` | the archive name, source/backup/restored entry and media counts (participants with a pending erasure excluded), and whether those participants are absent from the restore |
| `fs10` | milliseconds until gateway 1 stops answering; load-generator losses/duplicates, number of gateway switches and the first switch time; time until gateway 1 is continuously healthy after the restart |
| `fs11` | which replica held the lease, milliseconds until the standby holds a live lease, and whether both replicas run again |

Timing targets come from `fault-model.md`: API replica under 5 s (traffic
continuity), database primary up to 45 s, synchronous replica a few seconds
(member reassignment), gateway switch under 5 s, scheduler takeover under 20 s
(15 s lease plus one 5 s tick). The scripts use those numbers in their
assertions.

## Deliberate simplifications in this block

- **Entry load is opt-in.** Scenarios 5, 8 and 10 exercise entries; the older
  scenarios still only use health checks and `pg_isready` (plus the API's own
  database probe) and say `entries lost: not measured`. Running the load
  generator against every scenario would make each run much slower and would
  need an administrator account each time.
- **`/health` is still a stub.** The API's `/api/v1/health` and
  `/api/v1/health/ready` endpoints currently return 200 without touching
  PostgreSQL or RabbitMQ. The fault model expects them to fail while the
  database has no primary or while a replica is isolated; that is not true yet.
  The scripts therefore also run `pg_isready` and a real `psycopg` `select 1`
  from an API container, and `fs7` proves the partition with that direct
  database probe. The gateway samples are still printed, so the divergence is
  visible in the output.
- **Crash helper.** For the primary, sync replica and broker, `crash_stop`
  sends `SIGKILL` and temporarily sets the container's restart policy to `no`,
  so the failure lasts long enough for Patroni/RabbitMQ to react. `crash_start`
  restores `unless-stopped` and starts the container. Note that Docker does not
  apply a restart policy to a container stopped with `docker kill` (it treats it
  as a manual stop), so every script starts the container again after measuring;
  the manual start is the recovery action, not an automatic Docker restart.
- **Process crash versus `docker kill`.** The fault model says a killed
  container is restarted by Docker. With the current Compose configuration a
  manual `docker kill` stays down, as observed on this host. The scripts
  therefore measure the failover, then start the container explicitly. A crash
  of the process itself (exit without `docker kill`) is still covered by
  `restart: unless-stopped`.
- **Load and data are not changed.** No entries are written and no data is
  modified; the only state changes are container and network state, restored
  before the script exits.
