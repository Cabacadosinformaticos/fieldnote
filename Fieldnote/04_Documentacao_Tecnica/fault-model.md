# Fault model

Status: implemented and measured, 11 November 2026. The scenarios were run on the server on 9 November
2026 with the scripts in `infra/chaos/`: scenarios 1 to 7, 10 and 11 pass on the three-node cluster. Scenario 9 passed on the
development stack. Scenario 8 has not been run with a phone yet. The three logical nodes are container groups on one virtual
machine, so the tests show the behaviour of the clusters when a node's containers stop or its network is cut; they do not show
the loss of a physical machine.

The guarantees below cover the failure of one logical node or of any container inside it. The
Docker host itself is outside them: see [single points of failure](#single-points-of-failure).

## Guarantees

| Question | Answer |
|---|---|
| Which components can fail | An API, scheduler or media worker container; a whole logical node; the database primary or a replica; a broker node; an object storage node; the link between one node and the other two; one of the two gateways; the phone's connection |
| Failure types considered | Crash-stop and crash-recovery of containers and logical nodes, and a partition of one node from the other two. Byzantine failures, packet loss and latency are out of scope |
| Simultaneous failures tolerated | One logical node out of three (f = 1). With two nodes down the server stops accepting writes, because no cluster has a quorum, and it never accepts inconsistent writes. The app keeps recording into its local queue and sends the entries when the quorum is back |
| Functions available after one failure | Receiving entries, the researcher dashboard, delivery of scheduled activities (push, or on app open if push fails) |
| How failures are detected | Traefik health checks on `/api/v1/health/ready`, Patroni leader keys with a TTL in etcd, the scheduler lease, RabbitMQ and Garage cluster membership. Prometheus and Grafana show the metrics; no alert rules are defined |
| How components recover | Docker restarts crashed containers (`restart: unless-stopped`; a container stopped with `docker kill` counts as stopped by hand and stays down, so the scripts start it again), Patroni promotes the synchronous replica, the standby scheduler takes the lease, a returning node rejoins its clusters and resynchronises |
| Data that can be lost | When one logical node fails, no entry is lost once the API has confirmed it (recovery point objective of zero). The API confirms only after the synchronous commit has returned successfully, and the database waits for the synchronous replica rather than confirm on one node. The one documented exception, a cancelled commit wait, is the edge case row in [what can be lost or repeated](#what-can-be-lost-or-repeated); the API never confirms in that case. The loss of the host is the declared exception: data returns from the last daily backup, and entries made after it are lost. The zero was measured for two cases: 45 entries with photos sent while a Garage node was down (0 lost, 0 duplicated) and 120 entries sent while gateway 1 was down (0 lost, 0 duplicated) |
| Consistency between replicas | Strict synchronous replication to one database replica, quorum writes in object storage and in the broker queues |

## Recovery times

Targets come from the design; measured values come from the run on the server on 9 November 2026.

| Component | Target | Measured | Basis |
|---|---|---|---|
| API replica | Under 5 s | Both gateways answer again after 1.1 s and 1.7 s; all 3 APIs healthy 9.3 s after `api2` is started again | Traefik health check every 2 s |
| Gateway | Under 5 s | 0 of 120 entries lost while gateway 1 was stopped; gateway 1 answers again 1.9 s after the restart. The time of the first switch is not recorded in the table | The app switches to the other gateway after a failed request |
| Scheduler | Under 20 s | 15.2 s | Lease of 15 s plus one renewal period, with the database available |
| Database primary | Up to 45 s | 23.8 s until `pg3` leads; the old primary rejoined as a replica and the cluster was complete after 27 s | Patroni `ttl` 30 s, `loop_wait` 10 s. `/health/ready` needs the database primary, so the API and the dashboard do not answer during this pause |
| Synchronous replica | A few seconds of paused writes | New synchronous replica after 9.9 s, with 0 failed requests on both gateways | Patroni assigns the synchronous role to the other replica |
| Broker node, storage node | No interruption expected | RabbitMQ left the active set in 0.7 s and rejoined without a partition in 5.6 s. Garage was back at 3 of 3 nodes after 4.7 s, with 45 of 45 photo entries confirmed | The remaining 2 members hold the quorum. An upload connected to the failed storage node is retried with a new signed URL |
| Logical node | Services keep 2 of 3 members | The other two nodes kept leader and synchronous replica; the node joined every cluster again 9.3 s after it was restarted | Quorum of 2 in every cluster |
| Partitioned node | The pair keeps working | Same result; the node joined again 4.3 s after the network was reconnected | `cluster` network disconnected for the node |

## What can be lost or repeated

| Situation | Effect | Handling |
|---|---|---|
| Entry in flight when an API replica fails | Not confirmed to the participant | Stays in the app queue and is resent with the same UUID |
| File uploaded, entry never confirmed | Object stays `pending` in storage | Kept; the cleanup job that would delete it after 7 days is not implemented |
| Event committed but not yet published | Delay, no loss | Stays in the outbox until the broker is back |
| Relay crashes after publishing, before marking | Event published twice | Consumers ignore event ids they have already processed |
| Scheduler leader cut off while sending | A notification may be sent twice, once by each scheduler | The leader stops sending as soon as a database call fails; the prompt row has a unique key and a status, so at most the notification in progress is repeated |
| Media processing fails repeatedly | The broker moves the job to a dead-letter queue after 5 attempts | The media object is marked `failed` and the dashboard offers a retry. The original file is kept |
| Commit wait cancelled before the synchronous replica acknowledges (documented by Patroni) | The entry may be written on the primary only, and lost if the primary then fails | The API never confirms such a write and sets no timeout that cancels the wait; the app resends with the same UUID, which is answered as a duplicate if the row survived or inserted again if it did not |
| App uninstalled with entries still queued | Those entries are lost | Declared limitation. The app shows how many entries are waiting to be sent |
| Restore from backup while a participant's erasure from the app is pending | The restored system has no row and no file for that participant, because the backups leave them out from the request | Accepted: the participant asked for the erasure and the data was meant to leave every copy. If the participant then tries to cancel, nothing can be restored and the person can only join again as a new participant. The erasure job treats the missing row as already erased |

## Single points of failure

| Element | Status | Mitigation |
|---|---|---|
| The Docker host (server VM or laptop), its Docker daemon, disk, power and Internet link | Out of scope, declared limitation | The stack starts with one command on another machine. A daily `pg_dump` and a copy of the object storage bucket are encrypted on the host (AES-256-GCM, key outside the stack) and kept for 7 days. They leave out the rows and files of participants whose erasure from the app is pending (see the restore row below). A restore of the latest backup was tested on a clean throwaway stack (scenario 9). The backup service writes the archive to a `backups` bucket in Garage on the same host; the virtual machine is also in the nightly backup of the server, and a copy of the archive on another machine by the service itself is not implemented |
| Garage zones on one host | Declared limitation | Each logical node is its own zone in the Garage layout, so the 3 copies of a file land on 3 logical nodes and the loss of one node is tolerated. The 3 zones share one physical host, so Garage cannot protect against losing the host. The daily copy of the bucket on another machine is the only protection for that case |
| Tailscale coordination service | Out of scope | Existing connections keep working while it is down; new devices cannot join. Administration can also be done on the host itself |
| Gateway 1 for media uploads | Known limit | Upload URLs are signed for the node 1 gateway, so an entry with media cannot start an upload while gateway 1 is down. Text entries switch to gateway 2 |
| Dashboard on one gateway | Known limit | The dashboard has no automatic switch; the user opens the other gateway address |
| Monitoring (Prometheus, Grafana) | Not replicated, not needed to serve users | Its loss hides metrics during a demonstration but does not affect the service. No alert rules are defined |
| Push notification service | Degradation accepted | The app fetches pending activities from the API when it opens |

## Demonstration scenarios

Each scenario is run by a script in `infra/chaos/`. The script prints the state before, injects the failure, measures the
time to detection and recovery, restores the service and prints PASS or FAIL. Scenarios 5 and 10 also run the load generator
and count lost and duplicated entries. `docker kill` simulates a crash; the scripts then start the container again, because
Docker does not restart a container stopped that way. Scenario 2 stops the 8 containers `etcd`, `pg`, `rabbitmq`, `garage`,
`api`, `traefik`, `outbox-relay` and, on node 2, `media-worker` of the node; the scheduler and Tailscale containers stay up.
Records of the server run are in `/srv/fieldnote/chaos/20261109-2016/` on the virtual machine.

| # | Injected failure | Status | Measured result |
|---|---|---|---|
| 1 | Kill an API container while entries are being sent | Pass on the server | Both gateways answer again after 1.1 s and 1.7 s (target under 5 s); all 3 APIs healthy 9.3 s after the restart. Loss of entries not measured here |
| 2 | Stop every container of one logical node, start them again later | Pass on the server (node 2) | The other two nodes keep leader and synchronous replica with 2 of 3 members; the node joins every cluster again after 9.3 s |
| 3 | Kill the database primary | Pass on the server | `pg3` leads after 23.8 s (target up to 45 s); the old primary rejoins as a replica, cluster complete after 27 s. The API and the dashboard do not answer during the pause |
| 4 | Kill the synchronous database replica | Pass on the server | New synchronous replica after 9.9 s; 0 failed requests on both gateways; no write lost |
| 5 | Kill an object storage node during media uploads | Pass on the server | 45 entries with photos sent, 45 confirmed, 0 lost, 0 duplicated; Garage at 3 of 3 nodes after 4.7 s |
| 6 | Kill a broker node | Pass on the server | The node leaves the active set after 0.7 s and rejoins without a partition after 5.6 s. Loss of events not measured here |
| 7 | Disconnect one node from the `cluster` network | Pass on the server (node 2) | The remaining pair keeps leader and synchronous replica; the node joins again 4.3 s after reconnection |
| 8 | Phone in airplane mode during 3 entries | Not run yet | Needs the preview APK on a phone and a researcher token; the script `fs8-airplane-mode.sh` exists. The app does keep entries in its queue and resend them, which is covered by the app's tests, not by this scenario |
| 9 | Restore the latest encrypted backup on a clean stack | Passed on the development stack, not in the server run | Runs in a throwaway project with its own PostgreSQL and Garage and compares the counts of entries and files, leaving out participants with a pending erasure. The figures are not in the server results table |
| 10 | Stop gateway 1 while the app and the dashboard are in use | Pass on the server | 10 simulated phones sent 120 entries, 120 confirmed, 0 lost, 0 duplicated, switching to gateway 2; gateway 1 answers again after 1.9 s. Text entries only, because media uploads depend on gateway 1 |
| 11 | Kill the active scheduler replica during the day | Pass on the server | The standby holds the lease after 15.2 s (target under 20 s); no plan duplicated |
