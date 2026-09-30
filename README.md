<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img src=".github/assets/logo-light.svg" alt="Fieldnote" width="420">
  </picture>
</p>

<p align="center">
  Distributed, fault-tolerant platform for mobile ethnography and diary studies.
</p>

<p align="center">
  <img alt="Status: design stage" src="https://img.shields.io/badge/status-design%20stage-orange">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python%203.12-3776AB?logo=python&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-20232A?logo=react&logoColor=61DAFB">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL%2017-4169E1?logo=postgresql&logoColor=white">
  <img alt="RabbitMQ" src="https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker%20Compose-2496ED?logo=docker&logoColor=white">
  <img alt="Tailscale" src="https://img.shields.io/badge/Tailscale-242424?logo=tailscale&logoColor=white">
</p>

Researchers create studies, define activities and follow participants in real time. Participants
use a mobile app to receive activities and record their experiences where and when they happen,
as text, photo, video or audio, with time and location attached.

L-EI multidisciplinary project, 2026-2027: 5th semester of the BSc in Computer Engineering at
IADE, Universidade Europeia. Based on proposal 11 of the project briefing ("Plataforma
Distribuída para Mobile Ethnography e Diary Studies").

## Status

Design stage. No component is implemented yet; everything below describes the planned system. The
work plan, with owners and dates for every task, is in the
[Fieldnote - Master Plan](https://github.com/users/Cabacadosinformaticos/projects/7) project.

| Delivery | Date | Scope |
|---|---|---|
| Pitch | 7 October 2026 | Idea, mockups and use cases |
| First delivery | 9 October 2026 | Requirements, architecture, fault model, descriptive report |
| Second delivery | 13 November 2026 | Working prototype of the distributed stack, app and dashboard |
| Final delivery | 18 December 2026 | Complete platform and fault tolerance demonstration |

## Why a distributed system

An entry recorded in the moment cannot be collected again later. If the platform loses it, the
data point is gone. Answers also arrive in bursts, often with photos, audio or video, whenever an
activity goes out to many participants at once, and a study runs for weeks without a maintenance
window. Fieldnote therefore replicates its services, database, message broker and file storage,
and the app keeps entries in a local queue while it has no network.

## Planned features

| Participant (mobile app) | Researcher (web dashboard) | Administrator |
|---|---|---|
| Join a study with an invite code | Create and configure studies | Manage researcher accounts |
| Accept the informed consent | Define activities and schedule rules | Oversee all studies |
| Declare daily availability | Invite participants | Consult the audit log |
| Receive activities | Follow adherence and entries in real time | Handle data erasure requests |
| Record text, photo, video, audio, scale or choice entries with time and location | Tag and filter entries | |
| Record offline and send later | Export data as CSV with a media archive | |

## Architecture in brief

The backend runs with Docker Compose on one host, split into three logical nodes. Each node has an
API replica and one member of each data cluster, so stopping all the containers of one node
simulates the loss of a machine. The same project runs on a laptop if the server is unavailable.
Diagrams: [component architecture and deployment](Fieldnote/04_Documentacao_Tecnica/architecture.md),
[all figures with captions](Fieldnote/02_Imagens/captions.md).

| Concern | Design |
|---|---|
| Failures tolerated | Any one logical node out of three, or any single container |
| Database | PostgreSQL with Patroni and etcd: automatic failover, strict synchronous replication to one replica, no confirmed entry lost |
| Files | Garage object storage, 3 copies of every file, writes confirmed after 2 |
| Messaging | RabbitMQ quorum queues on 3 nodes; a transactional outbox so no event is lost between the database and the broker |
| Duplicates | Entries carry a UUID created on the phone, so resends after a failure never create duplicates |
| Access | Tailscale private network with two gateways; clients switch to the second if the first fails |

The artificial intelligence component plans when to send each activity to each participant as a
constraint satisfaction problem ([scheduler](Fieldnote/04_Documentacao_Tecnica/scheduler.md)).
Security measures are in [security](Fieldnote/04_Documentacao_Tecnica/security.md), and the
failures that will be demonstrated in the [fault model](Fieldnote/04_Documentacao_Tecnica/fault-model.md).

## Technology stack

| Layer | Technologies |
|---|---|
| Mobile app | React Native, Expo, TypeScript, SQLite |
| Web dashboard | React, Vite, TypeScript |
| Backend and scheduler | Python 3.12, FastAPI |
| Database | PostgreSQL 17, Patroni, etcd |
| Messaging | RabbitMQ |
| File storage | Garage (S3 compatible) |
| Media processing | ffmpeg |
| Access and routing | Tailscale, Traefik |
| Deployment and monitoring | Docker Compose, Prometheus, Grafana |

The stack is a proposal pending validation by the course lecturers.

## Documentation

| Document | Contents |
|---|---|
| [Descriptive report](Fieldnote/01_Memoria_Descritiva/memoria.md) | Summary, context, process, team |
| [Research](Fieldnote/06_Dados_Investigacao/README.md) | Research context (UNIDCOM/IADE), diary studies, mobile ethnography, existing platforms, prompt timing, fault tolerance, privacy, network access, and how the research changed the design |
| [Architecture](Fieldnote/04_Documentacao_Tecnica/architecture.md) | Components, deployment, consistency decisions |
| [Fault model](Fieldnote/04_Documentacao_Tecnica/fault-model.md) | Guarantees, detection, recovery, demonstration scenarios |
| [Data model](Fieldnote/04_Documentacao_Tecnica/data-model.md) | Entities, participant identity, design notes |
| [Scheduler](Fieldnote/04_Documentacao_Tecnica/scheduler.md) | Constraint satisfaction formulation and evaluation |
| [Security](Fieldnote/04_Documentacao_Tecnica/security.md) | Assets and planned measures |
| [Figures](Fieldnote/02_Imagens/captions.md) | Every figure with its caption |

## Repository layout

```text
fieldnote/
├── apps/                         client applications
│   ├── mobile/                   participant app: React Native + Expo, offline queue in SQLite
│   └── dashboard/                researcher and administrator web dashboard: React + Vite
├── services/                     backend services, Python 3.12
│   ├── api/                      REST API, signed upload URLs, server-sent events, outbox relay
│   ├── scheduler/                constraint satisfaction planner and push notifications
│   └── media-worker/             ffmpeg thumbnails, video conversion, metadata removal
├── infra/
│   ├── deploy/                   Docker Compose project: three logical nodes, networks, gateways
│   └── chaos/                    failure injection scripts for the fault tolerance demonstration
├── Fieldnote/                    project archive, folder names fixed by the course briefing
│   ├── 00_Identificacao/         info.md: project metadata, team, keywords, short summary
│   ├── 01_Memoria_Descritiva/    memoria.md: the descriptive report
│   ├── 02_Imagens/               figures (PNG, 3000 px or more) and their captions
│   ├── 03_Videos/                demonstration and presentation videos
│   ├── 04_Documentacao_Tecnica/  architecture, fault model, data model, scheduler, security, diagram sources
│   ├── 05_Artefactos/            other artefacts produced during the project
│   ├── 06_Dados_Investigacao/    research files, one per subject
│   └── 07_Autorizacoes/          consents and authorisations
├── .github/assets/               logo
├── LICENSE
└── README.md
```

The application folders are empty until implementation starts. The archive folder names are in
Portuguese because the course briefing fixes them; their content is in English.

## Team

| Name | Student number | Main areas |
|---|---|---|
| Tiago Manuel Antunes Cabaça | 20241185 | Infrastructure, backend, offline sync, scheduler, security |
| César de Oliveira Rodrigues | 20240449 | Dashboard, app screens, UML, project archive |

BSc in Computer Engineering (Licenciatura em Engenharia Informática)\
IADE, Universidade Europeia

## Course units and lecturers

| Course unit | Lecturers | Focus in this project |
|---|---|---|
| Projeto de Desenvolvimento de Software | Rui Pascoal, Miguel Boavida | Planning, process, deliveries |
| Engenharia de Software | Rui Ramos | Requirements and modelling |
| Sistemas Distribuídos | Pedro Rosa | Distributed architecture, replication, fault tolerance |
| Inteligência Artificial | Samuel Gomes | Activity scheduling as a constraint satisfaction problem |
| Segurança Informática | Sérgio Nunes, Pedro Brandão | Authentication, access control, protection of research data |

## License

MIT. See [LICENSE](LICENSE).
