# Use cases

Status: proposed, 2 October 2026; stale statements reconciled on 3 October 2026. Nothing described here is implemented. The use cases follow the
diagram [use-cases.svg](../diagrams/use-cases.svg) (Figure 2) and keep its names; the
diagram shows the names without IDs, and the IDs (such as UC1b, UC1c, UC5b and UC9b) are given in this document. UC23 and UC24 describe the study codes for posters (decision D6). UC25 to UC27 describe the optional participant account (decision D7), and the check against joining a study twice is part of UC1, UC1b and UC1c. Requirement IDs refer to [requirements](requirements.md).

## Actors

| Actor | Role |
|---|---|
| Participant | Joins one or more studies on one phone, receives activities and records entries in the mobile app. Has no account unless the person creates one (UC25), only an alias and a device token for each study. May also be a member of the volunteer pool (UC18), which has no study and no alias |
| Researcher | Creates and runs studies in the dashboard, and recruits from the volunteer pool by criteria without seeing any pool member. Owner or collaborator of each study (`study_member`) |
| Administrator | Manages researcher accounts, oversees all studies, reads the audit log and handles erasure requests that reach the team, sees the erasures scheduled from the app and the counts of the volunteer pool. Signs in with a TOTP code |
| Mail server | External to the app, internal to the platform. The platform's own mail server sends the 6-digit codes of the email method (UC25, UC26). In the course project it is a local mail catcher on the lab network that keeps the mail and delivers none |
| Google sign-in | External system, a production option that is off in the course project. Signs a person in to the account with a token that the API verifies (UC25, UC26) |
| Push notification service | External system (Expo Push, with FCM underneath) that delivers notifications to phones. Best effort |
| Scheduler | Internal system actor. Plans prompts and sends them. Two replicas, one active |
| System (erasure job) | Internal system actor that runs the permanent erasure 7 days after a participant asked for it in the app, and marks pool invitations as expired and declines the entries by study code that nobody decided. Appears as the actor `system` in the audit log. It is not drawn in the use case diagram. It is the API role that has access to identities and files, not the scheduler |

## Relationships in the diagram

| Relationship | Meaning |
|---|---|
| UC1 includes UC2 | Joining a study always ends with accepting the informed consent |
| UC1b and UC1c include UC2 | Scanning a QR code (UC1b) and joining from a pool invitation (UC1c) are two more ways to reach the same invitation card and the same consent as UC1. The pool invitation needs a pool membership (UC18) and is sent by UC19 |
| UC23 and UC24 with UC1 | A study code made in UC23 is typed or scanned in UC1 (UC1b reads it from a QR code) by many people. When the code requires approval, each entry waits in `pending_approval` until a researcher decides it in UC24 |
| UC25 extends UC1 | Extension point: the study code requires an account (FR-95, UC1 3e). Only then does UC1 hand the person to UC25 (or UC26) and back to the invitation card. UC25 is a goal of its own, started from the settings with no study involved, so the Participant is also associated with it directly |
| UC25 and UC26 use the mail server | The email method sends a 6-digit code. The Google method uses the Google sign-in system when the deployment turns it on |
| UC26 and UC27 | UC26 brings the participations of an account back on a new phone. UC27 deletes the account, with an option that starts the erasure of UC20 for every linked participation |
| UC5b extends UC5 | Location is attached only when the activity asks for it (extension point: step 3 of UC5). The date and time are not part of UC5b, because UC5 always stores them |
| UC9b and the scheduler | The scheduler is the primary actor of UC9b. The nightly run is started by the scheduler, not by UC9, so UC9 does not include UC9b. The rules saved in UC9 are only read by the next nightly plan |
| UC4 and UC9b use the push notification service | Notifications are delivered through it |
| UC19 uses the push notification service | The pool invitation notification is delivered through it |

## Summary

| ID | Name | Primary actor |
|---|---|---|
| UC1 | Join a study with an invite code (personal or study code) | Participant |
| UC1b | Join a study by scanning a QR code | Participant |
| UC1c | Join a study from a volunteer pool invitation | Participant |
| UC2 | Accept informed consent | Participant |
| UC3 | Declare daily availability | Participant |
| UC4 | Receive an activity | Participant |
| UC5 | Record an entry (text, photo, video, audio, scale, choice) | Participant |
| UC5b | Attach location | Participant |
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
| UC18 | Join the volunteer pool | Participant |
| UC19 | Recruit participants from the volunteer pool | Researcher |
| UC20 | Erase own data in the app | Participant |
| UC21 | Switch between studies on one phone | Participant |
| UC22 | Leave a study and keep the data | Participant |
| UC23 | Create and manage a study code | Researcher |
| UC24 | Approve or decline entries | Researcher |
| UC25 | Create a participant account (optional) | Participant |
| UC26 | Restore the participations on a new phone | Participant |
| UC27 | Delete the account | Participant |

## Participant use cases

### UC1 Join a study with an invite code (personal or study code)

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Become a participant of one study on this phone |
| Preconditions | Either the researcher has created the participant and given the participant a personal invite code that is unused and issued less than 7 days ago, or the participant has a study code (UC23) that is on, before its end date and, when it has an entry limit, below it. The app is installed and has a connection |
| Trigger | The participant opens the app, chooses to join and chooses to type the code. UC1b scans the code instead, and UC1c starts from a pool invitation |
| Related requirements | FR-01, FR-02, FR-03, FR-04, FR-72, FR-90, FR-92, FR-93, FR-95, FR-104, FR-105, FR-106, NFR-39, NFR-46, NFR-57, NFR-71, NFR-72, NFR-81 |

Main success scenario:

1. The participant chooses a language (`pt` or `en`) and types the invite code: 12 characters for a personal code, 8 for a study code.
2. The app sends the code to the API, with the Android ID of the installation (FR-105) and, when the phone is signed in to an account, the account token.
3. For a personal code, the API checks the hash of the code, that it is unused and not expired, and that the per-IP attempt limit is not exceeded. It does not consume the code. A study code is reusable and stored readable, so it is checked differently (extension 3c; FR-88, NFR-71). The API also checks, with the device hash of the study and with the account, whether this person already has a participation in the study (extension 3f), and discards the Android ID.
4. The API returns what the invitation card needs: the study title, the team, the dates, the requests per day, the expected effort, what is recorded and whether location is requested.
5. The app shows the invitation card with three choices: accept, decline and decide later.
6. The participant accepts. The API creates a random 256-bit device token, stores its SHA-256 hash with the participant row, stores the device hash of the phone (FR-105) and, when the phone is signed in, the link to the account (FR-104), and invalidates the invite code.
7. The app stores the token in the phone's secure storage.
8. The system runs UC2 (include).
9. The app shows the participant's study and asks for the availability (UC3).

Extensions:

- 3a. The code is wrong, used or expired: the API answers with the same generic error and the app invites the participant to ask the researcher for a new code.
- 3b. The attempt limit is reached: the API refuses further attempts from that address for a period.
- 5a. The participant declines: no token is issued, the code stays valid until it expires and the app returns to the welcome screen.
- 5b. The participant decides later: no token is issued, the code stays valid until it expires and the app keeps the invitation so that the participant can return to it.
- 8a. The participant declines the consent: the joining is not completed and no prompt is planned for the participant.
- 2a. There is no connection: the app asks the participant to try again; joining needs the network.
- 3c. The code is a study code. The API checks that it is on, that its end date has not passed and, when a limit is set, that its entries are below it, and the per-IP limit counts the lookup as for a personal code. The card carries the line "entry by the poster of this study" and, when approval is on, says that the team confirms each entry.
- 3d. The study code is off, replaced, past its end date or at its limit: the API answers with the same generic error as for a wrong code.
- 6b. The code is a study code: the code is not consumed, because many people use it. The API creates a new participant row for this person with a new device token, counts one entry in the same statement that checks the end date and the limit, when one is set, and, when approval is off, gives a new alias. Each person is a separate pseudonym.
- 3e. The study code requires an account (FR-95) and the phone is not signed in to one: the card is shown with a plain notice that an account is needed, and the API refuses the acceptance until the phone is signed in. The participant creates an account (UC25) or signs in (UC26) and returns to the card. The code is not consumed.
- 3f. The device hash or the account matches a participant row of this study (FR-106): the API creates no new row, does not consume the code and answers by the state of that row.
  - Active: "Already takes part in this study", with "Open the study". The card is not shown, and the app says that the code was not used.
  - Withdrawn (UC22): "You left this study on <date>. Come back?", with "Come back to the study" and "Not now". Coming back returns the person to the same pseudonym and the data already sent, issues a new device token that replaces the earlier one, and requests restart from the next nightly plan. "Not now" changes nothing.
  - Erasure scheduled (UC20): "The data of this study will be erased on <date>", with "Cancel the erasure".
  - Waiting for approval: the waiting screen of 8b. Declined: the entry was not accepted, and no new entry is created while the declined row exists, which is until the system deletes it 7 days after the decision (proposed here).
  - Erased: no participant row and no device hash remain, so nothing matches and the person joins as a new participant, with a new alias.
  - The phone does not hold the valid token of the matched row, for example after a reinstall: when the person confirms, the API issues a new token for that row and revokes the earlier one.
- 3g. A person with another phone, or after a factory reset, and with no account: the check finds nothing, because the Android ID is different, and the person can enter a second time. Approval of the entry (8b) and the account requirement (3e) cover this case, and it is a declared limitation.
- 8b. The study code requires approval (the default): the consent, the hours (UC3) and the notification choice are stored as usual, the participant has the status `pending_approval` and no alias, and the app shows a waiting screen that says the team will confirm the entry, that the person will be told and that no request is sent until then. No prompt is planned. UC24 decides the entry. When the team approves, the app is told (a notification that names no study, and the app also asks when it opens), the participant becomes `active` with an alias and requests start from the next nightly plan. When the team declines, the app tells the person plainly that the entry was not accepted.

Postconditions: The phone holds a device token linked to one `participant` row that holds the device hash of the phone and, when the phone is signed in, a link to the account, the personal invite code can no longer be used and the consent is recorded. A study code stays usable by others, and with approval the row is `pending_approval` until UC24. After 5a or 5b the code is still unused.

### UC1b Join a study by scanning a QR code

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Reach the invitation card of a study without typing the code |
| Preconditions | As for UC1. The researcher shows the invite code as a QR code on the dashboard or prints it |
| Trigger | The participant chooses "scan the QR code" on the welcome screen |
| Related requirements | FR-71, FR-72, FR-01, FR-02, FR-03, FR-105, FR-106, NFR-39, NFR-46 |

Main success scenario:

1. The app asks for permission to use the camera and opens the scanner.
2. The participant points the phone at the QR code, for example on a poster, and the app reads the invite code (12 characters for a personal code, 8 for a study code). The app stores no image.
3. The flow continues as UC1 from step 2: the same checks and attempt limit, the same check for a participation already held (UC1, 3f), the invitation card, the choice, the token and UC2.

Extensions:

- 1a. The participant refuses the camera permission: the app offers to type the code (UC1).
- 2a. The image holds no readable invite code: the app says so and keeps scanning.

Postconditions: As for UC1.

### UC1c Join a study from a volunteer pool invitation

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Join a study that recruits people like the participant, with no code |
| Preconditions | The participant is a pool member with invitations active (UC18). A researcher sent an invitation to the member (UC19) less than 7 days ago |
| Trigger | The push notification of the invitation arrives and the participant opens it |
| Related requirements | FR-77, FR-78, FR-72, FR-03, FR-02, FR-105, FR-106, NFR-52, NFR-69 |

Main success scenario:

1. The phone shows a notification that says only that there is a new study in which the participant can take part.
2. The participant opens it. The app asks the API for the invitation with the pool credential.
3. The app shows the invitation card of UC1, with a line that says why the participant was invited (member of the pool, living in the concelho given) and the date on which the invitation expires.
4. The participant accepts. The API creates a new participant row in the study with a new alias and a new device token, marks the invitation `accepted` and does not copy the pool profile.
5. The app stores the token in the phone's secure storage.
6. The system runs UC2 (include), and the app asks for the availability (UC3).

Extensions:

- 4a. The participant declines: the invitation becomes `declined` and no participant row is created.
- 4b. The participant decides later: the invitation stays `sent` until it expires, and then becomes `expired`.
- 2a. The invitation has expired: the app says so and the participant cannot accept it.
- 1a. The notification is not delivered: the push service is best effort. When the app is opened it asks the API for pending invitations (proposed here, as for prompts in UC4).
- 6a. The participant declines the consent: the joining is not completed and no prompt is planned. The invitation stays `accepted`.
- 4c. The phone or the account already has a participation in this study: as UC1, 3f. The invitation is not used up and the person is taken to the state of the existing participation. A person who returned by this route to a participation that was erased joins as new.

Postconditions: The study has a new participant row under a new alias. The invitation record names the study and the pool member and does not name the participant row. The pool profile is unchanged and was not copied.

### UC2 Accept informed consent

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Give informed consent before the first activity |
| Preconditions | The participant has accepted the invitation card of a study, by code, QR code or pool invitation, and has not yet accepted the current consent version |
| Trigger | UC1, UC1b or UC1c reaches the consent step |
| Related requirements | FR-03, FR-04, FR-80, NFR-44 |

Main success scenario:

1. The app shows the consent text in the participant's language (`participant.locale`).
2. The text states the purpose of the study, what is collected, that the participant can leave the study or erase their data in the app, that an erasure started in the app leaves no copy in the backups on the erasure date and that an erasure that reaches the team clears the backups within 7 days, and what not to record (people who have not agreed to take part, documents, house numbers).
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
| Related requirements | FR-05, FR-53, FR-84 |

Main success scenario:

1. The participant selects the hours in which prompts are acceptable.
2. The app sends the hours to the API.
3. The API stores them in `availability`.
4. The scheduler uses them as domains in the next nightly plan.

Extensions:

- 3a. The participant changes the hours during the day: the API stores them and the scheduler replans only that participant's remaining prompts of the day (UC9b), keeping sent prompts fixed.
- 2a. There is no connection: the app keeps the change and sends it when the connection returns.
- 1b. The participant has another study on the phone: the app offers to copy the hours of that study (FR-84). The copy becomes the availability of this study only and the two can differ afterwards.
- 1a. The hours leave no room for an activity window: the affected prompts become `unplanned` with the reason `outside_availability`.

Postconditions: `availability` holds the participant's hours and the next plan respects them.

### UC4 Receive an activity

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Learn that an activity is waiting and open it |
| Preconditions | The participant has joined the study and accepted the consent. The scheduler has planned a prompt for the participant |
| Trigger | The planned time of the prompt arrives, or the participant opens the app |
| Related requirements | FR-06, FR-07, FR-08, FR-19, FR-21, FR-54, FR-83, NFR-07, NFR-22, NFR-23, NFR-52 |

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
- 4b. The notification belongs to a study other than the current one: the app switches to that study and opens the activity (UC21).

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
3. The app creates the entry UUID and the SHA-256 hash of the content, and stores the entry in the local queue with `recorded_at` from the phone clock. The server later adds `received_at`. When the activity requests location, UC5b extends this step.
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
- 3a. The phone clock is wrong: both `recorded_at` and `received_at` are shown in the dashboard so that the difference is visible.

Postconditions: A confirmed entry is stored on two database nodes, its files are in object storage with 3 copies, and it cannot be edited through the API.

### UC5b Attach location

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Keep where an entry was recorded, when the study asks for it |
| Preconditions | UC5 is in progress and the activity requests location |
| Trigger | UC5 reaches step 3 for an activity with the location flag |
| Related requirements | FR-12, FR-61 |

Main success scenario:

1. The app asks the participant's permission and attaches the coordinates to the entry.
2. The media worker keeps the location metadata of the media files for that activity.

Extensions:

- 0a. The activity does not request location: UC5b does not run, the app collects none, and the media worker strips GPS and other metadata from photos, videos and audio.
- 1a. The participant denies the location permission: the entry is stored without coordinates and the dashboard shows that location is missing.

Postconditions: The entry has coordinates only when the activity requested them and the participant allowed them.

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
- 1b. An erasure is scheduled for the study (UC20): the app lists no entries of that study.
- 3a. The participant tries to change an entry: the app offers no edit, because the API has no operation to edit a confirmed entry.

Postconditions: None. The use case only reads, and the participant sees only their own entries.

### UC18 Join the volunteer pool

| Field | Content |
|---|---|
| Primary actor | Participant (as pool member) |
| Goal | Receive invitations to studies near the participant without first joining one |
| Preconditions | The app is installed and has a connection. Joining a study is not required |
| Trigger | The participant chooses the volunteer pool on the welcome screen or in the app settings |
| Related requirements | FR-73, FR-74, FR-75, FR-86, NFR-57, NFR-68 |

Main success scenario:

1. The app explains what the pool is, what is asked, who sees what (nobody sees the profile; researchers see counts of 5 or more) and how to leave.
2. The participant chooses to join and picks a concelho from the list of the 308 Portuguese municipalities. The app does not use the phone's location.
3. The participant may fill the freguesia, age band, gender, occupation, usual means of travel and languages. Each field has the answer "prefer not to say".
4. The app asks the API to create the pool member. The API creates a random 256-bit credential and stores its SHA-256 hash with the profile and the push token. The app keeps the credential in the phone's secure storage.
5. The app confirms the membership and that invitations are active.
6. Later the participant can open the pool settings to see and edit the profile, pause invitations with a switch, or leave the pool.

Extensions:

- 2a. No concelho is chosen: the app does not save the profile. The concelho is the only required field.
- 4a. There is no connection: the app asks the participant to try again.
- 6a. The participant leaves the pool: the API deletes the profile and the credential at once, with no waiting period, and the invitation records lose their reference to the member. The counts are kept.
- 6b. The participant pauses invitations: no invitation is sent, and the member is left out of the counts that researchers see (proposed here).

Postconditions: A `pool_member` row exists with no name, email address or phone number, or, after 6a, it no longer exists. Backups lose a deleted profile within 7 days.

### UC20 Erase own data in the app

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Have the participant's data in one study erased without asking the team |
| Preconditions | The participant has a participation on this phone, in a running or a closed study, and the phone has a connection |
| Trigger | The participant chooses "Erase my data in this study" in the study screen, or "Erase all my data" in the app settings |
| Related requirements | FR-80, FR-81, FR-103, FR-106, FR-44, FR-85, FR-87, NFR-44, NFR-70 |

Main success scenario:

1. The app states what happens now (including that from today the data no longer goes into the backups), what happens after 7 days (no copy remains, because the backups made before the request have expired) and that exports the team already made cannot be recalled.
2. The participant types the confirmation word (APAGAR in the Portuguese interface) and confirms.
3. The API sets the participation to `erasure_scheduled`, stores the time of the request and the due time (7 days later) and writes the request to the audit log with the actor type participant.
4. At once the scheduler plans no more prompts for the participant, the data is hidden from the research team and left out of exports, and the next daily dump and bucket copy leave out the participant's rows and files. The app deletes the queued entries of that study from the phone and shows that the data will be erased on the due date, with a button to cancel the erasure and nothing else active.
5. After 7 days the system runs the permanent erasure, with the mechanism of UC17: identity, entries, the device hash, the link to an account and every copy of the files on the three database nodes and the three object storage copies. It removes the device token and writes the erasure to the audit log with the actor type system.
6. The backups made before the request were kept 7 days and have expired by the due time, so no backup holds the data. There is no further period for backups.

Extensions:

- 5a. The participant cancels before the due time: the participation returns to the state it had, the data is visible again and goes back into the backups from the next daily backup, requests resume from the next nightly plan and the cancellation is written to the audit log with the actor type participant.
- 5c. A restore from backup took place during the 7 days: the backups hold no row or file of the participant, so the restored system has no participation for this person. The app finds that its device token is no longer known and says so. The data cannot come back from backup. If the participant then wants to cancel the erasure, the cancellation cannot restore anything, and the person can only join the study again with a new code as a new participant. The system job finds nothing to erase on the due date and only writes the audit row. This is the cost of decision D5, and it is acceptable because the participant asked for the erasure.
- 5b. A database node is down at the due time: the erasure is applied to that node when it rejoins and the system retries.
- 2a. There is no connection: the app cannot start the erasure, says so and deletes nothing from the phone (proposed here).
- 1a. The participant chose "Erase all my data": the app does the same for every study on the phone, each with its own request and due date, leaves the volunteer pool (UC18, 6a), removes the local credentials and queue, and returns to the welcome screen. When the phone is signed in to an account, the app first asks whether to delete the account as well (UC27).
- 3a. The participant asked for the erasure of a study that is closed: the steps are the same.

Postconditions: After step 4 the data is out of reach of the team and out of the new backups. After step 5 the identity, entries and files are gone from the live system, and by step 6 no backup holds them. The audit log keeps only the participant id. Exports made before step 3 are not recalled.

### UC21 Switch between studies on one phone

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Move between the studies the participant takes part in and miss no request |
| Preconditions | The participant has joined two or more studies on this phone. The phone holds one device token for each |
| Trigger | The participant opens the Studies tab, taps the banner of another study, or opens a notification |
| Related requirements | FR-82, FR-83, FR-84, FR-05, NFR-52 |

Main success scenario:

1. The main screens name the current study in a plain line above the title. The Studies tab carries a numeric badge with the open requests of the other studies.
2. The participant opens the Studies tab. It lists the studies on the phone as cards, each with its state (running, closed, or erasure scheduled with its date) and its number of open requests, and offers "join another study" (UC1) and the app settings. Each card links to the study detail.
3. The participant taps a card. The app makes that study current, loads it with its own token (today's requests, entries, hours) and opens the Today screen.

Extensions:

- 1a. Another study has an open request: the Today screen shows a banner with the study, the request and the time limit, and tapping it opens the Studies tab (step 2).
- 3a. A notification arrives for a study other than the current one: opening it switches to that study and opens the request (UC4, 4b).
- 3b. The chosen study has an erasure scheduled: the app shows the pending state with the button to cancel (UC20) and nothing else.
- 3c. The participant opens the hours of the chosen study: the app offers to copy the hours of another study (UC3, 1b).

Postconditions: The current study is the one chosen. Nothing is sent or changed on the server by the switch.

### UC22 Leave a study and keep the data

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Stop taking part in a study without erasing what was already sent |
| Preconditions | The participant has an active participation in a study on this phone and the phone has a connection |
| Trigger | The participant chooses "Leave the study" in the study screen |
| Related requirements | FR-79, FR-87, FR-106 |

Main success scenario:

1. The app explains that no more requests will arrive, that the entries already sent stay in the study under the alias, and that erasure is a separate choice (UC20).
2. The participant confirms.
3. The API sets the participation to `withdrawn`. The scheduler plans no further prompt for the participant, and prompts planned and not yet sent are cancelled.
4. The researcher sees the participant as having left the study.

Extensions:

- 3a. There is no connection: the app asks the participant to try again.
- 4a. The participant later wants the data erased: UC20 applies to a participation that has left the study.
- 4b. The participant later wants to come back: the person scans or types a code of the study again, and the check of UC1 (3f) finds the participation and offers to return to it with the same pseudonym and data (FR-106).

Postconditions: The participation is `withdrawn`, the entries already sent are unchanged and no new prompt is planned.

### UC25 Create a participant account (optional)

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Be able to recover the studies on a new phone and to avoid joining the same study twice from another phone, without any study depending on it |
| Preconditions | The app is installed and has a connection. Taking part never required an account. For the email method, the platform can send mail (in the course project, to the local mail catcher). Google sign-in is available only when the deployment turns it on |
| Trigger | The participant chooses "Create account (optional)" in the settings or after joining a first study, or the card of a study code that requires an account asks for one (UC1, 3e) |
| Related requirements | FR-96, FR-97, FR-98, FR-99, FR-101, FR-104, FR-95, NFR-57, NFR-75, NFR-76, NFR-77, NFR-78, NFR-79, NFR-80 |

Main success scenario (recovery code, the default method):

1. The app says what an account gives (recover the studies on a new phone, not join a study twice from another phone, see and delete one's data without this phone, use the pool on several devices), that nobody in the studies sees the account, that the platform can link the participations of one account, and offers three methods: "Create with a recovery code" (recommended, no email), "Use email" and "Continue with Google".
2. The participant chooses the recovery code.
3. The API generates a code of 16 characters in four groups (for example FN7Q-K2XM-9TRB-4WHD), stores an Argon2id hash and a keyed lookup value in a new `participant_account`, and returns the code once.
4. The app shows the code in large type with "Copy" and "Save as a file" and a warning that without the code, and without another method, the account cannot be recovered. "Finish" stays disabled until the participant ticks that the code was saved.
5. The participant finishes. The app sends the device tokens of the studies on the phone, and the API links those participations to the account (FR-104) and, when the phone holds a pool credential, the pool membership. The API gives the phone an account token, which the app keeps in secure storage, and writes the creation to the audit log.

Extensions:

- 2a. The participant chooses email: the app asks for the address, the API sends a 6-digit code through the platform's mail server, and the app shows "We sent a code to t***@example.pt", six boxes and "Resend in 0:42". The code is valid for 10 minutes and allows 5 attempts; a second code can be asked for after 60 seconds and at most 5 per hour. When the code is right the API creates the account with the address stored encrypted and a lookup value, and the flow continues at step 5. The answer to the request is the same whether or not the address already has an account.
- 2b. The participant chooses Google (only when on): the app obtains a Google sign-in token and the API verifies it against Google's public keys, with the issuer, audience, expiry and nonce, and keeps only the subject identifier. The flow continues at step 5.
- 2c. The address, or the Google identity, already belongs to an account: the person is signed in to that account, as in UC26, and the participations on this phone are linked to it. The app says that it signed in to an existing account.
- 5a. The account already has a participation in a study that this phone also holds: the account keeps its participation, the one on this phone stays unlinked, and the app tells the participant, who can leave the study on this phone.
- 4a. The participant leaves before ticking the box: no account is active and the code is discarded. A pending account is deleted by the system after 24 hours (proposed here).
- 6a. Later the participant adds a second method in the account settings, for example an email address to an account made with a recovery code (the 6-digit code is needed), or removes a method while at least one remains.
- 1a. The card of a study code that requires an account sent the participant here: after step 5 the app returns to the invitation card (UC1).
- 3a. There is no connection: the app asks the participant to try again.

Postconditions: An account exists with one sign-in method. The participations on the phone, and the pool membership if there is one, are linked to it. The phone holds an account token. Researchers see nothing of the account.

### UC26 Restore the participations on a new phone

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Get the studies back on a new phone without asking a researcher |
| Preconditions | The participant has an account (UC25) and still has at least one sign-in method. The app is installed on the new phone, which has a connection |
| Trigger | The participant chooses "I already have an account" on the welcome screen or on the join screen |
| Related requirements | FR-100, FR-98, FR-99, FR-104, FR-02, NFR-46, NFR-75, NFR-76, NFR-77, NFR-79, NFR-80 |

Main success scenario:

1. The app shows the three methods under "Sign in to your account", and the participant picks the recovery code and types it.
2. The API finds the account by the keyed lookup value and checks the Argon2id hash, counting the attempt per IP address and per account.
3. The API gives the new phone an account token. For each participation linked to the account it issues a new device token that replaces the one of the old phone, which stops working. A linked pool membership gets a new pool credential.
4. The app stores the tokens in secure storage and shows "Account recovered": the studies brought back (including a participation whose erasure is scheduled, with its date and the way to cancel it), the pool membership, a note that the hours are kept and that notifications must be allowed again on this phone.
5. The participant continues to the Today screen. The app asks for the notification permission and registers the push token of the new phone for each participation.

Extensions:

- 1a. The participant chooses email or Google: the 6-digit code (UC25, 2a) or the Google token (UC25, 2b) replaces the recovery code in step 1, and the flow continues at step 3.
- 2a. The code is wrong, or the account does not exist or was deleted: the API gives the same generic error and counts the attempt. After repeated failures the delay grows and the address is limited.
- 3a. A participation was erased before: it does not come back.
- 3b. The old phone is still in use: its next request is refused, because its token no longer works, and the app there says that the participation moved to another phone.
- 3c. The participant lost the recovery code and has no other method: the account cannot be recovered. The participations stay on the old phone, and a researcher can issue a new invite code for the same participant (UC10, 4b).

Postconditions: The new phone holds a device token for each participation of the account, and the old phone holds none that works. The audit log has a row for the sign-in on a new phone.

### UC27 Delete the account

| Field | Content |
|---|---|
| Primary actor | Participant |
| Goal | Remove the account and, if wanted, all the data of the studies |
| Preconditions | The phone is signed in to an account and has a connection |
| Trigger | The participant chooses settings, account, "Delete the account", or accepts the offer made by "Erase all my data" (UC20) |
| Related requirements | FR-102, FR-103, FR-81, NFR-80, NFR-44 |

Main success scenario:

1. The app explains that deleting the account removes the sign-in data and the links at once, that the studies stay as they are, and offers "Also delete the data of all my studies", off by default.
2. The participant confirms.
3. In one transaction the API deletes the account, its sign-in data (recovery code hash, email address and lookup value, Google subject identifier, pending email codes and account tokens) and every link to a participation and to the pool membership. It writes the deletion to the audit log.
4. The app removes the account token. The participations keep working with their device tokens.

Extensions:

- 2a. The participant ticked "Also delete the data of all my studies": in the same transaction the API schedules the erasure of UC20 for every participation linked to the account, on any phone, each due in 7 days and left out of the backups from that moment, and deletes the linked pool membership. The app lists the due dates. A phone that holds the token of a participation can cancel its erasure before the due date.
- 3a. There is no connection: the app cannot delete the account and says so. Nothing is deleted.
- 3b. Backups made before the deletion keep the account for up to 7 days, as for a pool profile.

Postconditions: No account row, sign-in data or link remains. The participations remain, or are scheduled for erasure when the option was ticked.

## Researcher use cases

### UC8 Create and configure a study

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Set up a study that the scheduler can plan |
| Preconditions | The researcher has an account and is signed in |
| Trigger | The researcher chooses to create a study |
| Related requirements | FR-22, FR-23, FR-26, FR-30, FR-39, FR-69, FR-76, NFR-34, NFR-35 |

Main success scenario:

1. The researcher enters the title, a description, the start and end dates and the time zone of the study. The study starts as `draft`.
2. The researcher chooses the schedule style: `fixed`, `balanced` or `varied`.
3. The researcher sets `max_prompts_per_day` and `max_prompts_per_slot`. The dashboard suggests a slot cap from the number of participants and their availability.
4. The researcher optionally adds collaborators and chooses how to recruit: with personal invite codes, which are always available (UC10), with a study code for a poster (UC23), and optionally from the volunteer pool, whose criteria are set after the study exists (UC19).
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
6. The researcher saves. The change applies from the next nightly plan, which the scheduler runs in UC9b; the plan of the current day is not changed.

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
| Related requirements | FR-28, FR-29, FR-38, FR-71, FR-87, NFR-42 |

Main success scenario:

1. The researcher enters an alias, and optionally a name and an email address.
2. The API creates the `participant` row and, when given, the `participant_identity` row.
3. The API generates an invite code of 12 characters, stores only its hash and shows the code once, as text and as a QR code (FR-71).
4. The researcher gives the code to the participant outside the platform.

Extensions:

- 4a. The code expires after 7 days unused: the researcher issues a new code for the same participant.
- 4c. The researcher wants to recruit many people with a poster or a leaflet: a study code (UC23) is used instead of one personal code for each person.
- 4b. The participant changes phone: the researcher issues a new code for the same participant row, which links the new phone and keeps the history. The researcher can also revoke the old device token. A participant who has an account does not need the researcher: UC26 brings the participation back on the new phone.
- 2b. The list of participants shows how each participant entered (QR code, typed code, pool or study code) and the state of a participant who left the study or whose erasure is scheduled (FR-87). For a scheduled erasure it shows the alias, the state and the date, and none of the participant's data.
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

### UC19 Recruit participants from the volunteer pool

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Invite people from the volunteer pool who fit the study, without seeing who they are |
| Preconditions | The researcher is signed in and is a member of the study. The study is a draft or running |
| Trigger | The researcher opens "Invite from the pool" in the participants of the study |
| Related requirements | FR-76, FR-77, FR-78, FR-87, NFR-68, NFR-69, NFR-70 |

Main success scenario:

1. The researcher sets criteria over the pool fields: concelho, and optionally freguesia, age band, gender, occupation, usual means of travel and language.
2. The dashboard shows the number of members who match, and no member.
3. The dashboard shows a preview of the invitation card that the members will see, and that the invitation is valid for 7 days.
4. When the number is 5 or more, the researcher sends the invitations.
5. The API creates one invitation with the status `sent` for each matching member and writes one audit row with the researcher, the study, the criteria and the number sent.
6. The system sends each member a push notification with the fixed text of FR-77.
7. The members who accept join the study through UC1c, and the participant list shows their entry route as the pool (FR-87).

Extensions:

- 2a. Fewer than 5 members match: the dashboard shows "fewer than 5" and does not allow the send. The API refuses it as well.
- 4a. The study is still a draft: the researcher can send the invitations before the study starts. No prompt is planned until the study is running.
- 2b. The researcher changes one criterion and compares two counts of 5 or more: the dashboard allows it. This is a declared limitation.
- 7a. An invitation is not answered within 7 days: it becomes `expired`.
- 1a. The researcher is not a member of the study: the API refuses the request.

Postconditions: One invitation record for each member invited, which no researcher interface shows. The researcher has seen a count and never a profile.

### UC23 Create and manage a study code

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Recruit many people with a poster or a leaflet, with one code that can be seen, printed, limited, switched off and replaced |
| Preconditions | The researcher is signed in and is a member of the study. The study is a draft or running |
| Trigger | The researcher opens "Invite codes" in the participants of the study and chooses to create a study code |
| Related requirements | FR-88, FR-89, FR-90, FR-91, FR-95, FR-87, FR-01, NFR-71, NFR-72, NFR-73, NFR-74 |

Main success scenario:

1. The researcher gives the code a name (for example "Cartaz no quiosque"), an end date and, if wanted, an entry limit (off by default, shown as "no limit") and a limit on entries per hour (off by default), and chooses whether the team approves each entry and whether the person must have an account. Approval is on by default and the account requirement is off. The dashboard says when to require an account: a public poster, where one account per person also stops the same person entering again from another phone. The dashboard explains the difference from a personal code: many people, a new pseudonym for each, visible again later.
2. The API creates the code, 8 characters in two groups of four, stores it readable and writes the creation to the audit log.
3. The dashboard shows the code, its QR code, its state, its uses (waiting, approved, declined, and the count against the limit, in which declined entries do not appear), its limit or "no limit" and its end date.
4. The researcher prints the poster: study title, one sentence on what is asked, expected effort, QR code, the code in large type, team and institution, end date for entries and the pseudonym line.
5. Later the researcher opens the list again and sees the code, its QR and the uses at any time.

Extensions:

- 3a. The researcher changes the limit (sets, changes or removes it), the per-hour limit, the end date, the account requirement or the approval setting: the change applies to new entries only and is audited. Switching approval off shows a warning that anyone who sees the poster can then join.
- 3b. The researcher switches the code off: new entries are refused with the generic error until the code is switched on again. People who already entered are not affected.
- 3c. The code was photographed or spread beyond the poster: the researcher regenerates it. The old code stops working at once, the new code takes its place on the poster, and the count of uses, the settings and the people who entered stay.
- 3e. The code has no entry limit (the default): it accepts entries until its end date, and with approval off the dashboard warns that anyone can then join without bound.
- 3d. The limit is reached or the end date passes: the code refuses new entries and the dashboard shows it as finished.
- 1a. The researcher is not a member of the study: the API refuses the request.

Postconditions: A study code exists with its settings, and every change is in the audit log. People join with it through UC1 and, when approval is on, wait for UC24.

### UC24 Approve or decline entries

| Field | Content |
|---|---|
| Primary actor | Researcher |
| Goal | Decide who enters the study through a study code, without learning who they are |
| Preconditions | A study code with approval on has at least one entry in `pending_approval`. The researcher is signed in and is a member of the study |
| Trigger | The researcher sees "people waiting for approval" among the items that need attention, or opens the study codes |
| Related requirements | FR-93, FR-94, FR-87, NFR-52, NFR-73 |

Main success scenario:

1. The dashboard lists the waiting entries. Each shows its order ("Person 1"), the time it arrived and the code used, and no alias or identity.
2. The researcher approves an entry.
3. The API sets the participant to `active`, assigns an alias, writes the approval to the audit log and tells the app with a notification that names no study. The person is counted as a participant from now on.
4. The scheduler plans requests for the participant from the next nightly plan.

Extensions:

- 2a. The researcher declines an entry: the API sets the participant to `declined`, deletes the consent, hours and push token, writes the decision to the audit log and tells the app. The app tells the person plainly that the entry was not accepted. No entry or other research data exists for that person. The entry does not count against the limit of the code, so a place is freed.
- 1a. The code ends (the end of its end date) while entries are still waiting: the system declines them automatically, as in 2a, and writes each decline to the audit log with the actor type system. From 24 hours before the end the dashboard shows a reminder among the items that need attention, with the number of entries waiting and the time the code ends, so that the team can decide first.
- 3a. The notification is not delivered: the app asks the API when it opens and shows the result.
- 1b. The code is off or regenerated while entries wait: the waiting entries stay and can be decided.

Postconditions: Each decided entry is `active` with an alias or `declined`, and the decision is audited. A waiting entry received no request.

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
| Related requirements | FR-42, FR-86, NFR-38, NFR-37 |

Main success scenario:

1. The dashboard lists all studies with their researchers, participant counts and entry counts.
2. The administrator opens a study to see its activities, participants and entries.
3. The administrator can read the identity table of a study, and the read is audited.
4. The administrator opens the volunteer pool overview, which shows only counts: members by concelho, how many filled each optional field, and the invitations sent with their outcome for each study (FR-86).

Extensions:

- 3a. The administrator needs a researcher added to a study: the study owner makes the change in UC8.
- 1a. A researcher without the administrator role opens the page: the API refuses the request.
- 4a. A group has fewer than 5 members: the overview does not show it. No row describes an individual member.

Postconditions: None. Reads that touch identities are in the audit log.

### UC16 Consult the audit log

| Field | Content |
|---|---|
| Primary actor | Administrator |
| Goal | Find out who did what and when |
| Preconditions | The administrator is signed in with a TOTP code |
| Trigger | The administrator opens the audit log |
| Related requirements | FR-43, FR-68, NFR-43, NFR-70 |

Main success scenario:

1. The dashboard shows the latest events: logins, exports, issued media URLs, reads of `participant_identity`, changes to studies, erasures and system jobs. It also shows the requests and cancellations of erasures made in the app, with the actor type participant and the participant id only, the automatic erasures, with the actor type system, the batches of pool invitations sent by a researcher, and the actions on study codes: creation, change, switching off and on, regeneration, each entry by a study code (actor type participant, participant id only) and each approval or decline by a researcher.
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
| Related requirements | FR-44, FR-85, NFR-13, NFR-43, NFR-44 |

Main success scenario:

1. The administrator selects the participant and confirms the erasure.
2. The system removes the participant's identity and entries from the three database nodes.
3. The system removes every copy of the participant's files from the three copies in object storage.
4. The system writes the erasure to the audit log with the pseudonymous participant id.
5. The administrator tells the participant that backups keep the data for up to 7 days. This is the manual path: it is immediate in the live system, and the data is not kept out of the backups made before it, which clear within 7 days.

Extensions:

- 0a. The participant asked in the app (UC20) instead of asking the team: the request is not handled here. The erasure screen lists it read only, with its dates, and the system erases the data automatically after 7 days (FR-85). The data is already out of the backups, so no backup holds it on that date. The administrator cannot cancel or bring forward it.
- 1a. The research team decides not to grant the request: no erasure takes place and the decision is recorded outside the platform. The platform provides the mechanism, not the policy.
- 2a. A database node is down during the erasure: the erasure is applied to the node when it rejoins, and the administrator checks the result.
- 5a. The participant has entries still in the phone's offline queue: they stay out of reach of the platform until they are sent, a declared limitation.

Postconditions: The identity, entries and files are gone from the live system. The audit log keeps only the participant id. Backups expire within 7 days.

## Related documents

- [Requirements](requirements.md)
- [Personas and scenarios](personas-and-scenarios.md)
- [Architecture](../architecture.md)
- [Security](../security.md)
