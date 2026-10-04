# Use cases

Status: proposed, 1 October 2026. Nothing described here is implemented. The use cases follow the
diagram [use-cases.svg](../diagrams/use-cases.svg) (Figure 2) and keep its names and
IDs, including UC5b and UC9b. Requirement IDs refer to [requirements](requirements.md).

## Actors

| Actor | Role |
|---|---|
| Participant | Joins one study, receives activities and records entries in the mobile app. Has no account, only an alias and a device token |
| Researcher | Creates and runs studies in the dashboard. Owner or collaborator of each study (`study_member`) |
| Administrator | Manages researcher accounts, oversees all studies, reads the audit log and handles erasure requests. Signs in with a TOTP code |
| Push notification service | External system (Expo Push, with FCM underneath) that delivers notifications to phones. Best effort |
| Scheduler | Internal system actor. Plans prompts and sends them. Two replicas, one active |

## Relationships in the diagram

| Relationship | Meaning |
|---|---|
| UC1 includes UC2 | Joining a study always ends with accepting the informed consent |
| UC5b extends UC5 | Time and location are attached when the activity asks for them. The date and time are always stored, location only on request |
| UC9 includes UC9b | Schedule rules saved for an activity are used by the next nightly plan |
| UC4 and UC9b use the push notification service | Notifications are delivered through it |

## Summary

| ID | Name | Primary actor |
|---|---|---|
| UC1 | Join a study with an invite code | Participant |
| UC2 | Accept informed consent | Participant |
| UC3 | Declare daily availability | Participant |
| UC4 | Receive an activity | Participant |
| UC5 | Record an entry (text, photo, video, audio, scale, choice) | Participant |
| UC5b | Attach time and location | Participant |
| UC6 | Send entries recorded offline | Participant |
| UC7 | Review own entries | Participant |
| UC8 | Create and configure a study | Researcher |
| UC9 | Define activities and schedule rules | Researcher |
| UC9b | Plan prompts (constraint scheduler) | Scheduler |
| UC10 | Invite participants | Researcher |
| UC11 | Follow adherence and entries in real time | Researcher |
| UC12 | Tag and filter entries | Researcher |
| UC13 | Export data (CSV; location and media optional) | Researcher |
| UC14 | Manage researcher accounts | Administrator |
| UC15 | Oversee all studies | Administrator |
| UC16 | Consult the audit log | Administrator |
| UC17 | Handle data erasure requests | Administrator |

## Participant use cases

### UC1 Join a study with an invite code

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Become a participant of one study on this phone |
| Preconditions | The researcher has created the participant and given the participant an invite code that is unused and issued less than 7 days ago. The app is installed and has a connection |
| Trigger | The participant opens the app for the first time and chooses to join |
| Related requirements | FR-01, FR-02, FR-03, FR-04, NFR-39, NFR-46, NFR-57 |

Main success scenario:

1. The participant chooses a language (`pt` or `en`) and types the 10-character invite code.
2. The app sends the code to the API.
3. The API checks the hash of the code, that it is unused and not expired, and that the per-IP attempt limit is not exceeded.
4. The API creates a random 256-bit device token, stores its SHA-256 hash with the participant row and invalidates the invite code.
5. The app stores the token in the phone's secure storage.
6. The system runs UC2 (include).
7. The app shows the participant's study and asks for the availability (UC3).

Extensions:

- 3a. The code is wrong, used or expired: the API answers with the same generic error and the app invites the participant to ask the researcher for a new code.
- 3b. The attempt limit is reached: the API refuses further attempts from that address for a period.
- 6a. The participant declines the consent: the joining is not completed and no prompt is planned for the participant.
- 2a. There is no connection: the app asks the participant to try again; joining needs the network.

Postconditions: The phone holds a device token linked to one `participant` row, the invite code can no longer be used and the consent is recorded.

### UC2 Accept informed consent

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Give informed consent before the first activity |
| Preconditions | The participant has a valid invite code and has not yet accepted the current consent version |
| Trigger | UC1 reaches the consent step |
| Related requirements | FR-03, FR-04, NFR-44 |

Main success scenario:

1. The app shows the consent text in the participant's language (`participant.locale`).
2. The text states the purpose of the study, what is collected, that backups keep erased data for up to 7 days, and what not to record (people who have not agreed to take part, documents, house numbers).
3. The participant accepts.
4. The API stores the accepted version and the time in `consent`.

Extensions:

- 3a. The participant declines: no `consent` row is stored and no prompts are sent.
- 4a. The API is unreachable: the acceptance stays on the phone and is sent when the connection returns; prompts are not delivered before the row exists.

Postconditions: `consent` holds the version and the time for the participant.

### UC3 Declare daily availability

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Tell the platform in which hours of the day prompts are acceptable |
| Preconditions | The participant has joined a study |
| Trigger | The participant opens the availability screen, or the app asks for it after joining |
| Related requirements | FR-05, FR-53 |

Main success scenario:

1. The participant selects the hours in which prompts are acceptable.
2. The app sends the hours to the API.
3. The API stores them in `availability`.
4. The scheduler uses them as domains in the next nightly plan.

Extensions:

- 3a. The participant changes the hours during the day: the API stores them and the scheduler replans only that participant's remaining prompts of the day (UC9b), keeping sent prompts fixed.
- 2a. There is no connection: the app keeps the change and sends it when the connection returns.
- 1a. The hours leave no room for an activity window: the affected prompts become `unplanned` with the reason `outside_availability`.

Postconditions: `availability` holds the participant's hours and the next plan respects them.

### UC4 Receive an activity

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Learn that an activity is waiting and open it |
| Preconditions | The participant has joined the study and accepted the consent. The scheduler has planned a prompt for the participant |
| Trigger | The planned time of the prompt arrives, or the participant opens the app |
| Related requirements | FR-06, FR-07, FR-08, FR-19, FR-21, FR-54, NFR-07, NFR-22, NFR-23, NFR-52 |

Main success scenario:

1. The active scheduler replica reaches the planned time of a prompt, checks that it holds the lease and marks the prompt as sent.
2. The scheduler asks the push notification service to deliver a notification with no participant data.
3. The phone shows the notification.
4. The participant opens it. The app reports `prompt.shown_at` and `prompt.opened_at`.
5. The app shows the activity with the researcher's instruction and the accepted entry types.

Extensions:

- 3a. The push is not delivered: the local notification scheduled from the 24-hour plan fires, and it is cancelled by prompt id if the push arrives or the prompt is answered.
- 3b. Neither notification arrives: the app fetches the pending prompts when the participant opens it (step 5).
- 1a. The scheduler leader fails: the standby takes the lease within 20 s and continues from the stored plan. One notification may be sent twice.
- 4a. The phone has no connection: the app reports the times when the connection returns.

Postconditions: The prompt is marked as sent and its shown and opened times are stored.

### UC5 Record an entry

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Record an observation as text, photo, video, audio, a scale value or a choice |
| Preconditions | The participant has joined the study. An activity is open, either from a prompt or as a free entry where the activity allows it |
| Trigger | The participant starts a recording from the activity screen |
| Related requirements | FR-09 to FR-14, FR-17, FR-21, FR-56, FR-58, FR-59, FR-60, FR-61, NFR-40 |

Main success scenario:

1. The participant picks one of the entry types the activity accepts.
2. The participant records the content. A video stops at 2 minutes.
3. The app creates the entry UUID and the SHA-256 hash of the content, and stores the entry in the local queue with `recorded_at` from the phone clock. When the activity requests location, UC5b extends this step.
4. For media, the app asks the API for a signed upload URL and sends the file straight to object storage (the API creates a `media_object` with status `pending`).
5. The app sends the entry to the API.
6. The API checks that the media objects exist, writes the entry and its `entry.created` event in one transaction and waits for the synchronous commit.
7. The API confirms the entry and the app marks it as sent.
8. The media worker processes the files in the background.

Extensions:

- 4a. The upload fails or the URL has expired: the app requests a new URL and uploads again.
- 5a. There is no connection, or the request fails: the entry stays in the queue and UC6 applies.
- 6a. The commit does not return successfully: the API does not confirm, the app resends the entry with the same UUID later.
- 8a. Media processing fails 5 times: the object is marked `failed`, the original is kept and the researcher can retry from the dashboard.
- 1a. The activity allows free entries and the daily cap is reached: the app refuses a further free entry for that day.

Postconditions: A confirmed entry is stored on two database nodes, its files are in object storage with 3 copies, and it cannot be edited through the API.

### UC5b Attach time and location

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Keep the context of an entry: when and, if the study asks for it, where |
| Preconditions | UC5 is in progress |
| Trigger | The participant records an entry |
| Related requirements | FR-11, FR-12, FR-61 |

Main success scenario:

1. The app reads the phone clock and stores it as `recorded_at`. The server later adds `received_at`.
2. When the activity requests location, the app asks the participant's permission and attaches the coordinates to the entry.
3. The media worker keeps the location metadata of the media files for that activity.

Extensions:

- 2a. The activity does not request location: the app collects none, and the media worker strips GPS and other metadata from photos, videos and audio.
- 2b. The participant denies the location permission: the entry is stored without coordinates and the dashboard shows that location is missing.
- 1a. The phone clock is wrong: both `recorded_at` and `received_at` are shown in the dashboard so that the difference is visible.

Postconditions: The entry has `recorded_at`, and coordinates only when the activity requested them.

### UC6 Send entries recorded offline

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Get every entry to the server without duplicates, even after the phone had no connection |
| Preconditions | One or more entries wait in the local queue |
| Trigger | The connection returns, or the participant opens the app |
| Related requirements | FR-15, FR-16, FR-17, FR-18, FR-55, FR-56, FR-57, FR-62, FR-70, NFR-02, NFR-03 |

Main success scenario:

1. The app detects the connection and takes the oldest queued entry.
2. The app uploads any pending media (UC5 step 4).
3. The app sends the entry with its original UUID, hash and `recorded_at`.
4. The API inserts the entry (`ON CONFLICT DO NOTHING`) and confirms with 200 after the synchronous commit.
5. The app removes the entry from the queue and moves to the next.

Extensions:

- 4a. The UUID exists for the same participant with the same hash: the API answers 200 and the app treats the entry as sent.
- 4b. The UUID exists with a different participant or hash: the API answers 409, the app keeps the entry and reports the problem to the participant.
- 4c. The entry arrives after the activity window: the prompt is already `expired`, and the API still accepts the entry with its original `recorded_at` and keeps its link to the prompt.
- 3a. A gateway or an API replica fails: the app repeats the request on the other gateway or replica.
- 3b. Two logical nodes are down and the server accepts no writes: the entry stays in the queue until a quorum returns.
- 3c. The app is uninstalled with entries still queued: those entries are lost, a declared limitation. The app shows how many are waiting.
- 2a. The upload URL has expired: the app requests a new one. Objects left `pending` for 7 days are deleted.

Postconditions: Every sent entry exists once on the server with its original recording time.

### UC7 Review own entries

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | See what the participant has recorded and whether it has been sent |
| Preconditions | The participant has joined a study |
| Trigger | The participant opens the entries screen |
| Related requirements | FR-20, NFR-38 |

Main success scenario:

1. The app lists the participant's entries from the local queue and from the API, newest first.
2. Each entry shows its type, its recording time and its status (waiting, sent).
3. The participant opens an entry to see its content.

Extensions:

- 1a. There is no connection: the app shows the local queue and the entries it already holds.
- 3a. The participant tries to change an entry: the app offers no edit, because the API has no operation to edit a confirmed entry.

Postconditions: None. The use case only reads, and the participant sees only their own entries.

## Researcher use cases

### UC8 Create and configure a study

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Set up a study that the scheduler can plan |
| Preconditions | The researcher has an account and is signed in |
| Trigger | The researcher chooses to create a study |
| Related requirements | FR-22, FR-23, FR-26, FR-30, FR-39, FR-69, NFR-34, NFR-35 |

Main success scenario:

1. The researcher enters the title, a description, the start and end dates and the time zone of the study. The study starts as `draft`.
2. The researcher chooses the schedule style: `fixed`, `balanced` or `varied`.
3. The researcher sets `max_prompts_per_day` and `max_prompts_per_slot`. The dashboard suggests a slot cap from the number of participants and their availability.
4. The researcher optionally adds collaborators.
5. The API creates the study with the researcher as owner and writes the change to the audit log.
6. When activities and participants are ready, the researcher starts the study, which becomes `running`. The scheduler plans prompts only for running studies. The researcher closes the study when it ends, and it becomes `closed`.

Extensions:

- 3a. The slot cap is lower than needed for the number of participants: the dashboard warns that prompts may be left `unplanned` with the reason `slot_cap`.
- 4a. A collaborator has no account: an administrator creates one first (UC14).
- 1a. The session has expired: the dashboard uses the refresh token and, if it was reused or revoked, asks for a new sign in.

Postconditions: A study exists with its time zone, style and limits, and the researcher is its owner.

### UC9 Define activities and schedule rules

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Define what participants are asked to record and when |
| Preconditions | A study exists and the researcher is a member |
| Trigger | The researcher adds or changes an activity |
| Related requirements | FR-24, FR-25, FR-27, FR-50 |

Main success scenario:

1. The researcher names the activity and writes the instruction, with the guidance on what not to record.
2. The researcher selects one or more entry types, the expected effort per entry in minutes and whether location is requested.
3. The researcher sets the time window, the number of prompts per day and the minimum gap in minutes.
4. The researcher decides whether free entries are allowed and their daily cap.
5. The dashboard shows the expected effort per participant and per day.
6. The researcher saves. The change applies from the next nightly plan, which runs UC9b (include); the plan of the current day is not changed.

Extensions:

- 3a. The minimum gap does not fit in the window: the dashboard warns, and the prompts become `unplanned` with the reason `min_gap_infeasible`.
- 5a. The expected effort of a day is high: the dashboard shows it so that the researcher can reduce it. It sets no limit.

Postconditions: The activity is stored with its entry types, location flag and schedule rules.

### UC9b Plan prompts (constraint scheduler)

| Field | Content |
|---|---|
| Primary actor | Scheduler (system) |
| Goal | Produce a valid plan of prompt times for each participant, spread over the day |
| Preconditions | The study has activities, participants and availability. One scheduler replica holds the lease |
| Trigger | The nightly run for the next day, or a change of availability (UC3) during the day |
| Related requirements | FR-35, FR-45 to FR-53, NFR-22, NFR-25, NFR-26 |

Main success scenario:

1. The scheduler builds one variable for each prompt to plan, with domains of 15-minute slots inside the availability and the activity window.
2. It applies node consistency and AC-3 over the minimum-gap constraints, then adds "not planned" to every domain.
3. It searches with backtracking, MRV, LCV and forward checking, honouring `max_prompts_per_day` and `max_prompts_per_slot`.
4. It scores valid plans with the study's schedule style and keeps the best one.
5. It stops when the search is complete or after 10 s per study.
6. It stores the prompts, with `unplanned_reason` for each prompt left unplanned, and the dashboard shows the result.
7. It sends the prompts at their planned times (UC4) through the push notification service.

Extensions:

- 5a. The time limit cuts the search: the best plan found is kept, the run is recorded as cut and prompts at "not planned" get the reason `search_cut`.
- 6a. A prompt was removed before the search: `outside_availability` or `min_gap_infeasible`. A prompt over the daily limit gets `daily_cap`, and one left out by the slot limit gets `slot_cap`.
- 1a. A replan for one participant during the day: only that participant's remaining prompts are searched again, with sent prompts fixed.
- 1b. The leader fails during planning: the lease expires after 15 s and the standby takes over in under 20 s, then plans again from the stored state. The unique key on `prompt` prevents duplicates.

Postconditions: A valid plan is stored with no hard constraint violated, and unplanned prompts have a reason.

### UC10 Invite participants

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Add participants to a study and give them access on their phones |
| Preconditions | A study exists and the researcher is a member |
| Trigger | The researcher adds a participant |
| Related requirements | FR-28, FR-29, FR-38, NFR-42 |

Main success scenario:

1. The researcher enters an alias, and optionally a name and an email address.
2. The API creates the `participant` row and, when given, the `participant_identity` row.
3. The API generates an invite code of 10 characters, stores only its hash and shows the code once.
4. The researcher gives the code to the participant outside the platform.

Extensions:

- 4a. The code expires after 7 days unused: the researcher issues a new code for the same participant.
- 4b. The participant changes phone: the researcher issues a new code for the same participant row, which links the new phone and keeps the history. The researcher can also revoke the old device token.
- 2a. The researcher opens the identity of a participant later: only the study owner and administrators can, and the read is audited.

Postconditions: The participant exists under an alias with an unused invite code.

### UC11 Follow adherence and entries in real time

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | See how participants are responding while the study runs |
| Preconditions | The study is running and the researcher is a member |
| Trigger | The researcher opens the study dashboard |
| Related requirements | FR-31 to FR-36, FR-63, NFR-31, NFR-32 |

Main success scenario:

1. The dashboard loads the entries and the adherence of the study from the REST API and opens a server-sent events connection.
2. When an entry is confirmed, an event tells the dashboard what changed and the dashboard reads the new data.
3. The researcher sees, for each participant and day, the prompts planned, shown, opened and answered, and the unplanned prompts with their reason.
4. The researcher opens entries, which show `recorded_at` and `received_at`, thumbnails for photos and players for audio and video.
5. For each media file the API issues a signed URL valid for 10 minutes and writes the issue to the audit log.

Extensions:

- 2a. The connection drops because a replica or gateway failed: the dashboard reconnects after a random delay of 1 to 5 s and reloads the entries received since the last one it showed, removing duplicates by entry id.
- 4a. A media object is `failed` or still processing: the dashboard shows its status, offers a retry for failed objects and does not offer the original for download.
- 1a. The researcher is not a member of the study: the API refuses the request.

Postconditions: None. The use case only reads.

### UC12 Tag and filter entries

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Organise entries for analysis |
| Preconditions | The study has entries and the researcher is a member |
| Trigger | The researcher opens an entry or the filter panel |
| Related requirements | FR-33, FR-37 |

Main success scenario:

1. The researcher creates a tag.
2. The researcher attaches the tag to one or more entries.
3. The researcher filters the entries by tag, participant, activity, entry type and date.
4. The dashboard shows the matching entries.

Extensions:

- 2a. The researcher detaches a tag: the label is removed and the entry is unchanged.
- 3a. No entry matches: the dashboard shows an empty list.

Postconditions: `tag` and `entry_tag` rows reflect the researcher's choices. The entry content is unchanged.

### UC13 Export data

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Take the data of a study out of the platform for analysis |
| Preconditions | The study has entries, whether it is running or closed, and the researcher is a member |
| Trigger | The researcher chooses to export |
| Related requirements | FR-64 to FR-67, FR-69, NFR-38, NFR-42 |

Main success scenario:

1. The researcher opens the export dialog. No option is selected.
2. The researcher starts the export.
3. The system produces a CSV with, for each entry, the participant alias, activity, prompt, entry type, content, `recorded_at` and `received_at`.
4. The file contains no identity, no location and no media files.
5. The system writes the export to the audit log with the content chosen.

Extensions:

- 1a. The researcher chooses to include location, media files or identity: each option is explicit, adds only its own content and is recorded in the audit log.
- 3a. A media file is not yet processed: the original is not exported and the export lists the file as unavailable.
- 1b. The researcher is not a member of the study: the API refuses the request.

Postconditions: The researcher holds a CSV file, and the audit log holds the export with its options.

## Administrator use cases

### UC14 Manage researcher accounts

| Field | Content |
|---|---|
| Primary actor | Administrator |
| Goal | Give researchers access to the platform and remove it when needed |
| Preconditions | The administrator is signed in with a TOTP code |
| Trigger | The administrator opens the accounts page |
| Related requirements | FR-39, FR-40, FR-41, NFR-33 to NFR-37 |

Main success scenario:

1. The administrator creates a researcher account with a name and an email address.
2. The system sends a single-use link, valid for 30 minutes, for the researcher to set a password.
3. The researcher sets a password, which the system stores as an Argon2id hash.
4. The administrator can edit or deactivate the account later.

Extensions:

- 2a. The link expires: the administrator or the researcher requests a new one.
- 4a. The administrator deactivates an account: its refresh tokens are revoked on every replica. The access token can keep working for up to 15 minutes.
- 1a. Repeated failed logins lock the account temporarily and add a delay.

Postconditions: The account exists, is changed or is deactivated, and the change is recorded in the audit log.

### UC15 Oversee all studies

| Field | Content |
|---|---|
| Primary actor | Administrator |
| Goal | See every study on the platform, with its researchers, participants and entries |
| Preconditions | The administrator is signed in with a TOTP code |
| Trigger | The administrator opens the studies overview |
| Related requirements | FR-42, NFR-38, NFR-37 |

Main success scenario:

1. The dashboard lists all studies with their researchers, participant counts and entry counts.
2. The administrator opens a study to see its activities, participants and entries.
3. The administrator can read the identity table of a study, and the read is audited.

Extensions:

- 3a. The administrator needs a researcher added to a study: the study owner makes the change in UC8.
- 1a. A researcher without the administrator role opens the page: the API refuses the request.

Postconditions: None. Reads that touch identities are in the audit log.

### UC16 Consult the audit log

| Field | Content |
|---|---|
| Primary actor | Administrator |
| Goal | Find out who did what and when |
| Preconditions | The administrator is signed in with a TOTP code |
| Trigger | The administrator opens the audit log |
| Related requirements | FR-43, FR-68, NFR-43 |

Main success scenario:

1. The dashboard shows the latest events: logins, exports, issued media URLs, reads of `participant_identity`, changes to studies, erasures and system jobs.
2. The administrator filters by actor type (user, participant, system), action and date.
3. The administrator opens an event to see its details.

Extensions:

- 3a. An event concerns an erased participant: it shows only the pseudonymous participant id.
- 1a. The log is large: the dashboard shows it page by page.

Postconditions: None. The log is append only, and the administrator cannot change it through the dashboard.

### UC17 Handle data erasure requests

| Field | Content |
|---|---|
| Primary actor | Administrator |
| Goal | Remove one participant's identity and entries from the live system |
| Preconditions | A participant has asked a researcher for erasure. The research team has decided to grant it, because Article 17 of the GDPR has an exception for research when erasure would make the research impossible or seriously impair it |
| Trigger | The researcher passes the request to the administrator |
| Related requirements | FR-44, NFR-13, NFR-43, NFR-44 |

Main success scenario:

1. The administrator selects the participant and confirms the erasure.
2. The system removes the participant's identity and entries from the three database nodes.
3. The system removes every copy of the participant's files from the three copies in object storage.
4. The system writes the erasure to the audit log with the pseudonymous participant id.
5. The administrator tells the participant that backups keep the data for up to 7 days.

Extensions:

- 1a. The research team decides not to grant the request: no erasure takes place and the decision is recorded outside the platform. The platform provides the mechanism, not the policy.
- 2a. A database node is down during the erasure: the erasure is applied to the node when it rejoins, and the administrator checks the result.
- 5a. The participant has entries still in the phone's offline queue: they stay out of reach of the platform until they are sent, a declared limitation.

Postconditions: The identity, entries and files are gone from the live system. The audit log keeps only the participant id. Backups expire within 7 days.

## Related documents

- [Requirements](requirements.md)
- [Personas and scenarios](personas-and-scenarios.md)
- [Architecture](../architecture.md)
- [Security](../security.md)
