# Requirements

Status: proposed, 1 October 2026. Every requirement below is proposed. Nothing is implemented, and the
verification methods are plans. The requirements follow the design documents; where a value is not in
the design, the statement says so.

## Scope and use

Fieldnote is a distributed, fault-tolerant platform for diary studies and mobile ethnography.
Researchers use a web dashboard, participants use a React Native app and administrators manage
accounts. The requirements cover proposal 11 of the course briefing and the design documents.
Personas and scenarios are in [personas and scenarios](personas-and-scenarios.md) and the
use case descriptions are in [use cases](use-cases.md).

### Conventions

Priority follows MoSCoW: Must is needed for the course delivery, Should is planned if time allows,
Could is optional. Verification methods are Test (automated or scripted check with a pass or fail
result), Demonstration (observed operation, for example on an Android phone or during a failure
script) and Inspection (review of code, configuration or documents).

| Code | Meaning |
|---|---|
| BRF | Course briefing, proposal 11 |
| R00 to R08 | Research files in `06_Dados_Investigacao/`: 00 UNIDCOM context, 01 diary studies, 02 mobile ethnography, 03 existing platforms, 04 prompt timing, 05 fault tolerance, 06 privacy and ethics, 07 network access, 08 from research to design |
| UNIDCOM framing | The team's reading of a research unit as the user, from R00 |
| ARCH | [Architecture](../architecture.md) |
| DM | [Data model](../data-model.md) |
| FM | [Fault model](../fault-model.md) |
| SCH | [Scheduler](../scheduler.md) |
| SEC | [Security](../security.md) |
| MEM | [Descriptive report](../../01_Memoria_Descritiva/memoria.md) |
| UC1 to UC17 | Use cases of [use-cases.svg](../diagrams/use-cases.svg), described in [use cases](use-cases.md), including UC5b and UC9b |
| FS-1 to FS-11 | Failure scenarios 1 to 11 of the fault model, run by scripts in `infra/chaos/` |
| ST-1 to ST-7 | The seven automated security tests of the security design, in its order: researcher cannot read or export another study; participant cannot read another participant's entries; revoked token stops on every replica; signed URL stops after expiry; exported media carry no coordinates when the activity does not ask for location; rate limits apply under load; an export with no options has no identity, location or media |
| SE, AB | Scheduler evaluation and ablation study of the scheduler design |
| UT, IT, E2E | Planned unit test, integration test and end-to-end test |
| DEMO, INS | Planned demonstration and planned inspection |

The design leaves some numbers open: the maximum upload size, the attempt limit of the invite code
and the throughput of the platform are not fixed. Requirements with a value the design does not
give say "proposed here" and have to be confirmed.

## Functional requirements

### Participant app

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-01 | The system shall let a participant join one study by typing a single-use invite code of 10 characters from a 32-symbol alphabet, valid for 7 days from issue, with an attempt limit per IP address. | Must | BRF (manage participants); SEC: Participant credentials | Test |
| FR-02 | The system shall issue a random 256-bit device token to the phone when an invite code is accepted, store only its SHA-256 hash on the server and keep the token in the phone's secure storage (Keychain on iOS, Keystore on Android through `expo-secure-store`). | Must | SEC: Participant credentials | Test, inspection |
| FR-03 | The system shall show the informed consent text in the participant's language before the first activity and store the accepted version and the time of acceptance in `consent`. Joining a study is complete only after acceptance. | Must | BRF; SEC: Consent and ethics review; R06 | Test |
| FR-04 | The participant app shall provide its interface texts and the consent text in Portuguese (`pt`) and English (`en`), selected by `participant.locale`. | Must | UNIDCOM framing (R00); ARCH: Language | Test, inspection |
| FR-05 | The system shall let a participant declare the hours of the day in which they accept prompts (`availability`) and change them later. | Must | SCH: Formulation; DM: `availability` | Test |
| FR-06 | The system shall notify the participant of a new activity with a push notification sent through the Expo Push service. | Must | BRF (participants receive activities); ARCH: Components | Test, demonstration |
| FR-07 | The app shall ask the API for the participant's pending prompts every time it opens, so activities reach the participant when push notifications fail. | Must | ARCH: Notifications with a fallback; FM: Guarantees | Test |
| FR-08 | The app shall download the participant's plan for the next 24 hours when it syncs, schedule local notifications from it and cancel each local notification by prompt id when the push for that prompt arrives or the prompt is answered. | Should | ARCH: Notifications with a fallback; SCH: Scope limits; R04 | Test, demonstration |
| FR-09 | The system shall let a participant record an entry of type text, photo, video, audio, scale or choice. An activity accepts one or more of these types and the participant picks one of them. | Must | BRF; DM: `activity` | Test, demonstration |
| FR-10 | The app shall limit video entries to 2 minutes. | Must | BRF; ARCH: File first, metadata second | Test |
| FR-11 | The system shall store the date and time of every entry from the phone clock (`entry.recorded_at`) and the time of arrival at the server (`entry.received_at`). | Must | BRF; DM: Design notes; R01 | Test |
| FR-12 | The app shall attach the location of the phone to an entry only when the activity requests it. Location is off by default. | Must | BRF; R00 (places); SEC: Principles | Test |
| FR-13 | The system shall accept free entries, not tied to a prompt, only for activities that allow them, up to the daily cap set in the activity. | Should | DM: `activity`, Design notes; R08 | Test |
| FR-14 | The app shall create the entry UUID and the SHA-256 hash of its content on the phone before sending. | Must | ARCH: Client-generated identifiers | Test |
| FR-15 | The app shall keep recorded entries in a local SQLite queue while the phone has no connection and let the participant keep recording. | Must | BRF; ARCH: Components; R01, R02 | Test, demonstration |
| FR-16 | The app shall resend queued entries automatically when the connection returns, with the same UUID. On answer 200 it removes the entry from the queue; on answer 409 it keeps the entry and reports the problem to the participant. | Must | ARCH: Client-generated identifiers; FM: What can be lost or repeated | Test |
| FR-17 | The app shall upload each media file directly to object storage through the signed URL obtained from the API and request a new URL when an upload fails or the URL has expired. | Must | ARCH: File first, metadata second; SEC: Media files | Test |
| FR-18 | The app shall show the participant how many entries are waiting to be sent. | Should | FM: What can be lost or repeated (app uninstalled) | Demonstration |
| FR-19 | The app shall report to the API when a prompt was shown and when it was opened (`prompt.shown_at`, `prompt.opened_at`). | Should | DM: Design notes; SCH: Evaluation | Test |
| FR-20 | The system shall let a participant review the entries they recorded, with their sending status. Entries are read only. | Should | BRF; DM: Participant identity; SEC: Authorisation | Test |
| FR-21 | The app shall show the instruction written by the researcher for each activity, including the guidance to avoid recording people who have not agreed to take part, documents and house numbers. | Should | SEC: Consent and ethics review | Inspection |

### Researcher dashboard

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-22 | The system shall let a researcher create a study with a title, a time zone, a schedule style (`fixed`, `balanced` or `varied`), a maximum number of prompts per participant per day (`max_prompts_per_day`) and a maximum number of prompts per slot (`max_prompts_per_slot`). | Must | BRF (create studies); SCH: Formulation; R04 | Test |
| FR-23 | The system shall let the study owner add other researchers to the study as collaborators (`study_member`). | Should | DM: `study`, `study_member` | Test |
| FR-24 | The system shall let a researcher define activities in a study: the accepted entry types (one or more), an instruction text, the expected effort per entry in minutes (`expected_minutes`), whether location is requested, whether free entries are allowed and their daily cap. | Must | BRF (define activities); DM: `activity` | Test |
| FR-25 | The system shall let a researcher set, for each activity, the time window, the number of prompts per day (`prompts_per_day`) and the minimum gap between prompts (`min_gap_minutes`). All times are in the study's time zone. | Must | SCH: Formulation | Test |
| FR-26 | The dashboard shall suggest a value for `max_prompts_per_slot` when a study is created, computed from the number of participants and their availability. | Should | SCH: When a prompt is left unplanned | Test |
| FR-27 | The dashboard shall show the expected effort per participant and per day, as the sum of `expected_minutes` of the planned prompts. | Should | DM: Design notes; R01; R08 | Test |
| FR-28 | The system shall let a researcher add a participant to a study with an alias and, optionally, a name and an email address, and issue the participant's invite code. | Must | BRF (manage participants); DM: Participant identity | Test |
| FR-29 | The system shall let a researcher issue a new invite code for an existing participant, which links a new phone and keeps the history, and revoke the participant's current device token. | Must | DM: Participant identity; SEC: Participant credentials | Test |
| FR-30 | The system shall run several studies and serve several participants at once, and a researcher shall see only the studies where they are a member. | Must | BRF; SEC: Authorisation | Test |
| FR-31 | The dashboard shall show new entries and prompt status changes to a researcher in real time, through server-sent events that tell the dashboard what changed while the data is read from the REST API. | Must | BRF (follow in real time); ARCH: Real time | Test, demonstration |
| FR-32 | The dashboard shall show adherence per participant and per day: prompts planned, shown, opened and answered, and prompts left unplanned. | Must | BRF (follow participants); R01 | Test |
| FR-33 | The dashboard shall list the entries of a study with `recorded_at` and `received_at` both visible, and filter them by participant, activity, entry type, tag and date. | Must | BRF (consult and organise data); DM: Design notes; R01 | Test |
| FR-34 | The dashboard shall show photos with thumbnails and play audio and video entries inline in the browser, with the files served with their checked content type and `X-Content-Type-Options: nosniff`. Downloads and exports use `Content-Disposition: attachment`. | Must | BRF; ARCH: Components (media worker); SEC: Media files | Test, demonstration |
| FR-35 | The dashboard shall show prompts left unplanned with their reason. The reason codes (`outside_availability`, `min_gap_infeasible`, `daily_cap`, `slot_cap` and `search_cut`) are the stored values; the dashboard shows each as a plain Portuguese sentence. | Must | SCH: When a prompt is left unplanned | Test |
| FR-36 | The dashboard shall offer a retry for a media object whose processing failed. | Should | FM: What can be lost or repeated | Test |
| FR-37 | The system shall let a researcher create tags, attach them to entries and detach them (`tag`, `entry_tag`). | Must | BRF (organise data); DM: `tag` | Test |
| FR-38 | The system shall let the study owner and administrators read the identity of a participant (`participant_identity`) and shall write every read to the audit log. | Should | DM: `participant_identity`; SEC: Pseudonymisation | Test |

### Administration

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-39 | The system shall let researchers and administrators sign in with email and password and sign out. | Must | BRF; SEC: Researcher and administrator authentication | Test |
| FR-40 | The system shall let a user reset a forgotten password through a single-use link valid for 30 minutes, sent to the account's email address. | Should | SEC: Researcher and administrator authentication | Test |
| FR-41 | The system shall let an administrator create, edit and deactivate researcher accounts (`user_account`). | Must | BRF (manage researchers) | Test |
| FR-42 | The system shall let an administrator list all studies with their researchers, participants and entry counts. | Must | BRF (manage studies); R08 | Test |
| FR-43 | The system shall let an administrator consult the audit log and filter it by actor, action and date. | Must | BRF; SEC: Audit log | Test |
| FR-44 | The system shall let an administrator erase one participant: the identity and all entries, with every copy of their files, in the live system. Each erasure is written to the audit log. | Must | SEC: Erasure, retention and backups; R06 | Test |

### Scheduler

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-45 | The scheduler shall plan one day at a time, every night, for each running study, using the study's time zone. | Must | SCH: Formulation; R04 | Test |
| FR-46 | The scheduler shall choose the time of each prompt from 15-minute slots inside the participant's availability and the activity's window. | Must | SCH: Formulation | Test |
| FR-47 | The scheduler shall keep two prompts of the same participant at least `min_gap_minutes` apart, using the larger gap when two activities differ. | Must | SCH: Formulation | Test |
| FR-48 | The scheduler shall plan no more than `max_prompts_per_day` prompts per participant. | Must | SCH: Formulation; R04 | Test |
| FR-49 | The scheduler shall plan no more than `max_prompts_per_slot` prompts in one slot across the participants of a study. | Must | SCH: Formulation; R04 | Test |
| FR-50 | The scheduler shall score valid plans with the study's schedule style: `varied` rewards prompts away from yesterday's slot and uncovered parts of the day, `fixed` rewards the same slot as yesterday, `balanced` weighs both at 0.5. | Must | SCH: Soft preference score; R04 | Test |
| FR-51 | The scheduler shall return a valid partial plan when no complete plan exists, mark each prompt it cannot place as `unplanned` and store one of the five reasons in `prompt.unplanned_reason`. | Must | SCH: Partial plans, When a prompt is left unplanned | Test |
| FR-52 | The scheduler shall stop searching after 10 s per study, keep the best plan found and record that the run was cut. | Must | SCH: Algorithm, What the end of the search proves | Test |
| FR-53 | The scheduler shall replan only the remaining prompts of a participant who changes availability during the day, keeping sent prompts fixed and still respecting the slot counters of other participants. | Should | SCH: Replanning during the day | Test |
| FR-54 | The scheduler shall send each planned prompt as a push notification at its planned time and mark the prompt as sent in the same statement that checks the scheduler still holds the lease. | Must | SCH: Running the scheduler with two replicas; FM: What can be lost or repeated | Test |

### Data and export

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-55 | The API shall insert an entry with `ON CONFLICT DO NOTHING`. When the UUID exists for the same participant with the same hash it answers 200; when the participant or the hash differs it answers 409. | Must | ARCH: Client-generated identifiers | Test |
| FR-56 | The API shall confirm an entry to the app only after the database commit has returned successfully and after checking that the entry's media objects exist. | Must | ARCH: Synchronous replication, File first, metadata second; FM: Guarantees | Test |
| FR-57 | The API shall accept entries that arrive after the activity window, with their original `recorded_at`, and never reject them for arriving late. | Must | ARCH: Client-generated identifiers; R01; R08 | Test |
| FR-58 | The API shall offer no operation that edits an entry after it was confirmed. | Must | SEC: Threat model (tampering) | Inspection, test |
| FR-59 | The API shall write an entry and its `entry.created` event to `outbox_event` in the same database transaction, and every API replica shall relay unpublished events to RabbitMQ with publisher confirms. | Must | ARCH: Transactional outbox | Test |
| FR-60 | The media worker shall create thumbnails, convert videos to H.264 MP4 at a smaller resolution and check the real file type from the first bytes, rejecting anything that is not an image, audio or video. | Must | ARCH: Components; SEC: Media files | Test |
| FR-61 | The media worker shall strip metadata, including GPS, from photos, videos and audio when the activity does not request location, replace the original with the stripped file and keep the original out of downloads and exports until processing has succeeded. | Must | SEC: Media files; R06 | Test |
| FR-62 | The system shall delete media objects that stay `pending` for 7 days. | Should | ARCH: File first, metadata second; FM: What can be lost or repeated | Test |
| FR-63 | The system shall issue a signed download URL for each media object a user may read, check the user's access to the object's study and write the issue to the audit log. | Must | SEC: Media files, Audit log | Test |
| FR-64 | The system shall let a researcher export the entries of a study as CSV, with for each entry the participant alias, activity, prompt, entry type, content, `recorded_at` and `received_at`. | Must | BRF (export data); R01 | Test |
| FR-65 | An export with no options shall contain no identity, no location and no media files. | Must | SEC: Pseudonymisation and the identity table; R06 | Test |
| FR-66 | The system shall let a researcher include location, media files or identity in an export only by choosing each option explicitly. | Should | SEC: Pseudonymisation and the identity table | Test |
| FR-67 | The system shall write every export to the audit log with the content the researcher chose. | Must | SEC: Threat model (repudiation) | Test |
| FR-68 | The system shall record in `audit_log`, with the type of actor (user, participant or system), logins, exports, issued media URLs, reads of `participant_identity`, changes to studies, erasures and system jobs. | Must | SEC: Audit log; DM: `audit_log` | Test |

## Non-functional requirements

### Availability and fault tolerance

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-01 | The system shall keep receiving entries, serving the researcher dashboard and delivering scheduled activities after the loss of any one of the three logical nodes (f = 1). | Must | FM: Guarantees; R05 | Test, demonstration |
| NFR-02 | When two logical nodes are down, the system shall stop accepting writes and shall never accept inconsistent writes. The app shall keep recording into its local queue and send the entries when a quorum is back. | Must | FM: Guarantees; R05, R08 (consistency over availability) | Test |
| NFR-03 | The system shall not lose any entry that the API has confirmed when one logical node fails (recovery point objective of zero). | Must | FM: Guarantees; R05 | Test, demonstration |
| NFR-04 | The system shall detect and route around a failed API replica in under 5 s, using a `/health` check every 2 s with a 1 s timeout. `/health` shall fail when the replica cannot write to the database or reach the broker. | Must | FM: Recovery time targets; ARCH: How each layer tolerates failure | Test |
| NFR-05 | Docker shall restart a crashed container of any service. | Must | FM: Guarantees; ARCH: How each layer tolerates failure | Test |
| NFR-06 | The system shall serve clients through two gateways, and a client that fails a request on one gateway shall switch to the other in under 5 s. | Must | FM: Recovery time targets, scenario 10; ARCH: Deployment | Test |
| NFR-07 | The system shall transfer the scheduler to the standby in under 20 s after the leader fails. | Must | FM: Recovery time targets, scenario 11; SCH: Running the scheduler with two replicas | Test |
| NFR-08 | The system shall promote the synchronous database replica within 45 s after the primary fails, with no confirmed entry lost. The value is a target to be tuned and measured. | Must | FM: Recovery time targets | Test, demonstration |
| NFR-09 | When the synchronous database replica fails, the system shall pause writes for a few seconds and then continue with the other replica as synchronous. | Must | FM: Recovery time targets | Test |
| NFR-10 | A failed broker node or object storage node shall cause no interruption, because the remaining two members keep the quorum, and an upload in progress shall complete. | Must | FM: Recovery time targets | Test |
| NFR-11 | When one node is cut off from the `cluster` network, the isolated node shall stop serving requests, the other two nodes shall keep accepting writes and the node shall resynchronise when it reconnects. | Must | FM: Demonstration scenarios; ARCH: Networks | Test |
| NFR-12 | After a media job fails 5 times, the broker shall move it to a dead-letter queue and the media object shall be marked `failed`. The original file is kept. | Must | FM: What can be lost or repeated | Test |
| NFR-13 | The system shall make a daily `pg_dump` and a copy of the object storage bucket, encrypt them on the host with a public key whose private key is kept off the host, send them to another machine and keep them for 7 days. | Must | FM: Single points of failure; SEC: Erasure, retention and backups | Test, inspection |
| NFR-14 | A restore of the latest backup on a clean stack shall bring back the database and the files of the backup day, with matching counts of entries and files. | Must | FM: Demonstration scenarios | Test, demonstration |
| NFR-15 | The system shall expose metrics to Prometheus and show them in Grafana, with alerts, during the failure demonstration. The loss of monitoring shall not affect the service. | Should | FM: Single points of failure; ARCH: Components | Demonstration |

### Consistency

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-16 | The database shall run with one primary, one synchronous replica and one asynchronous replica, with Patroni `synchronous_mode: true` and `synchronous_mode_strict: true`, so that a failover only promotes a replica recorded as synchronous. | Must | ARCH: Synchronous replication; R05 | Inspection, test |
| NFR-17 | The API shall set no timeout that can cancel the wait for the synchronous replica and shall report any outcome other than a successful commit to the app as a failure. | Must | ARCH: Synchronous replication; R05 | Inspection, test |
| NFR-18 | Object storage shall confirm a write after 2 of 3 copies, with each logical node as its own zone, so that the 3 copies of a file are on 3 logical nodes. | Must | ARCH: Components | Inspection, test |
| NFR-19 | RabbitMQ shall use quorum queues, the relay shall use publisher confirms and consumers shall ignore event ids they have already processed. | Must | ARCH: Transactional outbox, How each layer tolerates failure | Test |
| NFR-20 | The API shall connect to the database with a host list and `target_session_attrs=read-write`, a 3 s connect timeout and a connection pool that checks connections before use, and shall retry a failed transaction up to 3 times. | Must | ARCH: Database connections | Test |
| NFR-21 | A database primary cut off from etcd shall demote itself to read-only when its leader key expires. | Should | ARCH: Database connections; FM: Guarantees | Test |
| NFR-22 | Only one scheduler replica shall plan and send at a time. The leader shall renew its lease row every 5 s, a lease not renewed for 15 s may be taken by the standby, and the leader shall stop sending when a database call fails. | Must | SCH: Running the scheduler with two replicas | Test |
| NFR-23 | `prompt` shall have a unique key on participant, activity, plan date and occurrence, so that a failover does not plan or send the same prompt twice. | Must | DM: Design notes | Test |
| NFR-24 | The system shall deliver messages at least once and store results exactly once. The relay shall claim events with `SELECT ... FOR UPDATE SKIP LOCKED` and delete published events after 7 days. | Should | ARCH: Transactional outbox, Client-generated identifiers | Test |

### Performance and load

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-25 | The scheduler shall return a plan within 10 s per study for studies of up to 100 participants, and the run shall record whether it finished or was cut. | Must | SCH: Algorithm, Evaluation | Test |
| NFR-26 | No plan returned by the scheduler shall violate a hard constraint. The evaluation shall report prompts left unplanned, nodes expanded, backtracks, load spread and soft score for each study size. | Must | SCH: Evaluation, Ablation study | Test |
| NFR-27 | The system shall accept the burst of entries with photos, audio or video of several MB that follows an activity sent to all participants of a study, without losing a confirmed entry. | Must | ARCH: Why the system is distributed; R04 | Test |
| NFR-28 | The system shall run several studies at the same time, with up to 100 participants in one study. The target of 3 studies at once is proposed here and has to be confirmed. | Must | BRF; R00 (several studies at once) | Test |
| NFR-29 | Media files shall travel between the phone and object storage without passing through the API. | Must | ARCH: File first, metadata second; SEC: Media files | Inspection |
| NFR-30 | The API shall confirm an entry without waiting for media processing, which runs asynchronously in the media worker. | Should | ARCH: Components, Transactional outbox | Test |
| NFR-31 | The dashboard shall show a confirmed entry within 5 s under normal operation. The value is proposed here and has to be validated by a load test. | Should | BRF (real time); ARCH: Real time | Test |
| NFR-32 | The API shall send a comment line on each server-sent event connection every 20 s, with `Cache-Control: no-store` and no compression. A dashboard that loses its connection shall reconnect after a random delay of 1 to 5 s and reload the entries received since the last one it showed, removing duplicates by entry id. | Must | ARCH: Real time | Test |

### Security and privacy

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-33 | The system shall store passwords as Argon2id hashes with at least 19 MiB of memory, 2 iterations and parallelism 1. | Must | SEC: Researcher and administrator authentication | Inspection, test |
| NFR-34 | The system shall issue access tokens valid for 15 minutes and refresh tokens that change on every use, are stored as hashes and are grouped by family. Presenting a superseded refresh token shall revoke the whole family. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-35 | The dashboard shall keep the refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie and the access token only in memory. | Must | SEC: Researcher and administrator authentication | Inspection, test |
| NFR-36 | The system shall apply a progressive delay and then a temporary lockout after repeated failed logins, return the same error for an unknown email and a wrong password, and run a dummy Argon2id verification for an unknown email. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-37 | The system shall require TOTP for administrator accounts. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-38 | The system shall check the user's role and membership of the study on every request, and a participant shall read only their own entries. | Must | SEC: Authorisation, Threat model | Test |
| NFR-39 | The system shall compare invite codes, device tokens and refresh tokens in constant time. | Should | SEC: Participant credentials | Inspection |
| NFR-40 | Signed URLs for media shall be valid for 10 minutes and for one object, and shall sign the maximum size and the content type so that object storage enforces them. | Must | SEC: Media files; ARCH: File first, metadata second | Test |
| NFR-41 | Traefik shall log the `/media` route without the query string, and media files shall be served with their content type, checked by the media worker, and `X-Content-Type-Options: nosniff`, so that the dashboard shows and plays them inline. Downloads and exports shall use `Content-Disposition: attachment`. | Must | SEC: Media files | Inspection, test |
| NFR-42 | The system shall keep names and emails only in `participant_identity`. Researchers shall see aliases by default, and one person in two studies shall be two unrelated participant rows. | Must | DM: Participant identity; SEC: Principles; R06 | Inspection, test |
| NFR-43 | The services shall write to `audit_log` with a database role that has `INSERT` and no `UPDATE` or `DELETE`. The log shall survive the erasure of a participant with pseudonymous identifiers only. | Must | SEC: Audit log | Test, inspection |
| NFR-44 | An erasure shall reach the three database nodes and the three copies of every file. Data in backups shall leave them within 7 days, and the consent text shall say so. | Must | SEC: Erasure, retention and backups | Test, inspection |
| NFR-45 | No port shall be open to the Internet. Clients shall reach the gateways through Tailscale with HTTPS on top, and the `cluster` network shall not be published on the host. The database, etcd and RabbitMQ shall not be on the `edge` network. | Must | SEC: Network access and transport; ARCH: Networks | Inspection, test |
| NFR-46 | Traefik shall apply rate limits per IP address, and the API shall throttle logins per account. | Must | SEC: Network access and transport | Test |
| NFR-47 | Signing keys and the passwords for the database, RabbitMQ and Garage shall be Docker Compose secrets and never committed. The repository shall hold `.env.example` without values, and GitHub secret scanning with push protection shall be enabled. | Must | SEC: Secrets and the public repository | Inspection |
| NFR-48 | Each service shall have its own credentials with only the permissions it needs: the media worker shall not read identities, accounts or text entries, the scheduler shall not access files or identities, and the API shall not change or delete the audit log. | Must | SEC: Service privileges and container hardening | Test, inspection |
| NFR-49 | Containers shall run as non-root users, drop all Linux capabilities, never run privileged, use read-only file systems where possible and use images pinned by digest. | Should | SEC: Service privileges and container hardening | Inspection |
| NFR-50 | The repository shall report vulnerable dependencies with Dependabot, `pip-audit` and `npm audit`. | Should | SEC: Service privileges and container hardening | Inspection |
| NFR-51 | All database queries shall be parameterised, participant text shall be shown as text and never as HTML, and the dashboard shall send a restrictive Content-Security-Policy header. | Must | SEC: Web application and notifications | Test, inspection |
| NFR-52 | Push and local notification texts shall carry no participant data and say only that a new activity is available. | Must | SEC: Web application and notifications | Inspection, test |
| NFR-53 | The system shall apply encryption at rest. The mechanism is under analysis with the Security course: encrypted volumes on the host, and application-level encryption of the identity table. | Could | SEC: Encryption at rest | Inspection |

### Usability and language

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-54 | The dashboard shall be in Portuguese, the language of the researchers it is designed for (UNIDCOM framing) and of the mockups. | Must | UNIDCOM framing (R00); mockups | Inspection |
| NFR-55 | The dashboard should also be available in English, for researchers who do not read Portuguese. | Should | R00; open question on languages (R08) | Inspection |
| NFR-56 | The dashboard shall not show infrastructure terms to researchers. Failures of the distributed system are visible through monitoring. | Should | UNIDCOM framing (R00) | Inspection |
| NFR-57 | The system shall let participants use the app without an email address or password. | Must | DM: Participant identity; SEC: Principles | Inspection |
| NFR-58 | The dashboard shall show times of day in the study's time zone. | Should | SCH: Formulation; DM: Design notes | Test |

### Portability and deployment

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-59 | The whole stack shall run with Docker Compose on one Docker host, a virtual machine, and on a laptop with Docker Desktop. | Must | ARCH: Deployment | Demonstration |
| NFR-60 | The Compose project shall group the services into three logical nodes by Compose profile, each with its own containers, volumes and one member of every cluster, so that each node can later move to its own machine. | Must | ARCH: Deployment | Inspection, test |
| NFR-61 | Cluster members shall find each other by Compose service name, never by IP address. | Must | ARCH: Deployment | Inspection |
| NFR-62 | The stack shall start with one command on another machine from a fresh bootstrap with generated demonstration data, without copying the volumes of the server. | Should | ARCH: Deployment; FM: Single points of failure | Demonstration |
| NFR-63 | The participant app shall run on Android phones. Other platforms are outside the test scope. | Must | MEM: Limitations; ARCH: Components | Test, demonstration |
| NFR-64 | The dashboard shall run in a current desktop browser and be served by the API replicas. | Must | ARCH: Components | Demonstration |

### Maintainability

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-65 | Every service shall take its configuration from environment variables and secrets, with no host address written in code. | Should | ARCH: Deployment; SEC: Secrets and the public repository | Inspection |
| NFR-66 | Database changes shall be versioned migrations applied by a command. | Should | DM: status note (tables change during implementation) | Inspection |
| NFR-67 | The repository shall include automated unit and integration tests, the failure scripts and the load generator, each runnable with a documented command. | Should | SEC: How the measures will be verified; FM: Demonstration scenarios | Inspection |

### Declared limitations

These are outside the guarantees and are not requirements.

| Limitation | Source |
|---|---|
| The Docker host, its daemon, disk, power and Internet link are a single point of failure. The Garage zones share that host. | FM: Single points of failure |
| Packet loss, latency, Byzantine failures and partitions other than one node against two are not tested. | FM: Guarantees; ARCH: Networks |
| Entries still in the app queue are lost if the app is uninstalled before they are sent. The queue is not encrypted. | FM: What can be lost or repeated; SEC: Residual risks |
| Faces and voices in media are not blurred. The data is pseudonymous, not anonymous. | SEC: Residual risks; R08 |
| Push notifications are best effort. | ARCH: Notifications with a fallback |
| Incident response and the 72-hour notification duty are outside the project. | SEC: Residual risks |

## Development requirements and constraints

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| DR-01 | Mobile app: React Native with Expo, TypeScript, SQLite for the offline queue. | Must | ARCH: Components; MEM: Technologies | Inspection |
| DR-02 | Dashboard: React with Vite, TypeScript. | Must | ARCH: Components; MEM: Technologies | Inspection |
| DR-03 | Backend: Python 3.12 with FastAPI, using psycopg 3 as the database driver so that multi-host connection strings with `target_session_attrs` are supported. | Must | ARCH: Components, Database connections | Inspection, test |
| DR-04 | Data services: PostgreSQL 17 with Patroni and etcd, RabbitMQ with quorum queues, Garage as S3-compatible storage. | Must | ARCH: Components | Inspection |
| DR-05 | Other services: Traefik and Tailscale for access, ffmpeg in the media worker, Expo Push for notifications, Prometheus and Grafana for monitoring. | Must | ARCH: Components | Inspection |
| DR-06 | The technology stack is a proposal and shall be validated by the lecturers of Projeto de Desenvolvimento de Software and Sistemas Distribuídos. The decision to use three logical nodes on one host also depends on the Distributed Systems lecturer. | Must | MEM: Technologies; R08: Open questions | Inspection |
| DR-07 | The scheduler shall implement node consistency, AC-3, backtracking search with MRV and LCV, forward checking and a trail itself, without a solver library. Branch and bound is optional and decided during implementation. | Must | SCH: Algorithm; MEM: Summary | Inspection |
| DR-08 | The scheduler evaluation shall use generated studies of 10, 50 and 100 participants with a recorded seed, a fixed node budget instead of the wall-clock limit, the baseline of identical hours for all participants and the ablation in five variants (plain backtracking, plus forward checking, plus MRV, plus LCV, plus AC-3). | Must | SCH: Evaluation, Ablation study | Test |
| DR-09 | The stack shall be started with Docker Compose on the server and on a laptop. | Must | ARCH: Deployment; MEM: Tools | Demonstration |
| DR-10 | The source code shall be in a public GitHub repository that contains no secrets, with GitHub secret scanning and push protection enabled. | Must | SEC: Secrets and the public repository; BRF | Inspection |
| DR-11 | The documentation shall follow the archive structure required by the course: `00_Identificacao`, `01_Memoria_Descritiva`, `02_Imagens`, `03_Videos`, `04_Documentacao_Tecnica`, `05_Artefactos`, `06_Dados_Investigacao` and `07_Autorizacoes`. Folder and file names are in Portuguese and the content is in English. | Must | BRF; Fieldnote project note | Inspection |
| DR-12 | The work shall be planned in a GitHub Project with issues that have an owner, a start date, a target date, a priority, an effort estimate and an area (infrastructure, backend, mobile app, dashboard, scheduler, security, documentation), and with one milestone for each of the four deliveries (pitch, first, second, final). | Must | MEM: Methodology | Inspection |
| DR-13 | Every code change shall go through a pull request reviewed by the other team member. | Should | MEM: Methodology | Inspection |
| DR-14 | The mobile app shall be tested on Android with Expo Go and Android devices of the team. | Must | MEM: Tools, Limitations | Demonstration |
| DR-15 | The failure scenarios shall be run by scripts in `infra/chaos/` while a load generator sends entries. Each script records the time to detection, the time to recovery, failed requests and lost entries. | Must | FM: Demonstration scenarios | Demonstration |
| DR-16 | The seven security tests of the security design shall be automated: no cross-study access for researchers, no cross-participant access, revoked token on every replica, expired signed URL, no coordinates in exported media, rate limits under load, and an export with no options. | Must | SEC: How the measures will be verified | Test |
| DR-17 | The demonstration and the tests shall use generated data. No personal data of real participants is processed during the course. | Must | SEC: Why security shapes the design; R00 | Inspection |
| DR-18 | Every diagram shall keep its editable source (Mermaid, PlantUML or Python) in the team's documentation workspace, outside the repository, and the repository shall hold only the SVG and PNG exports. PNG exports shall be at least 3000 px on the long side. | Should | Fieldnote project note; Atlas rules | Inspection |
| DR-19 | Documentation shall be written in Atlas first and published to the repository as a snapshot. Technical documentation shall state its status (proposed, implemented, verified). | Should | Atlas rules | Inspection |
| DR-20 | The final delivery shall include a one-page data protection summary for ethics committees that states where data is stored, who can see it, how long it is kept and how it is erased. | Should | SEC: Consent and ethics review; R06 | Inspection |
| DR-21 | The descriptive report shall be updated with the results of the failure tests and the scheduler evaluation as they exist. | Must | MEM; BRF | Inspection |
