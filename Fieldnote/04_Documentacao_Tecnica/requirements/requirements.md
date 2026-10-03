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
