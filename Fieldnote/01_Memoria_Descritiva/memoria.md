# Descriptive report: Fieldnote

Version 1, 30 September 2026. The project is at the design stage: nothing is implemented yet.
The results and reflection sections will be written as the work progresses.

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

Fieldnote is a distributed platform for mobile ethnography and diary studies. In these studies,
participants use their phones to record experiences where and when they happen, over days or
weeks, following activities set by a researcher. A study might ask participants to photograph a
product they use every day, record thirty seconds of audio after a commute, or answer a short
question after lunch.

The platform has two sides. Researchers use a web dashboard to create studies, define activities
and the rules for when to ask for them, invite participants, follow adherence and incoming entries
in real time, organise entries with tags, and export the data. Participants use a mobile app to
join a study, accept the informed consent, receive activities and record entries as text, photo,
video, audio, a scale or a multiple choice answer, with date, time and, when the study asks for it,
location. Administrators manage researcher accounts, oversee studies and handle data erasure
requests.

An entry recorded in the moment cannot be collected again later, so losing one means losing the
data point. This is why the system is distributed and fault tolerant. The backend runs as three
logical nodes on one Docker host. Each node runs an API replica and one member of each data
cluster: PostgreSQL with automatic failover through Patroni, a RabbitMQ message broker with
replicated queues, and Garage object storage keeping three copies of every file. The system is
designed to keep receiving entries when any one node fails, and not to lose an entry once it has
been confirmed to the participant. The app keeps entries in a local queue while there is no
network and resends them later without creating duplicates.

The artificial intelligence component is the scheduler. Deciding when to ask each participant for
each activity is modelled as a constraint satisfaction problem: participant availability, activity
time windows, minimum gaps between prompts, daily limits and a cap on simultaneous prompts that
spreads the upload load. The team implements backtracking search with the MRV and LCV heuristics,
forward checking and AC-3, and compares the result with the fixed-time schedules many diary tools
use.

Security measures cover authentication and roles, pseudonymised participants, signed and
short-lived media URLs, removal of location metadata from photos, an audit log and data erasure.

The work is planned in a GitHub Project with a backlog, owners and dates for each task, and
milestones for each delivery. The fault tolerance will be demonstrated by injecting failures with
scripts (stopping containers, whole nodes, the database primary, a storage node, and cutting a
node off the network) and measuring detection time, recovery time and lost entries.

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
- Code changes go through pull requests reviewed by the other team member.

### Tools

| Tool | Use |
|---|---|
| Git and GitHub | Version control, issues, pull requests |
| GitHub Projects | Backlog, task owners and dates, milestones, board |
| Docker and Docker Compose | Running the whole stack on the server or on a laptop |
| Visual Studio Code | Development |
| Mermaid, PlantUML and Graphviz | Diagrams: concept map, use cases, architecture, deployment, data model, sequences |
| Expo Go and Android devices | Testing the mobile app |
| Prometheus and Grafana | Monitoring during the failure tests |

### Technologies

| Layer | Technologies |
|---|---|
| Mobile app | React Native, Expo, TypeScript, SQLite |
| Web dashboard | React, Vite, TypeScript |
| Backend | Python 3.12, FastAPI |
| Scheduler | Python, constraint satisfaction algorithms implemented by the team |
| Database | PostgreSQL 17, Patroni, etcd |
| Messaging | RabbitMQ with quorum queues |
| File storage | Garage (S3 compatible) |
| Media processing | ffmpeg, an open-source tool that converts audio and video; used to make thumbnails and to convert phone videos to one format that plays everywhere |
| Access and routing | Tailscale, Traefik |
| Push notifications | Expo Push |

The stack is a proposal and still needs validation by the lecturers of Projeto de Desenvolvimento
de Software and Sistemas Distribuídos.

### Team structure

| Member | Main responsibilities |
|---|---|
| Tiago Manuel Antunes Cabaça | Infrastructure and failure tests, API and data model, offline synchronisation in the app, scheduler, security |
| César de Oliveira Rodrigues | Researcher and administrator dashboard, app screens, requirements and UML with Tiago, archive and images |

## Results

None yet. The design is documented in `04_Documentacao_Tecnica` (architecture, fault model, data
model, scheduler and security); results will be described here once the platform is built and
tested.

## Reflection

### Lessons learned

To be written as the project progresses.

### Limitations

- The three logical nodes share one physical host. The loss of that host, its power or its
  network link is outside the fault model. The stack can be started on another machine, but that
  is a manual recovery.
- Network failures are simulated by cutting one node off from the other two. Packet loss,
  latency and other partition shapes are not tested.
- Access is limited to devices on the project's Tailscale network.
- Push notifications depend on an external service.
- Entries still in the app queue are lost if the app is uninstalled before they are sent.
- The app will be tested on Android only.
- The scheduler is evaluated on plan quality, load spread and solve time with generated studies.
  Its effect on participants' response rates is not measured, because that needs a real study.
  The team may run a few small tests with people, never at the scale of a real study, and promises
  no results from them.

### Future work

- Predict the chance that a participant answers at a given time from their history, and use it in
  the scheduler.
- Transcription of audio entries.
- A map of the entries of a study.
- Activities triggered by arriving at a place.
- Automatic anonymisation of faces in exported photos.
- Moving each logical node to its own machine.
- Opening the platform to participants outside the project's private network.
- Adjusting planned prompts to live phone context within their slot.
- Follow-up questions from the researcher on a single entry, and letting participants complete an
  entry later.
