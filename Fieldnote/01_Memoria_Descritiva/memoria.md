# Descriptive report: Fieldnote

Version 2, 11 November 2026 (second delivery). The platform is built and runs as a working prototype;
this version describes it as built. The phone fault test (FS8) is the only scenario still to run.

## Identification

| | |
|---|---|
| Project name | Fieldnote |
| Academic year | 2026-2027 |
| Semester | 5th semester |
| Degree | BSc in Computer Engineering (Licenciatura em Engenharia Informática), IADE, Universidade Europeia |

### Course units and lecturers

| Course unit | Lecturers |
|---|---|
| Projeto de Desenvolvimento de Software | Rui Pascoal, Miguel Boavida |
| Engenharia de Software | Rui Ramos |
| Sistemas Distribuídos | Pedro Rosa |
| Inteligência Artificial | Samuel Gomes |
| Segurança Informática | Sérgio Nunes, Pedro Brandão |

### Students

| Full name | Student number | Degree | Curricular year | Institutional contact |
|---|---|---|---|---|
| Tiago Manuel Antunes Cabaça | 20241185 | Computer Engineering | 3rd | 20241185@iade.pt |
| César de Oliveira Rodrigues | 20240449 | Computer Engineering | 3rd | 20240449@iade.pt |

## Summary

Fieldnote is a distributed platform for mobile ethnography and diary studies. Participants use their phones to record experiences where and when they happen, over days or weeks, following activities set by a researcher. An entry recorded in the moment cannot be collected again, so losing one means losing the data point. This is why the system is distributed and fault tolerant.

The platform is built and runs. Researchers use a web dashboard to create studies and activities, invite participants with personal codes, poster codes or a volunteer pool, follow entries and adherence in real time, tag entries and export the data. Participants use an Android app to join a study by QR code or typed code, accept the consent, receive prompts and record text, photo, video, audio, scale or choice entries with date, time and, when the study asks for it, location. The app keeps entries in a local queue while offline and resends them without duplicates. Administrators manage researcher accounts, the audit log and data erasure.

The backend runs as three logical nodes on one virtual machine, reached through two Tailscale gateways with HTTPS. Each node holds an API replica and one member of each data cluster: PostgreSQL with Patroni, RabbitMQ with quorum queues and Garage object storage with three copies of every file. We tested eleven failure scenarios with scripts. Ten pass, nine of them on the server: the database leader is replaced in 23.8 s, a gateway failure loses none of 120 entries sent from ten simulated phones, the loss of a storage node loses none of 45 photo entries, and a standby scheduler takes over in 15.2 s. The restore of the encrypted backup also passes. The phone in airplane mode is still to be run. The whole stack starts with Docker Compose and is monitored with Prometheus and Grafana.

The artificial intelligence component is a constraint satisfaction scheduler implemented from scratch, with backtracking, forward checking, MRV, LCV and AC-3, which decides when to prompt each participant. On generated studies of up to 100 participants it breaks no constraint, while fixed-hour prompting overloads slots and breaks minimum gaps. On 300 small studies it matched an exhaustive search every time. AC-3 reports the clashes of minimum gaps and leaves to the search the choice of which prompt to drop. The scheduler also weighs load by entry type and shares capacity across studies.

Security measures include Argon2id passwords, account lockout, time-limited signed media URLs, removal of location metadata from media, an audit log, encrypted backups and erasure of participant data.

The main limits are that the three nodes share one machine, the app was built for Android only, and rate limiting is not implemented.

## Context

### Problem

Researchers in user experience, service design, marketing and the social sciences run diary
studies to understand how people live with a product, a service or a place. In our own
institution, UNIDCOM/IADE, the design and communication research unit of IADE, works with
ethnographic, user-research and service-design methods, and the team learned through informal
contact that it would use an application for mobile ethnography and diary studies. The project uses that need to ground its
requirements; the course briefing does not mention UNIDCOM, and the link is the team's framing. General-purpose tools
such as forms, messaging apps or email do not schedule activities, do not capture context such as
time and location in a structured way, and spread personal data across several services.
Commercial platforms such as Indeemo, dscout and EthOS offer this as a hosted service run by the
vendor, which keeps the data in the vendor's infrastructure. A research unit that must answer to
an ethics committee for where participants' photos and voices are stored has a reason to run the
platform itself, and then the platform, not a vendor, has to guarantee that no entry is lost. The
research behind the method, the platforms that exist and the design choices is in
`06_Dados_Investigacao` (nine research files with an index); file
`08-from-research-to-design.md` summarises how it changed the design.

### Motivation

The project brings together the five course units of the semester in one system with a real use.
It gives the distributed systems work a concrete reason to exist (entries that cannot be recorded
twice), gives the artificial intelligence work a problem the product needs solved (when to ask),
and handles personal data that justifies the security work.

### Objectives

- Build a platform where researchers run diary studies and participants record entries with a
  mobile app, including offline recording.
- Keep the service available and without loss of confirmed entries when one logical node, the
  database primary, a storage node or a broker node fails, and demonstrate it with failure tests.
- Plan activity prompts with a constraint satisfaction solver implemented by the team.
- Protect participant data with authentication, access control, pseudonymisation and auditing.
- Document the work in the archive structure required by the course.

## Process

### Methodology

The team works in an agile, iterative way, with the plan kept in a GitHub Project linked to the
repository:

- Every task is an issue with an owner, a start date, a target date, a priority and an effort
  estimate, grouped by area (infrastructure, backend, mobile app, dashboard, scheduler, security,
  documentation).
- Each of the four deliveries (pitch, first, second and final) is a milestone, and the tasks are
  planned backwards from its date.
- The board shows what is to do, in progress and done. The team updates it as the work moves and
  reviews it before each delivery to adjust the plan.
- Both members commit to the repository, so each one's contribution is visible in the history.

### Tools

| Tool | Use |
|---|---|
| Git and GitHub | Version control and issues |
| GitHub Projects | Backlog, task owners and dates, milestones, board |
| Docker and Docker Compose | Running the whole stack on the server or on a laptop |
| Visual Studio Code | Development |
| Figma | Mockups of the app and the portal (68 screens) |
| Mermaid, PlantUML and Graphviz | Diagrams: concept map, use cases, architecture, deployment, data model, sequences |
| uv, pytest and Alembic | Python environments, automated tests and database migrations |
| Expo, EAS and the Android emulator | Building and testing the mobile app; `adb` drives the phone fault test |
| Prometheus and Grafana | Monitoring during the failure tests |
| Failure scripts and load generator | `infra/chaos` injects the faults; `tools/loadgen` sends entries from simulated phones and counts losses and duplicates |

### Technologies

| Layer | Technologies |
|---|---|
| Mobile app | React Native, Expo, TypeScript, SQLite |
| Web dashboard | React, Vite, TypeScript |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic; server-sent events for the live dashboard |
| Scheduler | Python, constraint satisfaction solver written by the team |
| Database | PostgreSQL 17, Patroni, etcd |
| Messaging | RabbitMQ with quorum queues |
| File storage | Garage (S3 compatible) |
| Media processing | ffmpeg, an open-source tool that converts audio and video; used to make thumbnails and to convert phone videos to one format that plays everywhere |
| Access and routing | Tailscale (two gateway containers with HTTPS), Traefik |
| Push notifications | Expo Push |
| Backup | Encrypted archives (AES-256-GCM) of the database and the media bucket |

The design was reviewed by the lecturers during the first delivery: the Artificial Intelligence lecturer approved the
scheduler on 1 October 2026, the Distributed Systems lecturer approved the architecture and the
stack on 5 October 2026, the Software Engineering lecturer approved the project on 7 October
2026, and the Projeto de Desenvolvimento de Software lecturer approved the whole repository, from
the UML models to the stack. The security design still waits for validation by the Information
Security lecturers.

### Team structure

| Member | Main responsibilities |
|---|---|
| Tiago Manuel Antunes Cabaça | Infrastructure and failure tests, API and data model, offline synchronisation in the app, scheduler, security |
| César de Oliveira Rodrigues | Researcher and administrator dashboard, app screens, requirements and UML with Tiago, archive and images |

## Results

### Description of the solution

Fieldnote is a working prototype. It runs on the team's own server as one virtual machine with
three logical nodes, and the same project starts on a laptop with Docker Compose.

| Part | What it does |
|---|---|
| `services/api` | FastAPI REST API: studies, activities, participants, entries, signed upload URLs, server-sent events for the live dashboard, export, audit log, erasure; an outbox relay publishes events to RabbitMQ without losing any between the database and the broker |
| `services/scheduler` | Constraint satisfaction planner and push notifications; two replicas, one holds a lease and the other takes over if it fails |
| `services/media-worker` | ffmpeg thumbnails, video conversion to one format and removal of location metadata from media |
| `services/backup` | Daily encrypted archive (AES-256-GCM) of the database and the media bucket, with restore |
| `apps/dashboard` | React dashboard for researchers and administrators, served by the API replicas |
| `apps/mobile` | Expo app with a local SQLite queue; it knows both gateways and retries on the second when the first fails |
| `infra/deploy` | Compose projects for development and for the cluster: Patroni and etcd, RabbitMQ quorum queues, Garage with three zones, three API replicas, two Tailscale gateways, Prometheus and Grafana |
| `infra/chaos`, `tools/loadgen`, `tools/demo-data` | Failure scripts, a load generator that reports lost or duplicated entries, and a seeded demonstration study |

The design is documented in `04_Documentacao_Tecnica` and the 68 mockups of the app and the portal
are in `05_Artefactos/mockups`.

### Main features

- Researchers create studies and activities, invite participants with personal codes, poster
  codes (with optional approval) or the volunteer pool, follow adherence and entries live, tag
  and filter entries, and export CSV tables with the media, all of it or by type.
- Participants join by QR code or typed code, accept the consent, declare availability, receive
  prompts and record text, photo, video, audio, scale or choice entries with time and location.
  They can join several studies, create an optional account, leave a study and erase their data.
- Administrators manage researcher accounts, read the audit log, see the volunteer pool in
  aggregate and handle erasure requests, confirmed with a one-time code.
- Entries carry a UUID created on the phone, so a resend after a failure never duplicates one.

Fault tolerance was measured with the failure scripts on the server. Ten of eleven scenarios
pass:

| Scenario | Measured result |
|---|---|
| Kill an API container | Both gateways answer again in under 2 s |
| Kill the database leader | New leader in 23.8 s; the old one returns as a replica |
| Kill the synchronous replica | New synchronous replica in 9.9 s, no failed request |
| Stop a whole node | The other two keep the leader and a synchronous replica; the node rejoins in 9.3 s |
| Kill a broker node | Out of the active set in 0.7 s; rejoins in 5.6 s |
| Cut a node off the network | The remaining pair keep working; the node rejoins 4.3 s after reconnection |
| Kill a storage node during uploads | 45 photo entries sent, 45 confirmed, none lost or duplicated |
| Stop gateway 1 under ten simulated phones | Clients switch to gateway 2; 120 sent, 120 confirmed |
| Kill the active scheduler | The standby takes over in 15.2 s, no duplicate plan |
| Restore the encrypted backup | Passes on the development stack |

The eleventh scenario, a phone in airplane mode, still has to be run with a real phone.

### Relevant contributions

- One system that joins the five course units, with a traceability matrix from each requirement
  to use cases, design and verification.
- The constraint satisfaction scheduler, written from scratch with backtracking, forward
  checking, MRV, LCV, AC-3 and branch and bound. The evaluation suite
  (`services/scheduler/evaluation/results.md`) is reproducible. On generated studies of 10, 50 and
  100 participants the scheduler breaks no constraint. At 100 participants it plans 332 prompts
  with no slot over its cap and no minimum gap broken, while fixed-hour prompting plans 258, puts
  173 prompts above the slot cap and breaks 246 minimum gaps. On 300 small studies it reached the
  optimum of an exhaustive search every time.
- AC-3 finds the clashes of minimum gaps before the search, while the choice of which prompt
  to leave out stays with the search, which maximises the planned prompts.
- Load weighted by entry type (video 5, photo 2, audio 2, others 1) and a capacity per slot shared
  across running studies. At 100 participants it halves the weighted peak from 82 to 41 without
  losing a prompt.
- Participant privacy by design: identity apart from entries, pseudonymous participants, the pool
  shown only in counts, and erasure that also reaches the backups. Passwords use Argon2id and
  accounts lock after repeated failures. Media URLs are signed and short-lived, location metadata
  is removed from media, and the audit log records the actions of staff accounts.
- Supporting research that changed the design: entries keep both the recording time and the
  arrival time, because declared and real adherence to paper diaries differed (Stone et al.,
  2002, cited in `06_Dados_Investigacao`).

## Reflection

### Lessons learned

- A design claim is not a working system until someone runs it. The architecture said the API
  replicas serve the dashboard, but nothing did until the first deployment. Then a relative
  directory setting broke the asset paths. Both are fixed and tested.
- Deploying exposed things the laptop hid. A Tailscale container gives up an interactive login
  after 60 s and restarts with a new link, so the first links expired. Logging in once with
  `tailscaled` on the same state volume and then starting the gateways worked.
- Test tools break too. The load generator expected a 200 reply where the API answered 204, which
  made two fault scenarios fail even though the cluster was fine. Reading the failure before
  blaming the cluster saved time.
- Tool versions drift between machines. One machine had an older TypeScript in `node_modules` than
  the lock file, so errors from the newer version appeared only on a clean install, and the code
  had to be guarded for it. A clean install from the lock file before building is the answer.
- An exhaustive search on tiny studies is a cheap oracle. Comparing the scheduler with it on
  hundreds of small studies gives a quality figure that a single example cannot.
- Measuring beats believing. Numbers from the failure scripts replaced claims, and several
  targets turned out to be met with room to spare.
- With two people, the critical chain (infrastructure, backend, security and scheduler) rests on
  one of them. A closed scope, priorities and the other member owning the dashboard and the app
  screens kept it manageable.

### Limitations

- The three nodes are logical and share one virtual machine. Losing that machine, its power or
  its network link is outside the fault model, and starting the stack elsewhere is manual.
- Network failures are simulated by cutting one node off from the other two. Packet loss,
  latency and other partitions are not tested.
- The phone fault test (FS8) has not run yet. The camera and microphone were tested only on the
  emulator, and push notifications need the Firebase key in the Expo project.
- The app is built and tested for Android only.
- Access is limited to devices on the project's Tailscale network.
- Rate limiting of the API is not implemented, and objects left in storage by uploads that never
  completed are not cleaned up.
- Entries still in the app queue are lost if the app is uninstalled before they are sent.
- Most scheduler searches end at their node budget, so the plan is the best found, not a proven
  optimum. Its effect on participants' response rates is not measured, because that needs a real
  study.

### Future work

- Run FS8 with a phone, and give each logical node its own virtual machine for the final delivery.
- Add rate limiting and the cleanup of orphan uploads.
- Stream the export instead of building it whole.
- A lower bound for branch and bound from the AC-3 clashes.
- Predict the chance that a participant answers at a given time from their history, and use it in
  the scheduler.
- Include the media processing queue in the load model, and adjust planned prompts to live phone
  context within their slot.
- Transcription of audio entries, a map of the entries of a study, and activities triggered by
  arriving at a place.
- Automatic anonymisation of faces in exported photos.
- Opening the platform to participants outside the project's private network.
- Follow-up questions from the researcher on a single entry, and letting participants complete an
  entry later.
