# Fault model

Status: proposed, 29 September 2026. The recovery times are targets to be measured during the
failure tests, not measured values.

The guarantees below cover the failure of one logical node or of any container inside it. The
Docker host itself is outside them: see [single points of failure](#single-points-of-failure).

## Guarantees

| Question | Answer |
|---|---|
| Which components can fail | An API, scheduler or media worker container; a whole logical node; the database primary or a replica; a broker node; an object storage node; the link between one node and the other two; one of the two gateways; the phone's connection |
| Failure types considered | Crash-stop and crash-recovery of containers and logical nodes, and a partition of one node from the other two. Byzantine failures, packet loss and latency are out of scope |
| Simultaneous failures tolerated | One logical node out of three (f = 1). With two nodes down the server stops accepting writes, because no cluster has a quorum, and it never accepts inconsistent writes. The app keeps recording into its local queue and sends the entries when the quorum is back |
| Functions available after one failure | Receiving entries, the researcher dashboard, delivery of scheduled activities (push, or on app open if push fails) |
| How failures are detected | Traefik health checks on `/health`, Patroni leader keys with a TTL in etcd, the scheduler lease, RabbitMQ and Garage cluster membership, Prometheus alerts |
| How components recover | Docker restarts crashed containers, Patroni promotes the synchronous replica, the standby scheduler takes the lease, a returning node rejoins its clusters and resynchronises |
| Data that can be lost | No entry is lost once the API has confirmed it (recovery point objective of zero). The API confirms only after the synchronous commit has returned successfully, and the database waits for the synchronous replica rather than confirm on one node. The one documented exception, a cancelled commit wait, is the edge case row in [what can be lost or repeated](#what-can-be-lost-or-repeated); the API never confirms in that case |
| Consistency between replicas | Strict synchronous replication to one database replica, quorum writes in object storage and in the broker queues |

## Recovery time targets

| Component | Target | Basis |
|---|---|---|
| API replica | Under 5 s | Traefik health check every 2 s |
| Gateway | Under 5 s | The client switches to the other gateway after a failed request |
| Scheduler | Under 20 s | Lease of 15 s plus one renewal period |
| Database primary | Up to 45 s | Patroni defaults: `ttl` 30 s, `loop_wait` 10 s. To be tuned and measured |
| Synchronous replica | A few seconds of paused writes | Patroni assigns the synchronous role to the other replica |
| Broker node, storage node | No interruption expected | The remaining 2 members hold the quorum |

## What can be lost or repeated

| Situation | Effect | Handling |
|---|---|---|
| Entry in flight when an API replica fails | Not confirmed to the participant | Stays in the app queue and is resent with the same UUID |
| File uploaded, entry never confirmed | Object stays `pending` in storage | Deleted after 7 days |
| Event committed but not yet published | Delay, no loss | Stays in the outbox until the broker is back |
| Relay crashes after publishing, before marking | Event published twice | Consumers ignore event ids they have already processed |
| Scheduler leader cut off while sending | A notification may be sent twice, once by each scheduler | The leader stops sending as soon as a database call fails; the prompt row has a unique key and a status, so at most the notification in progress is repeated |
| Media processing fails repeatedly | The broker moves the job to a dead-letter queue after 5 attempts | The media object is marked `failed` and the dashboard offers a retry. The original file is kept |
| Commit wait cancelled before the synchronous replica acknowledges (documented by Patroni) | The entry may be written on the primary only, and lost if the primary then fails | The API never confirms such a write and sets no timeout that cancels the wait; the app resends with the same UUID, which is answered as a duplicate if the row survived or inserted again if it did not |
| App uninstalled with entries still queued | Those entries are lost | Declared limitation. The app shows how many entries are waiting to be sent |

## Single points of failure

| Element | Status | Mitigation |
|---|---|---|
| The Docker host (server VM or laptop), its Docker daemon, disk, power and Internet link | Out of scope, declared limitation | The stack starts with one command on another machine. A daily `pg_dump` and a copy of the object storage bucket are encrypted on the host, go to another machine and are kept for 7 days. A restore of the latest backup is tested (scenario 9) |
| Garage zones on one host | Declared limitation | Each logical node is its own zone in the Garage layout, so the 3 copies of a file land on 3 logical nodes and the loss of one node is tolerated. The 3 zones share one physical host, so Garage cannot protect against losing the host. The daily copy of the bucket on another machine is the only protection for that case |
| Tailscale coordination service | Out of scope | Existing connections keep working while it is down; new devices cannot join. Administration can also be done on the host itself |
| Monitoring (Prometheus, Grafana) | Not replicated, not needed to serve users | Its loss hides metrics during a demonstration but does not affect the service |
| Push notification service | Degradation accepted | The app fetches pending activities from the API when it opens |

## Demonstration scenarios

Each scenario is run by a script in `infra/chaos/` while a load generator sends entries. The
script records the time to detection, the time to recovery, failed requests and lost entries.
`docker kill` simulates a crash, after which Docker restarts the container; `docker stop` followed
later by `docker start` simulates a node that goes away and comes back.

| # | Injected failure | Expected result | Detection | Recovery |
|---|---|---|---|---|
| 1 | Kill an API container while entries are being sent | No entry lost. Interrupted requests are retried by the app without duplicates | Traefik health check | Traefik routes to the other 2 replicas, Docker restarts the container |
| 2 | Stop every container of one logical node, start them again later | The service keeps running with 2 of 3 members in every cluster | Health checks and cluster membership | Each service rejoins its cluster and catches up |
| 3 | Kill the database primary | The synchronous replica is promoted. No confirmed entry lost | Leader key expires in etcd | Patroni promotion, the API reconnects with its host list |
| 4 | Kill the synchronous database replica | Writes pause for a few seconds, then continue with the other replica as synchronous | Patroni sees the replica leave | Patroni reassigns the synchronous role |
| 5 | Kill an object storage node during a video upload | Upload completes, the file is readable | Garage cluster membership | Writes use the 2 remaining nodes, the node catches up on return |
| 6 | Kill a broker node while events are flowing | No event lost | RabbitMQ cluster membership | Quorum queues continue on 2 nodes |
| 7 | Disconnect one node from the `cluster` network | The isolated node stops serving requests. The other two keep accepting writes. On reconnection the node resynchronises | `/health` fails on the isolated API, leases and heartbeats time out | Rejoin and resynchronisation |
| 8 | Phone in airplane mode during 3 entries | The 3 entries arrive when the network is back, without duplicates | The app sees no connection | Queue flush with idempotent resends |
| 9 | Restore the latest encrypted backup on a clean stack | The database and the files of the backup day are back, and the counts of entries and files match | Not a failure detection; a planned restore drill | Decrypt with the off-host key, restore `pg_dump` and the bucket copy |
| 10 | Stop gateway 1 while the app and the dashboard are in use | Clients switch to gateway 2 in under 5 s; no entry lost | The client's request times out | The client retries on the second gateway address |
| 11 | Kill the active scheduler replica during the day | The standby takes the lease in under 20 s and sends the remaining prompts; at most the notification in progress is repeated | The lease is not renewed for 15 s | The standby continues from the plan stored in the database |
