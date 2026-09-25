# Fieldnote

Distributed, fault-tolerant platform for mobile ethnography and diary studies.

Researchers create studies, define activities and follow participants in real time. Participants
use a mobile app to receive activities and record their experiences, where and when they happen,
as text, photo, video or audio, with location and time attached.

Multidisciplinary project of the 5th semester of the Computer Engineering degree (L-EI),
Universidade Europeia / IADE, academic year 2026-2027. Based on proposal 11 of the project
briefing ("Plataforma Distribuída para Mobile Ethnography e Diary Studies").

## Status

Analysis and design phase. No component is implemented yet.

## Repository layout

| Path | Contents |
|---|---|
| `Fieldnote/` | Project archive in the structure required by the course (identification, descriptive report, images, videos, technical documentation, artefacts, research data, authorisations) |
| `apps/mobile/` | Participant mobile app |
| `apps/dashboard/` | Researcher web dashboard |
| `services/api/` | Core API: studies, activities, participants, entries |
| `services/scheduler/` | Activity scheduling (constraint satisfaction) |
| `services/insights/` | Machine learning over collected entries |
| `infra/deploy/` | Deployment of the distributed stack |
| `infra/chaos/` | Fault injection scripts for the fault tolerance demonstration |

## Course units

| Unit | Focus in this project |
|---|---|
| Projeto de Desenvolvimento de Software | Planning, agile process, delivery |
| Engenharia de Software | Requirements and modelling |
| Sistemas Distribuídos | Distributed architecture, replication, fault tolerance |
| Inteligência Artificial | Scheduling as a constraint satisfaction problem, machine learning |
| Segurança Informática | Authentication, access control, protection of research data |

## Team

- Tiago Manuel Antunes Cabaça (20241185)
- César de Oliveira Rodrigues (20240449)

## License

MIT. See [LICENSE](LICENSE).
