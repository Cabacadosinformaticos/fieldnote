# Fieldnote

## Project title

Fieldnote: a distributed platform for mobile ethnography and diary studies

## Academic year

2026-2027

## Semester

5th semester

## Degree

BSc in Computer Engineering (Licenciatura em Engenharia Informática)\
IADE, Universidade Europeia

## Course units

- Projeto de Desenvolvimento de Software
- Engenharia de Software
- Sistemas Distribuídos
- Inteligência Artificial
- Segurança Informática

## Lecturers

| Course unit | Lecturers |
|---|---|
| Projeto de Desenvolvimento de Software | Rui Pascoal, Miguel Boavida |
| Engenharia de Software | Rui Ramos |
| Sistemas Distribuídos | Pedro Rosa |
| Inteligência Artificial | Samuel Gomes |
| Segurança Informática | Sérgio Nunes, Pedro Brandão |

## Students

| Full name | Student number | Degree | Year | Institutional contact |
|---|---|---|---|---|
| Tiago Manuel Antunes Cabaça | 20241185 | Computer Engineering | 3rd | To be added |
| César de Oliveira Rodrigues | 20240449 | Computer Engineering | 3rd | To be added |

## Keywords

Mobile ethnography, diary studies, distributed systems, fault tolerance, replication, constraint
satisfaction, offline-first mobile app, user research.

## Technologies

React Native, Expo, React, TypeScript, Python, FastAPI, PostgreSQL, Patroni, etcd, RabbitMQ,
Garage, Traefik, Tailscale, Docker Compose, Prometheus, Grafana. Proposed, pending
validation by the lecturers.

## Short summary

Fieldnote is a distributed platform for mobile ethnography and diary studies. Researchers create
studies and activities and follow participants in real time in a web dashboard. Participants
receive activities in a mobile app and record their experiences where and when they happen, as
text, photo, video or audio, with date, time and location. An entry recorded in the moment cannot
be collected again, so the backend runs as three logical nodes with a replicated database, message
broker and file storage, and keeps accepting entries when one node fails. The app stores entries
locally while offline and sends them later without duplicates. A constraint satisfaction solver
decides when to send each activity to each participant, within their availability and without
overloading the server.
