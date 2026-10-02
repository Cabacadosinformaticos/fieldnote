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
