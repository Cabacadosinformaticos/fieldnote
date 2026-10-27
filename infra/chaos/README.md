# Failure-injection scripts

These scripts run the demonstration scenarios of the
[fault model](../../Fieldnote/04_Documentacao_Tecnica/fault-model.md) against the
three-node cluster profile in `infra/deploy/compose.cluster.yaml`. Each script
prints the state before the failure, injects it, measures the expected behaviour,
restores the service, waits until the cluster is healthy again, and prints
`PASS` or `FAIL` with the measured numbers.

They only use the published ports (`127.0.0.1:8090` and `127.0.0.1:8092`) and
`docker`/`docker compose`; everything else is observed from inside the
containers. From the Windows host the scripts always use `127.0.0.1`, never
`localhost`.

## Before running

The cluster is a separate Compose project (`fieldnote-cluster`) and must be
healthy:

```sh
docker compose -f infra/deploy/compose.cluster.yaml --profile cluster up -d --build --wait
docker compose -f infra/deploy/compose.cluster.yaml exec -T pg1 patronictl list
```

Requirements on the host: `bash`, `docker` with Compose v2, and `python3` (or
`python`) for the HTTP, JSON and database probes. On Windows use Git Bash; the
scripts avoid container-side absolute paths, which Git Bash would rewrite into
`C:/Program Files/Git/...` before Docker sees them.

## Scenarios

| Fault model # | Scenario | Script | Runs without a phone |
|---|---|---|---|
| 1 | Kill an API container | `fs1-kill-api.sh` | yes |
| 2 | Stop a whole logical node, start it later | `fs2-stop-node.sh` | yes |
| 3 | Kill the database primary | `fs3-kill-primary.sh` | yes |
| 4 | Kill the synchronous database replica | `fs4-kill-sync-replica.sh` | yes |
| 5 | Kill an object storage node during a video upload | not scripted here | no, needs an upload |
| 6 | Kill a broker node | `fs6-kill-broker.sh` | yes |
| 7 | Disconnect a node from the `cluster` network | `fs7-partition-node.sh` | yes |
| 8 | Phone in airplane mode during 3 entries | not scripted here | no, needs the phone |
| 9 | Restore the latest encrypted backup | not scripted here | no, needs a backup and a clean stack |
| 10 | Stop gateway 1 while clients are in use | not scripted in this block | yes, but outside this block's scope |
| 11 | Kill the active scheduler replica | not scripted in this block | yes, but the scheduler replicas are not in the cluster Compose file yet |

Scenarios 5, 8 and 9 are the ones that need the phone, an upload or a backup;
their scripts belong to a later block. Scenario 10 is exercised indirectly by
scenario 2 when the chosen node hosts a gateway, and scenario 11 needs the
scheduler containers first.

## Running

From the repository root:

```sh
bash infra/chaos/fs1-kill-api.sh [api1|api2|api3]
bash infra/chaos/fs2-stop-node.sh [node1|node2|node3]
bash infra/chaos/fs3-kill-primary.sh
bash infra/chaos/fs4-kill-sync-replica.sh
bash infra/chaos/fs6-kill-broker.sh [rabbitmq1|rabbitmq2|rabbitmq3]
bash infra/chaos/fs7-partition-node.sh [node1|node2|node3]
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
helper.

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
| `fs6` | milliseconds until the running broker set is 2, whether there is any partition, time until 3 brokers are running again |
| `fs7` | milliseconds until the connected pair shows 2 of 3 members, whether the isolated API can reach PostgreSQL, time until the node rejoins after reconnection |

Timing targets come from `fault-model.md`: API replica under 5 s (traffic
continuity), database primary up to 45 s, synchronous replica a few seconds
(member reassignment). The scripts use those numbers in their assertions.

## Deliberate simplifications in this block

- **No entry load.** Health checks and `pg_isready` (plus the API's own
  database probe) are the only liveness checks here, as the block asks. Every
  script says `entries lost: not measured` / `events lost: not measured`. The
  load generator in a later block will exercise entries, duplicates and the
  outbox.
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
