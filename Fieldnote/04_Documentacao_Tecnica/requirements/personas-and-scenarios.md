# Personas and scenarios

Status: proposed, 1 October 2026. The personas and scenarios are fictional. They are built from the
research files (`06_Dados_Investigacao/00` to `06_Dados_Investigacao/08`) and the design documents, they describe no real
person, and they are not data from users. The platform is not implemented, so the scenarios describe
how the designed system shall behave. Requirement IDs refer to [requirements](requirements.md) and
use case IDs to [use cases](use-cases.md).

## Personas

### Inês, design researcher

| Field | Content |
|---|---|
| Role | Researcher in a design and communication research unit, comparable to UNIDCOM/IADE, who studies how people use places and services |
| Context | Runs a two-week, place-based diary study on how residents use a public square. Works with a doctoral student and has a small budget and no technical staff of her own |
| Goals | Ask for a few short photo, text or audio entries a day at varied times of the day. See at once who is answering and who is not. Take the data to her qualitative analysis software without exposing participants |
| Concerns | Her ethics committee asks where photos and voices are stored and who can see them. A day lost by a participant is a day she cannot collect again |
| Technical level | Comfortable with web tools. Does not administer servers and should not need to |
| What she needs from Fieldnote | Study and activity set-up with schedule style (FR-22, FR-24, FR-25), real-time follow (FR-31, FR-32), tags (FR-37), export with safe defaults (FR-64, FR-65), data kept on the institution's own infrastructure (NFR-59) |

### Tomás, participant

| Field | Content |
|---|---|
| Role | Resident of the neighbourhood who joins Inês's study |
| Context | Android phone, travels by metro and walks through areas with weak signal. Speaks Portuguese. Prefers to take a photo and add a few words over typing or recording a long audio |
| Goals | Answer quickly when the activity arrives, without creating an account. Know that what he recorded was sent |
| Concerns | Photos of the square may include other people and his own home. He wants to know what happens to his data and how to have it removed |
| Technical level | Uses his phone daily. Does not want to manage passwords for a study |
| What he needs from Fieldnote | Joining with a code (FR-01), consent and interface in Portuguese (FR-03, FR-04), offline recording and resend (FR-15, FR-16), a count of entries waiting (FR-18), notifications without personal data (NFR-52) |

### Carla, platform administrator

| Field | Content |
|---|---|
| Role | Administrator of the platform for the research unit |
| Context | Part-time technical role. Creates researcher accounts, answers erasure requests and checks the audit log. Starts the stack and watches monitoring during incidents |
| Goals | Give the right people access and remove it when they leave. Show an ethics committee who read or exported what. Recover when a machine fails |
| Concerns | A single compromised administrator account would expose every study. Erasure has to reach every copy |
| Technical level | Comfortable with Docker and command lines |
| What she needs from Fieldnote | Account management (FR-41), audit log (FR-43, FR-68), erasure (FR-44, NFR-44), TOTP (NFR-37), backups and restore (NFR-13, NFR-14), monitoring (NFR-15) |

### Duarte, co-researcher

| Field | Content |
|---|---|
| Role | Doctoral student who collaborates in Inês's study, as a member but not the owner |
| Context | Reads entries every day, groups them by theme and prepares the analysis |
| Goals | Filter entries by participant, activity and tag. See when an entry was recorded and when it arrived. Export a table he can code in his analysis software |
| Concerns | Must not see the identity of participants: it is visible only to the study owner and administrators |
| Technical level | Comfortable with spreadsheets and qualitative analysis software |
| What he needs from Fieldnote | Collaborator access (FR-23), entry list with both timestamps and filters (FR-33), tags (FR-37), CSV export (FR-64), access limited to his study (FR-30, NFR-38) |

## Scenarios

### Scenario 1: Inês sets up a study and chooses a schedule style

Actors: Inês. Use cases: UC8, UC9, UC9b, UC10. Requirements: FR-22 to FR-28, FR-45 to FR-52.

1. Inês signs in to the dashboard and creates the study "Everyday life in the square", with the time zone of Lisbon, 14 participants planned and the schedule style `varied`, because she wants entries from different parts of the day.
2. She sets `max_prompts_per_day` to 3. The dashboard suggests a `max_prompts_per_slot` from the number of participants and their availability, and she accepts it.
3. She adds Duarte as a collaborator.
4. She defines an activity "A moment in the square". It accepts photo or text, has an expected effort of 3 minutes, requests location, allows free entries up to 2 a day, and carries an instruction that asks participants not to photograph people who have not agreed or house numbers.
5. She sets the window from 08:00 to 22:00, 2 prompts a day and a minimum gap of 120 minutes. The dashboard shows the expected effort per participant and per day.
6. She saves. The scheduler plans the next day that night, with 15-minute slots, and stops after 10 s per study at the latest.
7. She adds each participant with an alias and gets one invite code for each. She sends the codes outside the platform.

Result: The study is ready. The next morning the dashboard shows the planned prompts and any left `unplanned`, with their reasons.

### Scenario 2: Tomás joins with an invite code and accepts consent in Portuguese

Actors: Tomás. Use cases: UC1, UC2, UC3. Requirements: FR-01 to FR-05, NFR-57.

1. Tomás installs the app on his Android phone and chooses Portuguese.
2. He types the 10-character code. The API accepts it, issues a device token and invalidates the code. The app keeps the token in the phone's secure storage.
3. The app shows the consent text in Portuguese. It explains what is collected, that backups keep erased data for up to 7 days, and what not to record.
4. He accepts. The API stores the accepted version and the time.
5. He declares that he accepts prompts between 09:00 and 20:00.
6. He is asked for no email address and no password.

Result: He is a participant under an alias, and the next nightly plan uses his hours. If he had declined the consent, no prompt would reach him.

### Scenario 3: Tomás records a photo with no signal and sends it later

Actors: Tomás, push notification service. Use cases: UC4, UC5, UC5b, UC6, UC7. Requirements: FR-06 to FR-18, FR-55 to FR-57.

1. At the planned time, a notification says that a new activity is available. It carries no study or personal data.
2. Tomás is in the metro. He opens the app, which shows the activity and the instruction.
3. He takes a photo and adds a short text. Because the activity requests location, the app asks for permission and attaches the coordinates. The app creates the entry UUID and a hash of the content and stores the entry, with `recorded_at`, in its local queue.
4. The app shows "1 entry waiting to be sent".
5. An hour later the phone has signal. The app asks the API for a signed upload URL, sends the photo straight to object storage, then sends the entry with the same UUID.
6. The API checks that the file exists, writes the entry and waits for the synchronous commit. It answers 200. The app removes the entry from the queue and Tomás sees it as sent in his list.
7. The first resend had timed out on a weak connection, so the app sent the entry a second time. The API recognised the same UUID and hash and answered 200 without creating a duplicate.

Result: One entry exists, with its original recording time and a later `received_at`. The media worker creates the thumbnail in the background.

### Scenario 4: Inês and Duarte follow adherence, tag entries and export

Actors: Inês, Duarte. Use cases: UC11, UC12, UC13, UC16. Requirements: FR-31 to FR-37, FR-64 to FR-67.

1. In the second week Inês opens the dashboard. New entries appear without reloading. The adherence table shows, for each participant and day, the prompts planned, shown, opened and answered.
2. She sees that one participant opens prompts but answers few. She checks the unplanned prompts, which show their reasons, and decides to talk to the participant.
3. Duarte filters the entries by activity and date. He sees `recorded_at` and `received_at` for each, and notices that some entries arrived hours after they were recorded, which matches participants with weak signal.
4. He creates the tags "crowded" and "quiet" and attaches them to entries. He then filters by tag.
5. He starts an export with no options selected. The CSV holds the alias, activity, prompt, entry type, content, `recorded_at` and `received_at` for each entry. It has no names, no coordinates and no media files.
6. For one analysis Inês needs the locations. She starts a second export and selects location. The platform records both exports in the audit log with the content chosen.

Result: The analysis file is pseudonymous by default, and the choice to include location is a visible, audited step.

### Scenario 5: A participant asks to have the data erased

Actors: Tomás, Inês, Carla. Use cases: UC17, UC16. Requirements: FR-44, FR-68, NFR-43, NFR-44.

1. After the study Tomás writes to Inês and asks to have his data removed.
2. Inês and her research team decide to grant the request. The platform provides the mechanism, and the decision follows their ethics approval.
3. Inês asks Carla to erase the participant.
4. Carla signs in with her password and a TOTP code, selects the participant and confirms.
5. The system removes his identity and entries from the three database nodes and every copy of his files from the three object storage copies. It writes the erasure to the audit log with his participant id only.
6. Carla tells Tomás that backups keep the data for up to 7 days, as the consent text said.
7. Carla checks the audit log and sees the erasure, with the administrator as the actor.

Result: His data is gone from the live system. The audit log keeps the pseudonymous id, and the backups lose his data within 7 days.

### Scenario 6: A node fails during the study and nothing confirmed is lost

Actors: Tomás, Inês, Carla. Use cases: UC5, UC6, UC11, UC4. Requirements: NFR-01, NFR-03, NFR-04, NFR-07, NFR-08, NFR-32, FR-55, FR-56.

1. On a Tuesday afternoon the logical node 2 stops, for example because its containers were stopped for a test. In this run it holds the database primary, an API replica and one scheduler replica.
2. Traefik stops routing to the API replica of node 2 in under 5 s. The standby scheduler takes the lease within 20 s.
3. The leader key of the database primary expires in etcd. Patroni promotes the synchronous replica, which takes up to 45 s, and the API reconnects with its host list.
4. While this happens Tomás sends an entry. The request fails, the API does not confirm it, and the app keeps the entry in its queue.
5. When the new primary accepts writes, the app resends the entry with the same UUID. The API inserts it and confirms.
6. Inês's dashboard loses its event connection. After a random delay of 1 to 5 s it reconnects and reloads the entries received since the last one it showed, without duplicates.
7. Carla sees the alert in Grafana. Later she starts the containers of node 2, which rejoins its clusters and resynchronises.

Result: The service keeps running on 2 of 3 members in every cluster. No entry that the API had confirmed is lost, and the entry in flight reaches the server once. This is failure scenario 2 and, for the database primary, scenario 3 of the fault model.

## Related documents

- [Requirements](requirements.md)
- [Use cases](use-cases.md)
- [Research context](../../06_Dados_Investigacao/00-research-context-unidcom.md)
- [From research to design](../../06_Dados_Investigacao/08-from-research-to-design.md)
