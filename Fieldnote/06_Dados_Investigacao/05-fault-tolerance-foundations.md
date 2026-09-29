# Fault tolerance foundations

## Question

What theory and which documented mechanisms support Fieldnote's fault tolerance design, what each
mechanism really guarantees according to its own documentation, and where the documentation
limits what the design can claim. The central claim under examination is the one in the fault
model: no entry confirmed to a participant is lost when one logical node fails.

## Why this matters for Fieldnote

Fault tolerance is the main requirement of the Distributed Systems unit and the reason the
platform is distributed at all. An entry recorded in the moment cannot be recorded again later (file 01).
A design that claims "zero data loss" must be able to say under which assumptions, because every
replication system has cases where the claim fails. Reading the documentation of Patroni, RabbitMQ
and Garage closely shaped how the guarantee is stated and one rule in the API.

## The theory behind the limits

### No algorithm can both always agree and always finish

Fischer, Lynch and Paterson (1985) proved a result, known as FLP, that every replicated system
lives with:

> "every protocol for this problem has the possibility of nontermination, even with only one
> faulty process" (abstract)

The problem is consensus in "an asynchronous system of processes, some of which may be unreliable"
(abstract), where there is no bound on how long a message takes. A crashed process cannot be told
apart from a slow one. Practical systems avoid the impossibility by adding timing assumptions:
timeouts, leases and randomised election timers. Every timeout in Fieldnote's design (the Patroni
leader key, the scheduler lease, the Traefik health check) is one of these assumptions. If a node is
slow rather than dead, a timeout can declare it dead by mistake. The fault model accepts this and
relies on mechanisms that stay safe when it happens: an old database primary that loses its
leader key demotes itself, and a scheduler that loses its lease stops sending.

### During a partition, choose consistency or availability

Gilbert and Lynch (2002) formalised Brewer's conjecture:

> "When designing distributed web services, there are three properties that are commonly desired:
> consistency, availability, and partition tolerance." (abstract)

> "It is impossible to achieve all three." (abstract)

Fieldnote chooses consistency for confirmed entries. When a network partition leaves a group of
nodes without a majority, that group stops accepting writes instead of accepting writes that could
later conflict. Unavailability on the server side is absorbed on the phone: the app keeps entries in
its local queue and sends them when a majority is reachable again. The participant can always
record; the server only confirms what it can keep. This is how the design reconciles a
consistency-first server with the experience of an always-available app.

## Consensus: Raft

Ongaro and Ousterhout (2014) designed Raft as a consensus algorithm that is easier to understand
than Paxos:

> "Raft is a consensus algorithm for managing a replicated log." (Ongaro and Ousterhout, 2014)

A Raft cluster makes progress while a majority of its servers are up and can communicate: "a
typical cluster of five servers can tolerate the failure of any two servers". With
three servers, the majority is two, so one failure is tolerated. This is the f = 1 of Fieldnote's
fault model. Raft assumes that servers fail by stopping and may recover from stable storage; it
does not handle servers that lie or corrupt messages (Byzantine failures), which the fault model
also leaves out.

The paper reports a user study with 43 students at two universities in which Raft was easier to
learn than Paxos. That is the authors' own evaluation of their own algorithm, and we cite it only
as the reason Raft was designed, not as independent evidence.

Two components of Fieldnote use Raft: etcd, which holds the leader key Patroni uses, and RabbitMQ
quorum queues.

## Replication in general

Kleppmann (2017, chapter 5) is the reference we used to structure the design: leader-follower
replication, the difference between synchronous and asynchronous replication, failover and its
dangers. Fieldnote uses leader-follower replication with one synchronous follower for the
database, and majority-based replication for the broker and for object storage.

## Database: PostgreSQL with Patroni

### What synchronous mode guarantees

Patroni manages PostgreSQL replication and failover. Its documentation on replication modes says:

> "When synchronous_mode is turned on Patroni will not promote a standby unless it is certain that
> the standby contains all transactions that may have returned a successful commit status to
> client" (Patroni, replication modes)

and adds the cost, in the same section:

> "This means that the system may be unavailable for writes even though some servers are
> available."

Strict mode goes further: "When it is absolutely necessary to guarantee that each write is stored
durably on at least two nodes, enable synchronous_mode_strict in addition to the synchronous_mode."
It "prevents Patroni from switching off the synchronous replication on the primary when no
synchronous standby candidates are available". Patroni records which replica is synchronous in the
consensus store, under the `/sync` key.

### What it does not guarantee

The same page contains a warning that changes how the guarantee has to be stated:

> "Because of the way synchronous replication is implemented in PostgreSQL it is still possible to
> lose transactions even when using synchronous_mode_strict."

The case it describes is a transaction whose wait for the replica's acknowledgement is cancelled,
for example because the client gave up. PostgreSQL has already written the commit locally, so the
change becomes visible on the primary even though no replica has it. If the primary then fails,
the transaction is lost. The page states the general point plainly: "Using PostgreSQL synchronous
replication does not guarantee zero lost transactions under all circumstances."

### What this changes in Fieldnote

Saying that synchronous mode alone makes the "no confirmed entry lost" guarantee hold is too
strong. The guarantee holds only if the API reports an entry as confirmed after its commit has
returned successfully, and in no other situation. The design already had the pieces
to make that true; this reading made it an explicit rule:

1. The API confirms an entry to the app only after the commit returns success. A timeout, a
   cancelled commit or a lost connection during the commit is a failure, reported to the app as an
   error, never as success.
2. The app keeps the entry in its queue until it receives a confirmation, and resends it with the
   same UUID.
3. If the cancelled transaction did survive on the primary, the resend finds the same UUID and the
   same content hash and is answered as a duplicate (200). If it was lost in a failover, the resend
   inserts it again. Either way, exactly one copy remains.
4. The API sets no statement timeout that could cancel the wait for the synchronous replica after
   the commit has been sent. Writes wait during a replica switch, which the fault model already
   describes as "a few seconds of paused writes".

The weak case in Patroni's warning is therefore covered by the idempotent resend. The fault model
lists it explicitly. The guarantee is now stated with its condition: no entry is lost once the app
has received a confirmation.

### Why not asynchronous replication

The documentation describes asynchronous mode as one in which "the cluster is allowed to lose some
committed transactions to ensure availability". That is the opposite of what a diary platform
needs. Synchronous mode costs write latency (each commit waits for a second node) and availability
during a replica failure. Both costs are acceptable for entries that arrive a few at a time per
participant, and the phone's queue hides short pauses.

### Finding the primary after a failover

The API connects with a list of all database hosts and the libpq option `target_session_attrs`.
The PostgreSQL documentation describes it as "typically used in combination with multiple host
names to select the first acceptable alternative among several hosts", and the value `read-write`
accepts only a server that is not in hot standby. This removes the need for a proxy in front of
the database. The option belongs to libpq; whether the Python driver we use passes it through has
to be checked when the API is built.

## Messages: RabbitMQ quorum queues

The RabbitMQ documentation describes quorum queues as a queue type that

> "implements a durable, replicated queue based on the Raft consensus algorithm and should be
> considered the default choice when needing a replicated, highly available queue." (RabbitMQ,
> quorum queues)

Two statements set the guarantees. A message is confirmed to the publisher only after it is on a
majority: "Publisher confirms will only be issued once a published message has been successfully
replicated to a quorum of members". And the queue stops working without a majority: "A quorum queue
requires a quorum of the declared nodes to be available to function." The documentation's table
gives three nodes as the smallest useful size, tolerating one failure.

Two details matter for the design. Classic queue mirroring "was removed starting with RabbitMQ
4.0", so quorum queues are the supported way to replicate queues, not one option among several.
And consumers "should use manual acknowledgements", which is what the media worker does: a job is
acknowledged only after the file is processed, so a worker that crashes leaves the job to be
delivered again.

With three members, a queue that loses two stops working until a majority is back.

## Files: Garage

Garage is an S3-compatible object store built for self-hosting across sites. Its documentation
explains that "Garage allows you to store copies of your data in multiple geographical locations in
order to maximize resilience to adverse events", and that it can "run very well even at home, using
consumer-grade Internet connectivity".

On replication, the configuration reference describes each value instead of recommending one. For
a factor of 3:

> "data stored on Garage will be stored on three different nodes, if possible each in a different
> zones." (Garage, configuration reference)

and "As long as only a single node fails, or node failures are only in a single zone, reading and
writing data to Garage can continue normally." A factor of 2 is not enough for Fieldnote: "Data
remains available in read-only mode when one node is down, but write operations will fail." The
default consistency mode, `consistent`, sets read and write quorums "so that read-after-write
consistency is guaranteed".

**What the documentation does not say.** It does not recommend a replication factor for most
cases. It explains what each factor tolerates, and factor 3 is the one that keeps writes working
with one node down, which is our requirement.

**The zone question.** Garage places copies in different zones, meaning different failure domains
such as buildings or data centres. Fieldnote's three Garage nodes run on one physical host. We give
each logical node its own zone in the Garage layout, so copies land on three different logical
nodes, but the three zones share one machine. Garage cannot protect against the loss of that
machine. The fault model already declares the host a single point of failure; this is one more
component affected by it.

## Database and broker together: the transactional outbox

An entry has to be stored in the database and announced to the broker (so the media worker and the
dashboards learn about it). These are two different systems. The transactional outbox pattern
explains why the obvious solutions fail:

> "The command must atomically update the database and send messages in order to avoid data
> inconsistencies and bugs. However, it is not viable to use a traditional distributed transaction
> (2PC) that spans the database and the message broker" (Richardson, microservices.io)

The pattern stores the message in an outbox table in the same database transaction as the data,
and a relay publishes it afterwards. A relay that publishes and crashes before marking the message
as sent publishes it again, so delivery is at least once and consumers must ignore messages they
have already handled. Fieldnote's consumers do this by event id.

## The single-host question

All three logical nodes run on one Docker host. FLP, CAP and Raft do not care whether nodes are
virtual machines or containers: what they need is independent failure and a network between
members, and stopping all containers of one logical node produces exactly the failure the
algorithms are designed for. What the single host cannot show is the loss of the machine itself,
of its disk or of its power. This is declared in the fault model and in the report, with
the upgrade path (one virtual machine per logical node), which needs no change to the design
because members find each other by name.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| FLP: timeouts can declare a slow node dead | Every timeout-based takeover is designed to be safe if wrong: self-demotion of the old primary, lease check before each notification | Adopted, in the architecture |
| CAP: consistency costs availability during a partition | Server chooses consistency; the phone queue keeps the app usable | Adopted |
| Patroni: transactions can be lost even in strict mode when a commit wait is cancelled | Confirm only after a successful commit; no timeout that cancels the synchronous wait; idempotent resend covers the case | Adopted; fault model updated |
| Patroni: asynchronous mode loses committed transactions | Not used | Adopted |
| libpq multi-host depends on the driver | Check driver support when building the API | To verify |
| RabbitMQ: quorum queues are the default replicated queue; mirroring removed in 4.0 | Quorum queues with manual acknowledgements | Adopted |
| Garage: factor 3 keeps writes with one node down; zones are failure domains | Factor 3, one zone per logical node, host declared as single point of failure | Adopted |
| Outbox: 2PC is not viable; delivery is at least once | Outbox table, relay, idempotent consumers | Adopted |

## Sources

- Fischer, M. J., Lynch, N. A. and Paterson, M. S. (1985). Impossibility of distributed consensus
  with one faulty process. *Journal of the ACM*, 32(2), 374-382. https://doi.org/10.1145/3149.214121
- Garage. Configuration file format (replication factor and consistency mode).
  https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/
- Garage. List of Garage features. https://garagehq.deuxfleurs.fr/documentation/reference-manual/features/
- Gilbert, S. and Lynch, N. (2002). Brewer's conjecture and the feasibility of consistent,
  available, partition-tolerant web services. *ACM SIGACT News*, 33(2), 51-59.
  https://doi.org/10.1145/564585.564601
- Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. Chapter 5,
  Replication.
- Ongaro, D. and Ousterhout, J. (2014). In search of an understandable consensus algorithm.
  *Proceedings of the 2014 USENIX Annual Technical Conference*, 305-319.
  https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
- Patroni. Replication modes. https://patroni.readthedocs.io/en/latest/replication_modes.html
- PostgreSQL 17. libpq connection strings. https://www.postgresql.org/docs/17/libpq-connect.html
- RabbitMQ. Quorum queues. https://www.rabbitmq.com/docs/quorum-queues
- Richardson, C. Pattern: Transactional outbox.
  https://microservices.io/patterns/data/transactional-outbox.html

All sources accessed in September 2026.

## Limits

- From the Raft paper and the documentation we read the sections on guarantees and failure
  handling. For Fischer, Lynch and Paterson and for Gilbert and Lynch we rely on the statements of
  their results; the connection between FLP and the timeouts in our design is our own reasoning.
- Kleppmann (2017) was used to structure the design; no quotation is taken from it.
- The documentation describes each tool's guarantees under its own assumptions, for the versions
  current in September 2026. The project will test them in its failure scenarios; until then they
  are documented properties, not measured ones.
- Network faults other than a full partition of one node (packet loss, latency, asymmetric links)
  are not tested on one host.
