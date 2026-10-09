# Requirements

Status: proposed, 2 October 2026. Every requirement below is proposed. Nothing is implemented, and the
verification methods are plans. The requirements follow the design documents; where a value is not in
the design, the statement says so.

On 2 October 2026 four decisions changed the participant side (D1 to D4 below): three ways to join a study, a volunteer pool, erasure started by the participant in the app, and several studies on one phone. They add FR-71 to FR-87 and NFR-68 to NFR-70, and amend FR-01, FR-02, FR-03, FR-05, FR-20, FR-44, NFR-42, NFR-44, NFR-46, NFR-52 and NFR-57. Requirement IDs that existed before stay unchanged.

Two more decisions of the same day (D5 and D6 below) change the erasure timing and add reusable study codes for posters. D5 amends FR-80, FR-81, NFR-13 and NFR-44. D6 adds FR-88 to FR-94 and NFR-71 to NFR-74, and amends FR-01, FR-03, FR-82, FR-83, FR-87, NFR-46 and NFR-52. The multi-study screens now use a Studies tab instead of a switcher at the top (FR-82, FR-83).

A third group of decisions of the same day (D7 below, the mockup addendum v5) settles the open rules of the study codes (an optional entry limit, declined entries not counted, undecided entries declined when the code ends, an optional per-hour limit and a new option that requires an account), adds an optional participant account (FR-95 to FR-104, NFR-75 to NFR-80) and adds a check against joining the same study twice that works without an account (FR-105, FR-106, NFR-81). D7 amends FR-01, FR-02, FR-03, FR-79, FR-80, FR-81, FR-87 to FR-94, NFR-42, NFR-46, NFR-57 and NFR-72 to NFR-74, and adds FR-95 to FR-106 and NFR-75 to NFR-81. The account stays optional: the participant app still works with no account, no email address and no password.

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
| UC1 to UC27 | Use cases of [use-cases.svg](../diagrams/use-cases.svg), described in [use cases](use-cases.md), including UC1b, UC1c, UC5b and UC9b |
| FS-1 to FS-11 | Failure scenarios 1 to 11 of the fault model, run by scripts in `infra/chaos/` |
| D1 to D4 | The four decisions of 2 October 2026, recorded in the mockup addendum v3 (a local team document): D1 three ways to join a study, D2 volunteer pool, D3 delete my data from the app, D4 several studies on one phone |
| D5, D6 | Two further decisions of 2 October 2026, recorded in the mockup addendum v4 (a local team document): D5 the data of a participant whose erasure is pending stays out of the backups, D6 reusable study codes for posters |
| D7 | The decisions of 2 October 2026 recorded in the mockup addendum v5 (a local team document): F1 the rules of the study codes, F2 the optional participant account, F3 one participation per study without an account |
| ST-1 to ST-7 | The seven automated security tests of the security design, in its order: researcher cannot read or export another study; participant cannot read another participant's entries; revoked token stops on every replica; signed URL stops after expiry; exported media carry no coordinates when the activity does not ask for location; rate limits apply under load; an export with no options has no identity, location or media |
| SE, AB | Scheduler evaluation and ablation study of the scheduler design |
| UT, IT, E2E | Planned unit test, integration test and end-to-end test |
| DEMO, INS | Planned demonstration and planned inspection |

The design leaves some numbers open: the maximum upload size, the attempt limit of the invite code
and the throughput of the platform are not fixed. Requirements with a value the design does not
give say "proposed here" and have to be confirmed. The minimum group of 5 in the pool, the 7-day validity of a pool invitation and the 7-day window before an erasure started in the app, the exclusion of that data from the backups (D5) the rules of the study codes (D6, D7), the optional account and the device check (D7) are design decisions of 2 October 2026. The entry limit and the per-hour limit of a study code are optional and off by default, so no number is fixed for them. The values for the account that are proposed here and have to be confirmed are the 60 s wait before a second email code, at most 5 email codes per hour for one address, and the 7-day delay before a declined entry is deleted.

## Functional requirements

### Participant app

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-01 | The system shall let a participant join one study in three ways: with an invite code, scanned as a QR code (FR-71) or typed, or from a volunteer pool invitation (FR-77, FR-78). The invite code is either a personal code, single use, of 12 characters in three groups of four from a 32-symbol alphabet, valid for 7 days from issue, or a study code, reusable by many people, of 8 characters from the same alphabet (FR-88, FR-92), which can require an account (FR-95). Both kinds have an attempt limit per IP address. All routes end on the invitation card (FR-72). The typed personal code is the Must path; the study code and the other routes have their own priority. | Must | BRF (manage participants); SEC: Participant credentials; D1, D6, D7 | Test |
| FR-02 | The system shall issue a random 256-bit device token to the phone when the participant accepts the invitation card (FR-72), store only its SHA-256 hash on the server and keep the token in the phone's secure storage (Keychain on iOS, Keystore on Android through `expo-secure-store`). The phone keeps one token for each study (FR-82). A new token is also issued, and replaces the earlier one, when the participations of an account are brought back on a new phone (FR-100) and when a person returns to a participation found by the device check (FR-106). | Must | SEC: Participant credentials | Test, inspection |
| FR-03 | The system shall show the informed consent text in the participant's language before the first activity and store the accepted version and the time of acceptance in `consent`. Joining a study is complete only after acceptance, which follows the invitation card (FR-72). The text says that the participant can erase their data in the app (FR-80), that an erasure started in the app leaves no copy in the backups on the erasure date, and that an erasure that reaches the team (FR-44) clears the backups within 7 days. For a study code with approval (FR-93) the consent is shown and stored before the waiting screen, and the text says that the team confirms each entry. The text also says that the platform keeps, for each study, a code derived from an identifier of the phone only to stop the same phone joining that study twice (FR-105), and, for a person who has an account, that the platform can link the participations of that account to each other while researchers never see the account (FR-104, NFR-77). | Must | BRF; SEC: Consent and ethics review; R06; D5, D6, D7 | Test |
| FR-04 | The participant app shall provide its interface texts and the consent text in Portuguese (`pt`) and English (`en`), selected by `participant.locale`. | Must | UNIDCOM framing (R00); ARCH: Language | Test, inspection |
| FR-05 | The system shall let a participant declare the hours of the day in which they accept prompts (`availability`) and change them later. Each participation has its own availability (FR-82). | Must | SCH: Formulation; DM: `availability` | Test |
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
| FR-20 | The system shall let a participant review the entries they recorded, with their sending status. Entries are read only. While an erasure is scheduled (FR-80) the app shows none of the entries of that study. | Should | BRF; DM: Participant identity; SEC: Authorisation | Test |
| FR-21 | The app shall show the instruction written by the researcher for each activity, including the guidance to avoid recording people who have not agreed to take part, documents and house numbers. | Should | SEC: Consent and ethics review | Inspection |
| FR-71 | The app shall let a participant join a study by scanning, with the phone camera, a QR code that encodes the invite code of FR-01, and the dashboard shall show each issued invite code also as a QR code that the researcher can show on a screen or print. The camera only reads the code and the app stores no image. A scanned code is checked like a typed one, with the same attempt limit. If the camera permission is refused, the participant can type the code. | Should | D1; SEC: Participant credentials | Test, demonstration |
| FR-72 | After the API has accepted an invite code, typed or scanned, the app shall show an invitation card with the study title, the team, the dates, the number of requests per day, the expected effort, what is recorded and whether location is requested, and three choices: accept, decline and decide later. Checking the code and showing the card shall not consume the code. The code is consumed and the device token issued only when the participant accepts. Declining or deciding later leaves the code valid until it expires, and the app keeps the invitation so that the participant can return to it. | Must | D1; SEC: Participant credentials, Consent and ethics review | Test |
| FR-73 | The system shall let anyone with the app join the volunteer pool without joining a study. Joining is opt-in and is never a default or a condition of joining a study. The pool member gives a concelho chosen from the list of the 308 Portuguese municipalities, never taken from the phone's location, and gives no name, email address or phone number. The member is identified by a random 256-bit device credential, stored only as a SHA-256 hash and separate from any study token. | Could | D2; SEC: Volunteer pool privacy | Test, inspection |
| FR-74 | The pool profile shall also be able to hold, as optional fields, the freguesia, an age band (18-24, 25-34, 35-44, 45-54, 55-64, 65 or more), gender, occupation, the usual means of travel and the languages in which the person can take part (Portuguese, English). Each optional field has the answer "prefer not to say". The member can see and edit the profile in the app at any time. | Could | D2; DM: `pool_member` | Test |
| FR-75 | The app shall let a pool member pause invitations with a switch and leave the pool. Leaving deletes the profile and the pool credential at once, with no waiting period, because the profile holds no research data, and cuts the reference from every invitation record to the member while keeping the invitation counts. | Could | D2; SEC: Volunteer pool privacy | Test |
| FR-77 | The system shall notify a pool member of a new invitation with a push notification whose text says only that there is a new study in which the person can take part. The notification carries no study name, no criteria and no profile data. | Could | D2; SEC: Web application and notifications | Inspection, test, demonstration |
| FR-78 | When a pool member opens an invitation, the app shall show the invitation card of FR-72 with a line that says why the person was invited (member of the pool, living in the concelho given) and the date on which the invitation expires, 7 days after it was sent. When the member accepts, the system shall create a new participant row in the study with a new alias and a new device token, as for a code, and shall not copy the pool profile into the study. The invitation record holds the study, the pool member, the status (`sent`, `accepted`, `declined` or `expired`) and the dates, and does not hold the id of the new participant row. | Could | D1, D2; DM: Participant identity | Test |
| FR-79 | The app shall let a participant leave a study and keep the data already sent. From the moment the participant leaves, no further request is planned or sent for that study. The entries already sent stay in the study under the alias, and the researcher sees the participant as having left the study. A participant who left can come back to the same participation (FR-106). | Must | D3, D7; DM: `participant` | Test |
| FR-80 | The app shall let a participant erase their data in one study. After the participant types a confirmation word (APAGAR in the Portuguese interface), the system shall at once stop all requests and the participation, hide the participant's data from the research team and leave it out of exports, and from that moment leave the participant's rows and files out of the daily backups (NFR-13). The app shall delete from the phone the entries of that study that are still waiting in the queue. The system shall run the permanent erasure of the identity, the entries, the device hash (FR-105), the link to an account (FR-104) and every copy of the files, by the mechanism of FR-44, automatically 7 days after the request. Because backups are kept 7 days, the last backup that holds the data has expired by then, so on the erasure date no copy remains in the live system or in a backup. Until then the participant can cancel the erasure in the app, which restores the participation as it was, brings the data back into the backups from the next backup and resumes requests from the next nightly plan. Before the confirmation the app states what happens now (including that the data no longer goes into the backups) and after 7 days (no copy remains), and that exports the team already made cannot be recalled. If a restore from backup takes place during the 7 days, the data of a participant whose erasure is pending is not in it: it cannot be brought back from backup, and a participant who then cancels finds the participation gone and can only join again as a new participant (SEC: Erasure, retention and backups). | Must | D3, D5, D7; SEC: Erasure, retention and backups; R06 | Test |
| FR-81 | The app shall let a participant erase all their data on the phone from the app settings: the erasure of FR-80 for every study on the phone, with the same exclusion from the backups and its own date for each study, leaving the volunteer pool (FR-75), removal of the credentials and the local queue, and then the welcome screen. When the phone is signed in to an account, the app asks whether to delete the account as well (FR-102, FR-103). The pool profile is deleted at once and leaves the backups within 7 days. | Should | D3, D5, D7; SEC: Erasure, retention and backups | Test, demonstration |
| FR-82 | The app shall let a person take part in several studies on one phone. Each participation is a separate participant row with its own alias and device token, and the phone keeps one token for each study. The app shows one current study at a time, named in a plain line above the title of each main screen. A Studies tab lists the studies on the phone as cards with their state (running, closed, or erasure scheduled with its date) and the number of open requests of each. Tapping a card makes it the current study, and each card links to the study detail. The tab also offers joining another study and the app settings. | Should | D4; DM: Participant identity | Test, demonstration |
| FR-83 | When a study other than the current one has an open request, the app shall show a banner on the Today screen with the study, the request and the time limit, which opens the Studies tab, and a numeric badge on the Studies tab with the number of open requests in the other studies. A notification shall open the study it belongs to. | Should | D4; ARCH: Notifications with a fallback | Test, demonstration |
| FR-84 | The app shall let a participant copy, in the hours screen of one study, the hours declared in another study on the same phone. | Could | D4; DM: `availability` | Test |
| FR-96 | The app shall offer "Create account (optional)" in the settings and after the participant has joined a first study, and shall explain in plain words what an account gives: recovering the studies on a new phone, not joining the same study twice from another phone, seeing and deleting one's data without this phone, and using the volunteer pool on several devices. Taking part never requires an account, except in a study whose study code requires one (FR-95). Every function of the app other than that works with no account. | Should | D7; SEC: Participant account; DM: Participant identity | Inspection, demonstration |
| FR-97 | The system shall let a person create an account with a recovery code, the default method, which needs no email address and no external service. The API generates a code of 16 characters in four groups of four from the 32-symbol alphabet (about 80 bits, for example FN7Q-K2XM-9TRB-4WHD). The app shows it once, with the options to copy it and to save it as a file, and warns that without the code, and without another method, the account cannot be recovered. The person confirms that the code was saved before the account is finished. The system stores only a hash of the code (NFR-75) and never shows it again. | Should | D7; SEC: Participant account | Test, demonstration |
| FR-98 | The system shall let a person create an account, or sign in, with an email address and a 6-digit code. The person types the address, the platform sends a code valid for 10 minutes by its own mail server (NFR-78), and the person types it within 5 attempts. A second code can be requested after 60 seconds. The app shows the address with its middle hidden. The answer to a request is the same whether or not an account exists for the address (NFR-76). | Should | D7; SEC: Participant account | Test, demonstration |
| FR-99 | The system shall let a person create an account, or sign in, with Google ("Continuar com Google"), as an option that the deployment turns on. The option is off in the course project and documented as a production option; when it is on, the app shows it as available but secondary to the other two methods. The system accepts a Google sign-in only after verifying it (NFR-79) and keeps only the stable subject identifier of the Google account, with no name and no email address. | Could | D7; SEC: Participant account | Test, inspection |
| FR-100 | The system shall let a person sign in with the account on a new phone ("I already have an account") with any method the account has. On success the app shows the studies of the account and brings each participation back with a new device token that replaces the token of the old phone, including a participation whose erasure is scheduled, so that the erasure can still be cancelled, and the volunteer pool membership when it is linked (FR-104). The hours are kept. The app says that notifications must be allowed again on this phone. A participation that was erased does not come back. | Should | D7; SEC: Participant account | Test, demonstration |
| FR-101 | The system shall let a person who has an account add a second sign-in method in the account settings, for example an email address to an account made with a recovery code, and remove a method while at least one remains. Adding an email address needs the 6-digit code of FR-98. | Could | D7; SEC: Participant account | Test |
| FR-102 | The system shall let a person delete the account (settings, account, delete the account). Deleting removes at once, in one transaction, the account and its sign-in data: the recovery code hash, the email address and its lookup value, the Google subject identifier, the pending email codes and the account's phone tokens, together with every link to a participation and to the pool membership. The participations stay as they are, and each phone keeps its device tokens. Backups keep the account for up to 7 days. | Should | D7; SEC: Participant account | Test |
| FR-103 | When the person deletes the account, the app shall offer "Also delete the data of all my studies", off by default. When it is ticked, the system shall schedule, in the same transaction that deletes the account, the erasure of FR-80 for every participation linked to the account, on any phone, each with its own due date 7 days later and the exclusion from the backups, and shall delete the linked pool membership (FR-75). The account itself is deleted at once, and the 7-day path applies only to the study data. | Should | D3, D7; SEC: Participant account, Erasure, retention and backups | Test, demonstration |
| FR-104 | The system shall keep a link from an account to each of its participations: when the account is created, the participations on that phone, and afterwards each study joined while signed in. When the person is a pool member and has an account, the membership can be linked to it as well. The link is a record of the platform, read by no researcher interface and no export. It is removed with the participation (FR-80), with the account (FR-102) and, for the pool, when the member leaves (FR-75). An account has at most one participation in a study. | Should | D7; SEC: Participant account; DM: `account_participation` | Test, inspection |
| FR-105 | When a participant accepts the invitation card, by any route, the app shall send the Android ID of the installation, read with `expo-application`, and the system shall store for the participant only `device_hash = HMAC-SHA256(study_salt, android_id)`, where `study_salt` is a random value made for each study. The Android ID is stable across reinstalls of the app on Android 8 and later and changes on a factory reset. The Android ID is never stored or logged (NFR-81). Because each study has its own salt, the stored values cannot be used to tell that two studies were joined from one phone. When the lookup that precedes the card is made, the app sends the Android ID as well, and the API computes the hash for the study of the code, compares it and stores nothing. A platform with no Android ID stores no hash, and only an account blocks the second entry there. | Should | D7; SEC: Joining a study twice; DM: `participant.device_hash`, `study.device_salt` | Test, inspection |
| FR-106 | When a person tries to join a study with a code, by any route, and the device hash (FR-105) or the account (FR-104) matches an existing participant row of that study, the system shall create no new row and shall not use the code up, and shall answer by the state of that row. Active: "already takes part", with a way to open the study. Withdrawn: "left on <date>, come back?", which on confirmation returns the person to the same pseudonym and data, with requests restarting from the next nightly plan. Erasure scheduled: the date of the erasure, with a way to cancel it (FR-80). Waiting for approval: the waiting screen. Declined: the entry was not accepted, and no new entry is created while the declined row exists, which is until the system deletes it 7 days after the decision. Erased: no row and no hash remain, so the person can join as a new participant. When the phone does not hold the valid token of the row, the system issues a new token for it when the person confirms and revokes the earlier one. | Should | D7; SEC: Joining a study twice; DM: `participant` | Test, demonstration |

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
| FR-69 | The system shall give a study a description, a start date, an end date and a status of `draft`, `running` or `closed`. The researcher starts a draft study and closes a running one. The scheduler plans prompts only for running studies, and a researcher can export the data of a study at any time, during or after the study (FR-64). Closing a study erases no data: entries stay under their pseudonyms until a participant erases them (FR-80, FR-81) or an administrator does (FR-44). | Must | BRF (create studies); DM: `study`; SCH: Formulation | Test |
| FR-76 | The system shall let a researcher who is a member of a study recruit from the volunteer pool. The researcher sets criteria over the pool fields and sees only the number of people who match. A number below 5 is shown as "fewer than 5" and the system shall refuse to send invitations to a group of fewer than 5. The researcher can send the invitations before the study starts, and each invitation is valid for 7 days. The dashboard shows no profile and no identity of any pool member. The study creation form offers the pool as an optional way to recruit besides the invite code, and the criteria are set after the study exists. | Could | D2; SEC: Volunteer pool privacy | Test, demonstration |
| FR-87 | The participant list of a study shall show how each participant entered (QR code, typed code, pool or study code) and the states of a participant who left the study (FR-79), of one whose erasure is scheduled, with its date (FR-80), and of one waiting for approval or declined (FR-93, FR-94). While an erasure is scheduled the dashboard shows the alias and the state and none of the participant's data. The list never shows whether a participant has an account (NFR-77). | Could | D1, D3, D6, D7; DM: `participant` | Test |
| FR-88 | The system shall let a member of a study create a study code: a reusable invite code that many people can use to join the study, for recruiting with a poster or a leaflet. The researcher gives the code a name (for example "Cartaz no quiosque") and an end date, which is required. The researcher may also set an entry limit (off by default, shown as "no limit"), a limit on the entries per hour (off by default, NFR-72), whether the team approves each entry (default on, FR-93) and whether the person must have an account (default off, FR-95). The code has 8 characters in two groups of four from the 32-symbol alphabet, chosen at random. A study can have several study codes. | Should | D6, D7; SEC: Study codes | Test |
| FR-89 | The dashboard shall show a member of the study each study code, its QR code, its state, its uses, its entry limit (or the words "no limit") and its end date at any time, not only when it is created, and shall let the member print a poster from it: the study title, one sentence on what is asked, the expected effort, the QR code, the code in large type, the team and institution, the end date for entries and a line saying that the person takes part under a pseudonym. | Should | D6, D7; DM: `invite_code` | Test, demonstration |
| FR-90 | The system shall refuse new entries with a study code when the end date has passed or, if an entry limit is set, when the limit is reached, and shall let a member set, change or remove the limit and change the end date later. A code has no limit unless a member sets one. The code ends at the end of its end date, in the study's time zone. An entry is counted when the participant accepts the invitation card (FR-72) and counts while it is waiting or approved. A declined entry does not count, including one declined automatically (FR-94), so declining frees a place. An entry of a person who later leaves the study or erases the data keeps counting. The count shall never exceed the limit when entries arrive together. People who are already in the study are not affected by the limit or the end date. | Should | D6, D7; SEC: Study codes | Test |
| FR-91 | The system shall let a member switch a study code off and on, and regenerate it. A study code that is off, or one replaced by regeneration, is refused like an unknown code. Regenerating issues a new code for the same poster setup (name, limit if one is set, end date, approval, account requirement) and keeps the counter of entries. People who already entered stay in the study. | Should | D6, D7; SEC: Study codes | Test |
| FR-92 | When a participant scans or types a study code, the app shall show the invitation card of FR-72 with a line saying that the entry is by the poster of this study. Checking the code and showing the card do not use the code up. When the participant accepts, the system shall create a new participant row with a new device token for that person, as for a personal code, and a new alias (at once when approval is off, otherwise when the team approves, FR-93), so each entry is a separate pseudonym that researchers cannot link to any other entry of the same code. The check of FR-106 comes first, so the same phone or account does not enter the same study twice. | Should | D6, D7; SEC: Study codes | Test |
| FR-93 | When a study code requires approval (the default), the participant row created on acceptance shall have the status `pending_approval` and no alias, because the alias is assigned when the entry is approved (FR-94). The app shall show the consent, the hours and the notification choice as usual and then a waiting screen that says the team will confirm the entry and that the person will be told. The system shall plan, send and show no request to a participant in this status, and a person waiting is not counted as a participant in the numbers of the study. When the code does not require approval the participant is `active` at once, with an alias. | Should | D6, D7; DM: `participant` | Test |
| FR-94 | The dashboard shall list the entries waiting for approval, each shown only by its order, the time and the code used and never with an alias or an identity, and shall let a member approve or decline each one. It shall also show the number of people waiting among the items that need attention. Approving sets the status to `active`, assigns the alias, tells the app and lets requests start from the next nightly plan. Declining sets the status to `declined`, tells the person plainly that the entry was not accepted and deletes the consent, hours and push token of that person at once; no entry or other research data exists for a declined person. An entry that is still undecided when the code ends (the end of its end date, FR-90) is declined automatically by the system, in the same way. From 24 hours before the end, while entries are still waiting, the dashboard shall remind the team, among the items that need attention, of how many entries wait and when the code ends. | Should | D6, D7; SEC: Study codes | Test, demonstration |
| FR-95 | The system shall let a member of a study set, for each study code, the option "require an account", off by default. When it is on, the lookup of the code tells the app that an account is needed, the app leads the person to create an account or sign in (FR-97 to FR-99) and back to the invitation card, and the system refuses the acceptance of the card from a phone that is not signed in to an account. The participant row is then linked to the account (FR-104). The dashboard says when to use the option: a public poster, where one account per person also stops the same person entering from another phone (FR-106). The researcher never learns which account. | Should | D7; SEC: Study codes, Participant account | Test, demonstration |

### Administration

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| FR-39 | The system shall let researchers and administrators sign in with email and password and sign out. | Must | BRF; SEC: Researcher and administrator authentication | Test |
| FR-40 | The system shall let a user reset a forgotten password through a single-use link valid for 30 minutes, sent to the account's email address. | Should | SEC: Researcher and administrator authentication | Test |
| FR-41 | The system shall let an administrator create, edit and deactivate researcher accounts (`user_account`). | Must | BRF (manage researchers) | Test |
| FR-42 | The system shall let an administrator list all studies with their researchers, participants and entry counts. | Must | BRF (manage studies); R08 | Test |
| FR-43 | The system shall let an administrator consult the audit log and filter it by actor, action and date. | Must | BRF; SEC: Audit log | Test |
| FR-44 | The system shall let an administrator erase one participant: the identity and all entries, with every copy of their files, in the live system. Each erasure is written to the audit log. This is the path for requests that reach the team by email or in person; erasure started by the participant in the app is FR-80. | Must | SEC: Erasure, retention and backups; R06; D3 | Test |
| FR-85 | The administrator screens shall list, read only, the erasures scheduled from the app, with the study, the alias, the date of the request and the date of the automatic erasure, next to the requests that arrive through the team (FR-44). The administrator cannot cancel or bring forward an erasure started by the participant. | Should | D3; SEC: Erasure, retention and backups | Test |
| FR-86 | The administrator shall see an overview of the volunteer pool made only of counts: the total number of members, the members by concelho, how many members filled each optional field, and the invitations sent with their outcome (accepted, declined, expired) for each study. Groups of fewer than 5 are not shown and no individual row exists. | Could | D2; SEC: Volunteer pool privacy | Test |

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
| FR-70 | The system shall mark a prompt as `expired` when it is not answered by the end of its activity window. An entry that arrives later from the offline queue is still accepted (FR-57) and keeps its link to the prompt. | Must | DM: `prompt`, Design notes; R01 | Test |

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

## Non-functional requirements

### Availability and fault tolerance

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-01 | The system shall keep receiving entries, serving the researcher dashboard and delivering scheduled activities after the loss of any one of the three logical nodes (f = 1). | Must | FM: Guarantees; R05 | Test, demonstration |
| NFR-02 | When two logical nodes are down, the system shall stop accepting writes and shall never accept inconsistent writes. The app shall keep recording into its local queue and send the entries when a quorum is back. | Must | FM: Guarantees; R05, R08 (consistency over availability) | Test |
| NFR-03 | The system shall not lose any entry that the API has confirmed when one logical node fails (recovery point objective of zero). | Must | FM: Guarantees; R05 | Test, demonstration |
| NFR-04 | The system shall detect and route around a failed API replica in under 5 s, using a `/health` check every 2 s with a 1 s timeout. `/health` shall fail when the replica cannot write to the database or reach the broker. | Must | FM: Recovery time targets; ARCH: How each layer tolerates failure | Test |
| NFR-05 | Docker shall restart a crashed container of any service. | Must | FM: Guarantees; ARCH: How each layer tolerates failure | Test |
| NFR-06 | The system shall serve clients through two gateways, and a client that fails a request on one gateway shall switch to the other in under 5 s. | Must | FM: Recovery time targets, scenario 10; ARCH: Deployment | Test |
| NFR-07 | The system shall transfer the scheduler to the standby in under 20 s after the leader fails. | Must | FM: Recovery time targets, scenario 11; SCH: Running the scheduler with two replicas | Test |
| NFR-08 | The system shall promote the synchronous database replica within 45 s after the primary fails, with no confirmed entry lost. The value is a target to be tuned and measured. | Must | FM: Recovery time targets | Test, demonstration |
| NFR-09 | When the synchronous database replica fails, the system shall pause writes for a few seconds and then continue with the other replica as synchronous. | Must | FM: Recovery time targets | Test |
| NFR-10 | A failed broker node or object storage node shall cause no interruption, because the remaining two members keep the quorum, and an upload in progress shall complete. | Must | FM: Recovery time targets | Test |
| NFR-11 | When one node is cut off from the `cluster` network, the isolated node shall stop serving requests, the other two nodes shall keep accepting writes and the node shall resynchronise when it reconnects. | Must | FM: Demonstration scenarios; ARCH: Networks | Test |
| NFR-12 | After a media job fails 5 times, the broker shall move it to a dead-letter queue and the media object shall be marked `failed`. The original file is kept. | Must | FM: What can be lost or repeated | Test |
| NFR-13 | The system shall make a daily `pg_dump` and a copy of the object storage bucket, encrypt them on the host with a public key whose private key is kept off the host, send them to another machine and keep them for 7 days. The dump shall leave out the rows of every participant whose status is `erasure_scheduled`, with the dependent rows (identity, consent, availability, prompts, entries, media records and tags), and the copy of the bucket shall skip the objects of those participants. The retention shall never be longer than the 7-day period before an erasure started in the app (FR-80). The restore of NFR-14 therefore brings back no participant whose erasure was pending at the backup time. | Must | FM: Single points of failure; SEC: Erasure, retention and backups; D5 | Test, inspection |
| NFR-14 | A restore of the latest backup on a clean stack shall bring back the database and the files of the backup day, with matching counts of entries and files, except for participants whose erasure from the app was pending at the backup time (NFR-13). | Must | FM: Demonstration scenarios | Test, demonstration |
| NFR-15 | The system shall expose metrics to Prometheus and show them in Grafana, with alerts, during the failure demonstration. The loss of monitoring shall not affect the service. | Should | FM: Single points of failure; ARCH: Components | Demonstration |

### Consistency

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-16 | The database shall run with one primary, one synchronous replica and one asynchronous replica, with Patroni `synchronous_mode: true` and `synchronous_mode_strict: true`, so that a failover only promotes a replica recorded as synchronous. | Must | ARCH: Synchronous replication; R05 | Inspection, test |
| NFR-17 | The API shall set no timeout that can cancel the wait for the synchronous replica and shall report any outcome other than a successful commit to the app as a failure. | Must | ARCH: Synchronous replication; R05 | Inspection, test |
| NFR-18 | Object storage shall confirm a write after 2 of 3 copies, with each logical node as its own zone, so that the 3 copies of a file are on 3 logical nodes. | Must | ARCH: Components | Inspection, test |
| NFR-19 | RabbitMQ shall use quorum queues, the relay shall use publisher confirms and consumers shall ignore event ids they have already processed. | Must | ARCH: Transactional outbox, How each layer tolerates failure | Test |
| NFR-20 | The API shall connect to the database with a host list and `target_session_attrs=read-write`, a 3 s connect timeout and a connection pool that checks connections before use, and shall retry a failed transaction up to 3 times. | Must | ARCH: Database connections | Test |
| NFR-21 | A database primary cut off from etcd shall demote itself to read-only when its leader key expires. | Should | ARCH: Database connections; FM: Guarantees | Test |
| NFR-22 | Only one scheduler replica shall plan and send at a time. The leader shall renew its lease row every 5 s, a lease not renewed for 15 s may be taken by the standby, and the leader shall stop sending when a database call fails. | Must | SCH: Running the scheduler with two replicas | Test |
| NFR-23 | `prompt` shall have a unique key on participant, activity, plan date and occurrence, so that a failover does not plan or send the same prompt twice. | Must | DM: Design notes | Test |
| NFR-24 | The system shall deliver messages at least once and store results exactly once. The relay shall claim events with `SELECT ... FOR UPDATE SKIP LOCKED` and delete published events after 7 days. | Should | ARCH: Transactional outbox, Client-generated identifiers | Test |

### Performance and load

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-25 | The scheduler shall return a plan within 10 s per study for studies of up to 100 participants, and the run shall record whether it finished or was cut. | Must | SCH: Algorithm, Evaluation | Test |
| NFR-26 | No plan returned by the scheduler shall violate a hard constraint. The evaluation shall report prompts left unplanned, nodes expanded, backtracks, load spread and soft score for each study size. | Must | SCH: Evaluation, Ablation study | Test |
| NFR-27 | The system shall accept the burst of entries with photos, audio or video of several MB that follows an activity sent to all participants of a study, without losing a confirmed entry. | Must | ARCH: Why the system is distributed; R04 | Test |
| NFR-28 | The system shall run several studies at the same time, with up to 100 participants in one study. The target of 3 studies at once is proposed here and has to be confirmed. | Must | BRF; R00 (several studies at once) | Test |
| NFR-29 | Media files shall travel between the phone and object storage without passing through the API. | Must | ARCH: File first, metadata second; SEC: Media files | Inspection |
| NFR-30 | The API shall confirm an entry without waiting for media processing, which runs asynchronously in the media worker. | Should | ARCH: Components, Transactional outbox | Test |
| NFR-31 | The dashboard shall show a confirmed entry within 5 s under normal operation. The value is proposed here and has to be validated by a load test. | Should | BRF (real time); ARCH: Real time | Test |
| NFR-32 | The API shall send a comment line on each server-sent event connection every 20 s, with `Cache-Control: no-store` and no compression. A dashboard that loses its connection shall reconnect after a random delay of 1 to 5 s and reload the entries received since the last one it showed, removing duplicates by entry id. | Must | ARCH: Real time | Test |

### Security and privacy

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-33 | The system shall store passwords as Argon2id hashes with at least 19 MiB of memory, 2 iterations and parallelism 1. | Must | SEC: Researcher and administrator authentication | Inspection, test |
| NFR-34 | The system shall issue access tokens valid for 15 minutes and refresh tokens that change on every use, are stored as hashes and are grouped by family. Presenting a superseded refresh token shall revoke the whole family. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-35 | The dashboard shall keep the refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie and the access token only in memory. | Must | SEC: Researcher and administrator authentication | Inspection, test |
| NFR-36 | The system shall apply a progressive delay and then a temporary lockout after repeated failed logins, return the same error for an unknown email and a wrong password, and run a dummy Argon2id verification for an unknown email. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-37 | The system shall require TOTP for administrator accounts. | Must | SEC: Researcher and administrator authentication | Test |
| NFR-38 | The system shall check the user's role and membership of the study on every request, and a participant shall read only their own entries. | Must | SEC: Authorisation, Threat model | Test |
| NFR-39 | The system shall compare invite codes, device tokens and refresh tokens in constant time. | Should | SEC: Participant credentials | Inspection |
| NFR-40 | Signed URLs for media shall be valid for 10 minutes and for one object, and shall sign the maximum size and the content type so that object storage enforces them. | Must | SEC: Media files; ARCH: File first, metadata second | Test |
| NFR-41 | Traefik shall log the `/media` route without the query string, and media files shall be served with their content type, checked by the media worker, and `X-Content-Type-Options: nosniff`, so that the dashboard shows and plays them inline. Downloads and exports shall use `Content-Disposition: attachment`. | Must | SEC: Media files | Inspection, test |
| NFR-42 | The system shall keep names and emails only in `participant_identity`. Researchers shall see aliases by default, and one person in two studies shall be two unrelated participant rows. No participant row refers to a pool member, and the pool profile is never copied into a study (FR-78). With an optional account, the platform, and no researcher, can link the participations of one account (FR-104), and the device hash lets the platform tell that one phone already entered a study (FR-105). Both are declared limits (NFR-77). | Must | DM: Participant identity; SEC: Principles; R06 | Inspection, test |
| NFR-43 | The services shall write to `audit_log` with a database role that has `INSERT` and no `UPDATE` or `DELETE`. The log shall survive the erasure of a participant with pseudonymous identifiers only. | Must | SEC: Audit log | Test, inspection |
| NFR-44 | An erasure shall reach the three database nodes and the three copies of every file. For an erasure that reaches the team (FR-44) the data shall leave the backups within 7 days, and the consent text shall say so. For an erasure started in the app (FR-80) the participant's data is left out of every backup made from the request onward (NFR-13) and the backups made before it expire within 7 days, so on the erasure date no backup holds the data and the erasure is complete everywhere. | Must | SEC: Erasure, retention and backups; D5 | Test, inspection |
| NFR-45 | No port shall be open to the Internet. Clients shall reach the gateways through Tailscale with HTTPS on top, and the `cluster` network shall not be published on the host. The database, etcd and RabbitMQ shall not be on the `edge` network. | Must | SEC: Network access and transport; ARCH: Networks | Inspection, test |
| NFR-46 | Traefik shall apply rate limits per IP address, and the API shall throttle logins per account. The check of an invite code that precedes the invitation card (FR-72), personal or study code, counts as an attempt. The check of a recovery code, the check of an email code and each request for an email code count as attempts under the same limit, and the API also throttles them for each account and for each email address (NFR-75, NFR-76). | Must | SEC: Network access and transport | Test |
| NFR-47 | Signing keys and the passwords for the database, RabbitMQ and Garage shall be Docker Compose secrets and never committed. The repository shall hold `.env.example` without values, and GitHub secret scanning with push protection shall be enabled. | Must | SEC: Secrets and the public repository | Inspection |
| NFR-48 | Each service shall have its own credentials with only the permissions it needs: the media worker shall not read identities, accounts or text entries, the scheduler shall not access files or identities, and the API shall not change or delete the audit log. | Must | SEC: Service privileges and container hardening | Test, inspection |
| NFR-49 | Containers shall run as non-root users, drop all Linux capabilities, never run privileged, use read-only file systems where possible and use images pinned by digest. | Should | SEC: Service privileges and container hardening | Inspection |
| NFR-50 | The repository shall report vulnerable dependencies with Dependabot, `pip-audit` and `npm audit`. | Should | SEC: Service privileges and container hardening | Inspection |
| NFR-51 | All database queries shall be parameterised, participant text shall be shown as text and never as HTML, and the dashboard shall send a restrictive Content-Security-Policy header. | Must | SEC: Web application and notifications | Test, inspection |
| NFR-52 | Push and local notification texts shall carry no participant data and say only that a new activity is available. The notification of a pool invitation (FR-77) says only that a new study is available. A notification carries the prompt id, with which the app opens the right study (FR-83), and no study name. The notice that the team decided on an entry by study code (FR-94) says only that there is news about the entry and names no study. | Must | SEC: Web application and notifications | Inspection, test |
| NFR-53 | The system shall apply encryption at rest. The mechanism is under analysis with the Security course: encrypted volumes on the host, and application-level encryption of the identity table. | Could | SEC: Encryption at rest | Inspection |
| NFR-68 | The system shall never show a researcher a pool profile, a pool member identifier or the number of a group of fewer than 5, and shall refuse to send pool invitations to such a group. The pool profile holds no name, email address or phone number. The administrator overview (FR-86) hides groups of fewer than 5 as well. | Could | D2; SEC: Volunteer pool privacy | Test, inspection |
| NFR-69 | The pool invitation record shall be readable by no researcher interface or export, and shall not hold the id of the participant row created on acceptance. These limits leave two links that are declared, not removed: the invitation record links a pool member to a study for the platform, and the push token is the same for every participation on one phone. | Could | D2, D4; SEC: Volunteer pool privacy | Inspection, test |
| NFR-70 | The system shall write to `audit_log` the request for an erasure from the app, its cancellation and the final erasure, with the actor type participant (participant id only) for the first two and system for the last, and shall write each batch of pool invitations with the researcher, the study, the criteria and the number sent. | Must | D2, D3; SEC: Audit log, Erasure, retention and backups | Test |
| NFR-71 | A study code shall be stored readable in the database, so that the team can see it again, and shall give access to nothing but an invitation card and a pending or active entry in the one study it belongs to. A personal code stays stored only as a hash and is shown once. A study code shall be shown only to members of its study and to administrators, and shall appear in no export and in no response to the participant app other than the card. | Must | D6; SEC: Study codes; DM: `invite_code` | Inspection, test |
| NFR-72 | The system shall limit abuse of a study code with the per-IP attempt limit of NFR-46, a limit on the entries created from one IP address, the optional limit on the entries accepted per code per hour (off by default, with a number set by the member when switched on), the optional entry limit and the end date of FR-90, the switch-off of FR-91 and the check of FR-106 against the same phone or account entering twice. A limit that is off does not switch the others off, and approval still applies. The counter of entries shall be updated in the same statement that checks the limit (when one is set), the end date and the on state. A person waiting for approval shall hold no entries, no media and no free text. | Must | D6, D7; SEC: Study codes | Test |
| NFR-73 | The system shall write to `audit_log` the creation, change, switching off, switching on and regeneration of a study code, with the researcher, and each entry by a study code (actor type participant, participant id only, no alias before approval), and each approval and decline, with the researcher. The automatic decline when a code ends is written with the actor type system. | Must | D6, D7; SEC: Audit log | Test |
| NFR-74 | Approval of each entry shall be on by default for a study code, and the requirement of an account shall be off by default. Switching approval off shall be an explicit choice of the researcher, and the dashboard shall warn that anyone who sees the poster can then join. When approval and the entry limit are both off, the warning shall say that anyone can join, without bound, until the end date. | Should | D6, D7; SEC: Study codes | Test, inspection |
| NFR-75 | The system shall store the recovery code of an account only as an Argon2id hash with the parameters of NFR-33, and a keyed lookup value (HMAC-SHA256 with a key held as a Compose secret) to find the account, so that the hash is checked for one candidate only. A check of a code that matches no account shall run a dummy Argon2id verification, as in NFR-36. The system shall limit checks of recovery codes per IP address (NFR-46) and per account, with a progressive delay, and shall never show or log the code after the screen that creates it. | Should | D7; SEC: Participant account | Test, inspection |
| NFR-76 | The system shall store an email address of an account encrypted with AES-256-GCM under a key held as a Compose secret, because the platform has to send mail to it, and a lookup value (HMAC-SHA256 of the normalised address, with a key held as a Compose secret) to find the account. An email code has 6 digits, is stored only as a keyed hash, is valid for 10 minutes, allows 5 attempts and is invalidated when used or when a newer one is issued. The system shall allow a second code after 60 seconds and at most 5 codes per hour for one address, and shall answer a request in the same way and with the same delay whether or not an account exists. | Should | D7; SEC: Participant account | Test, inspection |
| NFR-77 | The system shall never show a researcher or an administrator, in a screen, a response, an export or the audit log, any account, account identifier, email address or device hash, and shall not tell a researcher whether a participant has an account. The link between an account and its participations shall be readable only by the API role that serves the participant. The consent text and the data protection summary shall say that the platform can link the participations of one account and that researchers cannot. | Must | D7; SEC: Participant account, Joining a study twice | Test, inspection |
| NFR-78 | The platform shall send account emails through its own mail server, reached by SMTP. In the course project that server is a local mail catcher (Mailpit) on the private network of the lab, which keeps the mail and delivers none to the Internet, so no real mail is sent and no paid service is used. The catcher is not published outside the lab network and is never mentioned in the app. A production deployment replaces it by a real mail server with no change to the application. The text of an account email names no study and holds no participant data. | Should | D7; ARCH: Components; SEC: Participant account | Inspection, demonstration |
| NFR-79 | When Google sign-in is on, the API shall verify the Google ID token before it trusts anything in it: the signature against the public keys that Google publishes (a key set cached according to its cache headers and refreshed once when the key identifier is unknown), the issuer, the audience (the client identifier of the app), the expiry and the nonce issued for this attempt. The API shall keep only the subject identifier. The option is off by default. | Could | D7; SEC: Participant account | Test, inspection |
| NFR-80 | The system shall write to `audit_log` the creation of an account, a sign-in on a new phone, the addition and removal of a method and the deletion of an account, with the actor type participant and the account identifier only, and shall write no recovery code, no email address and no Android ID in any log. | Should | D7; SEC: Participant account, Audit log | Test, inspection |
| NFR-81 | The system shall receive the Android ID only over TLS, shall compute the device hash in memory and discard the value, and shall keep the salt of each study (`study.device_salt`, at least 128 random bits) readable only by the API role. A device hash shall be unique within a study, shall be compared in constant time and shall be deleted with the participant row. | Should | D7; SEC: Joining a study twice | Test, inspection |

### Usability and language

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-54 | The dashboard shall be in Portuguese, the language of the researchers it is designed for (UNIDCOM framing) and of the mockups. | Must | UNIDCOM framing (R00); mockups | Inspection |
| NFR-55 | The dashboard should also be available in English, for researchers who do not read Portuguese. | Should | R00; open question on languages (R08) | Inspection |
| NFR-56 | The dashboard shall not show infrastructure terms to researchers. Failures of the distributed system are visible through monitoring. | Should | UNIDCOM framing (R00) | Inspection |
| NFR-57 | The system shall let participants use the app without an email address or password, and shall let a person join the volunteer pool without giving a name, email address or phone number. An account is optional: the system shall not require it, except for a study code that requires one (FR-95). The account holds no name. An email address is given only for the email method, as an address to send codes to, and is kept encrypted (NFR-76). | Must | DM: Participant identity; SEC: Principles, Participant account; D2, D7 | Inspection |
| NFR-58 | The dashboard shall show times of day in the study's time zone. | Should | SCH: Formulation; DM: Design notes | Test |

### Portability and deployment

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-59 | The whole stack shall run with Docker Compose on one Docker host, a virtual machine, and on a laptop with Docker Desktop. | Must | ARCH: Deployment | Demonstration |
| NFR-60 | The Compose project shall group the services into three logical nodes by Compose profile, each with its own containers, volumes and one member of every cluster, so that each node can later move to its own machine. | Must | ARCH: Deployment | Inspection, test |
| NFR-61 | Cluster members shall find each other by Compose service name, never by IP address. | Must | ARCH: Deployment | Inspection |
| NFR-62 | The stack shall start with one command on another machine from a fresh bootstrap with generated demonstration data, without copying the volumes of the server. | Should | ARCH: Deployment; FM: Single points of failure | Demonstration |
| NFR-63 | The participant app shall run on Android phones. Other platforms are outside the test scope. | Must | MEM: Limitations; ARCH: Components | Test, demonstration |
| NFR-64 | The dashboard shall run in a current desktop browser and be served by the API replicas. | Must | ARCH: Components | Demonstration |

### Maintainability

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| NFR-65 | Every service shall take its configuration from environment variables and secrets, with no host address written in code. | Should | ARCH: Deployment; SEC: Secrets and the public repository | Inspection |
| NFR-66 | Database changes shall be versioned migrations applied by a command. | Should | DM: status note (tables change during implementation) | Inspection |
| NFR-67 | The repository shall include automated unit and integration tests, the failure scripts and the load generator, each runnable with a documented command. | Should | SEC: How the measures will be verified; FM: Demonstration scenarios | Inspection |

### Declared limitations

These are outside the guarantees and are not requirements.

| Limitation | Source |
|---|---|
| The Docker host, its daemon, disk, power and Internet link are a single point of failure. The Garage zones share that host. | FM: Single points of failure |
| Packet loss, latency, Byzantine failures and partitions other than one node against two are not tested. | FM: Guarantees; ARCH: Networks |
| Entries still in the app queue are lost if the app is uninstalled before they are sent. The queue is not encrypted. | FM: What can be lost or repeated; SEC: Residual risks |
| Faces and voices in media are not blurred. The data is pseudonymous, not anonymous. | SEC: Residual risks; R08 |
| Push notifications are best effort. | ARCH: Notifications with a fallback |
| Incident response and the 72-hour notification duty are outside the project. | SEC: Residual risks |
| The pool invitation record shows which pool member was invited to which study, so the platform, not the researchers, can link the two. | SEC: Volunteer pool privacy |
| The push token is the same for every participation on one phone, so the platform, not the researchers, can link them. | SEC: Participant credentials |
| Exports that a team made before a participant erased their data cannot be recalled. | SEC: Erasure, retention and backups |
| A researcher who changes the criteria by one value and compares two counts of 5 or more can infer a trait of a few members. | SEC: Volunteer pool privacy |
| Anyone who holds an unlocked phone can start an erasure in the app. The 7-day window lets the participant cancel it. | SEC: Erasure, retention and backups |
| The check against joining a study twice does not detect another phone or a factory reset, which changes the Android ID, unless the person has an account. Two people who share one phone count as one person in a study. Approval of poster entries and a study code that requires an account cover these cases. | SEC: Joining a study twice |
| A person who loses the recovery code and has no other method cannot recover the account. The participations stay on the old phone, and the researcher can issue a new invite code for the same participant (FR-29). | SEC: Participant account |
| The platform, not the researchers, can link the participations and the pool membership of one account, and the entries of one phone in one study through the device hash. | SEC: Participant account, Joining a study twice |
| A deleted account stays in the backups for up to 7 days. | SEC: Participant account |
| In the course project the email codes are caught by a local mail catcher and Google sign-in is off, so only the recovery code method reaches a person outside the lab. | SEC: Participant account |

## Development requirements and constraints

| ID | Requirement | Priority | Source | Verification |
|---|---|---|---|---|
| DR-01 | Mobile app: React Native with Expo, TypeScript, SQLite for the offline queue. | Must | ARCH: Components; MEM: Technologies | Inspection |
| DR-02 | Dashboard: React with Vite, TypeScript. | Must | ARCH: Components; MEM: Technologies | Inspection |
| DR-03 | Backend: Python 3.12 with FastAPI, using psycopg 3 as the database driver so that multi-host connection strings with `target_session_attrs` are supported. | Must | ARCH: Components, Database connections | Inspection, test |
| DR-04 | Data services: PostgreSQL 17 with Patroni and etcd, RabbitMQ with quorum queues, Garage as S3-compatible storage. | Must | ARCH: Components | Inspection |
| DR-05 | Other services: Traefik and Tailscale for access, ffmpeg in the media worker, Expo Push for notifications, Prometheus and Grafana for monitoring. | Must | ARCH: Components | Inspection |
| DR-06 | The technology stack and the three logical nodes on one host shall be used as approved by the Distributed Systems lecturer (5 October 2026) and the Projeto de Desenvolvimento de Software lecturer. A change to the stack needs a new approval. | Must | MEM: Technologies; R08: Open questions | Inspection |
| DR-07 | The scheduler shall implement node consistency, AC-3, backtracking search with MRV and LCV, forward checking and a trail itself, without a solver library. Branch and bound is optional and decided during implementation. | Must | SCH: Algorithm; MEM: Summary | Inspection |
| DR-08 | The scheduler evaluation shall use generated studies of 10, 50 and 100 participants with a recorded seed, a fixed node budget instead of the wall-clock limit, the baseline of identical hours for all participants and the ablation in five variants (plain backtracking, plus forward checking, plus MRV, plus LCV, plus AC-3). | Must | SCH: Evaluation, Ablation study | Test |
| DR-09 | The stack shall be started with Docker Compose on the server and on a laptop. | Must | ARCH: Deployment; MEM: Tools | Demonstration |
| DR-10 | The source code shall be in a public GitHub repository that contains no secrets, with GitHub secret scanning and push protection enabled. | Must | SEC: Secrets and the public repository; BRF | Inspection |
| DR-11 | The documentation shall follow the archive structure required by the course: `00_Identificacao`, `01_Memoria_Descritiva`, `02_Imagens`, `03_Videos`, `04_Documentacao_Tecnica`, `05_Artefactos`, `06_Dados_Investigacao` and `07_Autorizacoes`. Folder and file names are in Portuguese and the content is in English. | Must | BRF; Fieldnote project note | Inspection |
| DR-12 | The work shall be planned in a GitHub Project with issues that have an owner, a start date, a target date, a priority, an effort estimate and an area (infrastructure, backend, mobile app, dashboard, scheduler, security, documentation), and with one milestone for each of the four deliveries (pitch, first, second, final). | Must | MEM: Methodology | Inspection |
| DR-13 | Every code change shall go through a pull request reviewed by the other team member. | Should | MEM: Methodology | Inspection |
| DR-14 | The mobile app shall be tested on Android with Expo Go and Android devices of the team. | Must | MEM: Tools, Limitations | Demonstration |
| DR-15 | The failure scenarios shall be run by scripts in `infra/chaos/` while a load generator sends entries. Each script records the time to detection, the time to recovery, failed requests and lost entries. | Must | FM: Demonstration scenarios | Demonstration |
| DR-16 | The seven security tests of the security design shall be automated: no cross-study access for researchers, no cross-participant access, revoked token on every replica, expired signed URL, no coordinates in exported media, rate limits under load, and an export with no options. | Must | SEC: How the measures will be verified | Test |
| DR-17 | The demonstration and the tests shall use generated data. No personal data of real participants is processed during the course. | Must | SEC: Why security shapes the design; R00 | Inspection |
| DR-18 | Every diagram shall keep its editable source (Mermaid, PlantUML or Python) in the team's documentation workspace, outside the repository, and the repository shall hold only the SVG and PNG exports. PNG exports shall be at least 3000 px on the long side. | Should | Fieldnote project note; Atlas rules | Inspection |
| DR-19 | Documentation shall be written in Atlas first and published to the repository as a snapshot. Technical documentation shall state its status (proposed, implemented, verified). | Should | Atlas rules | Inspection |
| DR-20 | The final delivery shall include a one-page data protection summary for ethics committees that states where data is stored, who can see it, how long it is kept and how it is erased. | Should | SEC: Consent and ethics review; R06 | Inspection |
| DR-21 | The descriptive report shall be updated with the results of the failure tests and the scheduler evaluation as they exist. | Must | MEM; BRF | Inspection |

## Traceability matrix

Columns: requirement, use cases of the use case diagram, design document and section, planned
verification, area of the GitHub Project "Fieldnote - Master Plan" and status. "None" in the use case
column marks a cross-cutting requirement with no single use case.

| ID | Use cases | Design section | Planned verification | Issue area | Status |
|---|---|---|---|---|---|
| FR-01 | UC1, UC1b, UC1c, UC23, UC25 | SEC: Participant credentials, Study codes; DM: Participant identity, `invite_code` | IT: join with valid, used, expired and wrong codes; a study code accepted by several people; ST-6 for the attempt limit; a code that requires an account sends the person to UC25 and back; the routes end on the same card | mobile app, backend | Proposed |
| FR-02 | UC1, UC1b, UC1c, UC26 | SEC: Participant credentials | IT: token stored as hash only, issued only after accepting the card; a new token on restore and on return replaces the old one; INS of secure storage use | mobile app, security | Proposed |
| FR-03 | UC1, UC1b, UC1c, UC2 | SEC: Consent and ethics review; DM: `consent` | IT: no prompt is delivered before a `consent` row exists; INS of the consent text for the device check and the account link | mobile app, backend | Proposed |
| FR-04 | UC1, UC2 | ARCH: Language; DM: `participant` | UT: every string key exists in both languages; INS of both consent texts | mobile app | Proposed |
| FR-05 | UC3, UC21 | SCH: Formulation, Replanning during the day; DM: `availability` | IT: availability changes the domains of the next plan; two participations keep separate hours | mobile app, backend | Proposed |
| FR-06 | UC4 | ARCH: Components, Notifications with a fallback | DEMO: push received on an Android phone; SE for delivery delay | mobile app, scheduler | Proposed |
| FR-07 | UC4 | ARCH: Notifications with a fallback | IT: with push disabled, a pending prompt appears on app open | mobile app, backend | Proposed |
| FR-08 | UC4 | ARCH: Notifications with a fallback | DEMO on Android: airplane mode with a planned prompt; one notification per prompt | mobile app | Proposed |
| FR-09 | UC5 | DM: `activity`, `entry` | IT and E2E: one entry of each type | mobile app | Proposed |
| FR-10 | UC5 | ARCH: File first, metadata second | UT: recording stops at 120 s | mobile app | Proposed |
| FR-11 | UC5, UC6 | DM: Design notes | IT: a queued entry keeps its `recorded_at` after a late resend | mobile app, backend | Proposed |
| FR-12 | UC5b | SEC: Principles; DM: `activity` | IT: no coordinates stored for an activity without the location flag | mobile app, backend | Proposed |
| FR-13 | UC5 | DM: Design notes (`entry.activity_id`) | IT: free entry accepted up to the cap and refused beyond it | backend, mobile app | Proposed |
| FR-14 | UC5, UC6 | ARCH: Client-generated identifiers | UT: hash is stable for equal content | mobile app | Proposed |
| FR-15 | UC6 | ARCH: How each layer tolerates failure (Client) | FS-8 | mobile app | Proposed |
| FR-16 | UC6 | ARCH: Client-generated identifiers | FS-1, FS-8 | mobile app, backend | Proposed |
| FR-17 | UC5, UC6 | ARCH: File first, metadata second | IT: upload with an expired URL, then with a new one; FS-5 | mobile app, backend | Proposed |
| FR-18 | UC6 | FM: What can be lost or repeated | DEMO: three entries in airplane mode (FS-8) | mobile app | Proposed |
| FR-19 | UC4 | DM: Design notes; SCH: Evaluation | IT: both timestamps stored; SE delivery delay | mobile app, backend | Proposed |
| FR-20 | UC7, UC20 | SEC: Authorisation | ST-2; IT: no entry listed while an erasure is scheduled | mobile app, backend | Proposed |
| FR-21 | UC4, UC5 | SEC: Consent and ethics review | INS: activity screen shows the instruction text | mobile app | Proposed |
| FR-22 | UC8 | SCH: Formulation; DM: `study` | IT: study created and values stored; E2E dashboard flow | dashboard, backend | Proposed |
| FR-23 | UC8 | DM: `study_member` | IT; ST-1 for the access check | dashboard, backend | Proposed |
| FR-24 | UC9 | DM: `activity` | IT and E2E: activity with each combination of options | dashboard, backend | Proposed |
| FR-25 | UC9, UC9b | SCH: Formulation; DM: Design notes | IT: values reach the scheduler as domains and constraints | dashboard, scheduler | Proposed |
| FR-26 | UC8 | SCH: When a prompt is left unplanned | UT: suggestion for generated studies of 10, 50 and 100 participants | dashboard | Proposed |
| FR-27 | UC9 | DM: Design notes (`activity.expected_minutes`) | UT: sum for a generated plan | dashboard | Proposed |
| FR-28 | UC10 | DM: `participant`, `participant_identity` | IT: participant created; code shown once and stored as hash | dashboard, backend | Proposed |
| FR-29 | UC10 | DM: Participant identity; SEC: Participant credentials | IT: old token refused on every API replica after revocation (ST-3) | dashboard, backend | Proposed |
| FR-30 | UC8, UC11 | SEC: Authorisation | ST-1; load test with several generated studies | backend | Proposed |
| FR-31 | UC11 | ARCH: Real time | IT: entry confirmed, event received by a dashboard; FS-1 and FS-3 for reconnection | dashboard, backend | Proposed |
| FR-32 | UC11 | DM: `prompt` | IT on generated data | dashboard | Proposed |
| FR-33 | UC11, UC12 | DM: Design notes | IT and E2E: filters on generated entries | dashboard | Proposed |
| FR-34 | UC11 | ARCH: Components | DEMO with a video converted to H.264 MP4 | dashboard | Proposed |
| FR-35 | UC9b, UC11 | SCH: When a prompt is left unplanned | IT: one instance for each reason | dashboard, scheduler | Proposed |
| FR-36 | UC11 | FM: What can be lost or repeated | IT: failed job retried and finished | dashboard, backend | Proposed |
| FR-37 | UC12 | DM: `tag`, `entry_tag` | IT and E2E | dashboard, backend | Proposed |
| FR-38 | UC10, UC16 | SEC: Pseudonymisation and the identity table | IT: reader other than owner or administrator refused; audit row written | backend, security | Proposed |
| FR-69 | UC8, UC9, UC13 | DM: `study` | IT: a draft study gets no plan; start and close change the status; export works while running and after closing | dashboard, backend, scheduler | Proposed |
| FR-39 | UC8, UC14 | SEC: Researcher and administrator authentication | IT: login, refresh, logout | dashboard, backend, security | Proposed |
| FR-40 | UC14 | SEC: Researcher and administrator authentication | IT: link works once and expires | backend, security | Proposed |
| FR-41 | UC14 | DM: `user_account` | IT and E2E | dashboard, backend | Proposed |
| FR-42 | UC15 | SEC: Authorisation | IT: administrator sees every study | dashboard, backend | Proposed |
| FR-43 | UC16 | SEC: Audit log | IT on generated events | dashboard, backend, security | Proposed |
| FR-44 | UC17, UC20 | SEC: Erasure, retention and backups | IT: rows and files absent on all replicas after erasure | backend, security | Proposed |
| FR-45 | UC9b | SCH: Formulation | IT: nightly run produces one plan per study | scheduler | Proposed |
| FR-46 | UC9b | SCH: Formulation | UT, SE: zero hard violations | scheduler | Proposed |
| FR-47 | UC9b | SCH: Formulation | UT, SE: zero hard violations | scheduler | Proposed |
| FR-48 | UC9b | SCH: Formulation | UT, SE | scheduler | Proposed |
| FR-49 | UC9b | SCH: Formulation | UT, SE: load spread against the baseline | scheduler | Proposed |
| FR-50 | UC9, UC9b | SCH: Soft preference score | UT: score on small hand-made plans; SE | scheduler | Proposed |
| FR-51 | UC9b | SCH: Partial plans | UT: one case for each reason | scheduler | Proposed |
| FR-52 | UC9b | SCH: Algorithm | SE with a deliberately hard instance | scheduler | Proposed |
| FR-53 | UC3, UC9b | SCH: Replanning during the day | IT: availability change after two prompts were sent | scheduler | Proposed |
| FR-54 | UC4 | SCH: Running the scheduler with two replicas | FS-11; FS-2 with the leader's node | scheduler, backend | Proposed |
| FR-70 | UC4, UC6 | DM: `prompt`, Design notes | IT: prompt unanswered at the end of its window becomes `expired`; an entry sent later is stored and linked to it | backend, scheduler | Proposed |
| FR-55 | UC6 | ARCH: Client-generated identifiers | IT: duplicate and collision; FS-1, FS-8 | backend | Proposed |
| FR-56 | UC5, UC6 | ARCH: Synchronous replication | FS-3 | backend | Proposed |
| FR-57 | UC6 | ARCH: Client-generated identifiers | IT: entry sent 3 days after recording is stored | backend | Proposed |
| FR-58 | UC5 | SEC: Threat model | INS of the API routes; IT: PUT and PATCH refused | backend, security | Proposed |
| FR-59 | UC5 | ARCH: Transactional outbox | FS-6; IT: broker stopped, events published after it returns | backend | Proposed |
| FR-60 | UC5 | ARCH: Components; SEC: Media files | IT: valid files, disguised HTML and SVG | backend | Proposed |
| FR-61 | UC5 | SEC: Media files | ST-5 | backend, security | Proposed |
| FR-62 | UC6 | ARCH: File first, metadata second | IT with a shortened period | backend | Proposed |
| FR-63 | UC11 | SEC: Media files | ST-1, ST-4 | backend, security | Proposed |
| FR-64 | UC13 | SEC: Pseudonymisation and the identity table; R01 | IT: CSV columns on generated data | dashboard, backend | Proposed |
| FR-65 | UC13 | SEC: Pseudonymisation and the identity table | ST-7 | backend, security | Proposed |
| FR-66 | UC13 | SEC: Pseudonymisation and the identity table | IT: each option adds only its own content | dashboard, backend | Proposed |
| FR-67 | UC13, UC16 | SEC: Audit log | IT: audit row for each export | backend, security | Proposed |
| FR-68 | UC16 | SEC: Audit log | IT: one event of each kind | backend, security | Proposed |
| FR-71 | UC1b | SEC: Participant credentials; DM: Participant identity | IT: a QR with a valid code reaches the invitation card; DEMO on Android with the camera; refused permission falls back to the typed code | mobile app, dashboard | Proposed |
| FR-72 | UC1, UC1b, UC1c | SEC: Participant credentials | IT: card shown, code still valid after decline and after decide later, consumed only on accept; ST-6 counts the card lookup | mobile app, backend | Proposed |
| FR-73 | UC18 | SEC: Volunteer pool privacy; DM: `pool_member` | IT: member created with a hashed credential and no name or contact column; the concelho is required | mobile app, backend, security | Proposed |
| FR-74 | UC18 | DM: `pool_member` | IT: each optional field accepts a value and "prefer not to say"; an edit is stored | mobile app, backend | Proposed |
| FR-75 | UC18 | SEC: Volunteer pool privacy | IT: leaving removes the row and credential at once and detaches the invitations; a paused member gets no invitation | mobile app, backend | Proposed |
| FR-76 | UC19, UC8 | SEC: Volunteer pool privacy; DM: `pool_invitation` | IT: a count of 4 shows "fewer than 5" and the send is refused; a count of 37 is shown; no route returns a profile; E2E of the dashboard flow | dashboard, backend, security | Proposed |
| FR-77 | UC19, UC1c | SEC: Web application and notifications | INS and IT of the payload; DEMO on an Android phone | backend, mobile app | Proposed |
| FR-78 | UC1c | DM: Participant identity, `pool_invitation` | IT: new alias and token, profile not copied, invitation holds no participant id, an expired invitation is refused | backend, mobile app | Proposed |
| FR-79 | UC22, UC1 | DM: `participant` | IT: a participant who left gets no new prompt and keeps the entries already sent; the researcher sees the state | mobile app, backend, scheduler | Proposed |
| FR-80 | UC20, UC1 | SEC: Erasure, retention and backups; DM: `participant` | IT: data hidden and absent from an export at once; absent from the next dump and the next bucket copy; erasure runs when due, with a shortened period and a shortened retention, and no backup holds the data; cancellation restores and the data is in the next backup; the device hash and the account link are gone after the erasure; E2E in the app | mobile app, backend, security | Proposed |
| FR-81 | UC20, UC27 | SEC: Erasure, retention and backups | IT and DEMO: two studies and the pool on one phone, then the welcome screen; both studies absent from the next dump | mobile app, backend | Proposed |
| FR-82 | UC21 | DM: Participant identity | DEMO on Android with two studies; IT: two tokens, two rows, no shared alias | mobile app | Proposed |
| FR-83 | UC21, UC4 | ARCH: Notifications with a fallback | DEMO: an open request of another study shows the banner and the mark, and a notification opens its study | mobile app | Proposed |
| FR-84 | UC3, UC21 | DM: `availability` | UT: hours copied; DEMO | mobile app | Proposed |
| FR-96 | UC25 | SEC: Participant account; DM: Participant identity | INS and DEMO: the offer appears in the settings and after the first study; the app works with no account | mobile app | Proposed |
| FR-97 | UC25 | SEC: Participant account; DM: `participant_account` | IT: the code is shown once and stored only as a hash and a lookup value; the account cannot be finished without the confirmation; DEMO on Android | mobile app, backend, security | Proposed |
| FR-98 | UC25, UC26 | SEC: Participant account; DM: `account_email_code` | IT: code valid 10 min, 5 attempts, resend after 60 s, same answer for an unknown address; DEMO with the mail catcher | mobile app, backend | Proposed |
| FR-99 | UC25, UC26 | SEC: Participant account | IT with a stubbed Google key set: valid token accepted, wrong audience, expired token and unknown key refused; the option is off by default | backend, security | Proposed |
| FR-100 | UC26 | SEC: Participant account; DM: `account_participation` | IT: sign in on a second client brings back every participation with a new token and the old token is refused; a participation with a scheduled erasure comes back and can be cancelled; DEMO on two Android phones | mobile app, backend | Proposed |
| FR-101 | UC25 | SEC: Participant account | IT: a second method added with an email code; the last method cannot be removed | mobile app, backend | Proposed |
| FR-102 | UC27 | SEC: Participant account | IT: after deletion no account row, hash, email, subject id, code or link remains, and the participations still work with their tokens | mobile app, backend | Proposed |
| FR-103 | UC27, UC20 | SEC: Participant account, Erasure, retention and backups | IT: with the box ticked, every linked participation gets an erasure due in 7 days and is absent from the next dump; the account is gone at once | mobile app, backend | Proposed |
| FR-104 | UC25, UC26, UC1 | SEC: Participant account; DM: `account_participation`, `pool_member.account_id` | IT: participations on the phone linked at creation and later ones when signed in; no researcher query returns the link; at most one participation per study | backend, security | Proposed |
| FR-105 | UC1, UC1b, UC1c | SEC: Joining a study twice; DM: `participant.device_hash`, `study.device_salt` | IT: the same Android ID gives different hashes in two studies; no Android ID in the database or logs; the lookup stores nothing | mobile app, backend, security | Proposed |
| FR-106 | UC1, UC1b, UC1c, UC20, UC22 | SEC: Joining a study twice | IT: one test for each state (active, withdrawn, erasure scheduled, pending, declined, erased), the code is not used up, a new token replaces the old; DEMO on Android with a poster scanned twice | mobile app, backend | Proposed |
| FR-85 | UC17 | SEC: Erasure, retention and backups | IT: a scheduled erasure is listed read only, with no action offered | dashboard, backend | Proposed |
| FR-86 | UC15, UC18 | SEC: Volunteer pool privacy | IT: totals and groups shown, groups of fewer than 5 hidden, no individual row | dashboard, backend, security | Proposed |
| FR-87 | UC10, UC11, UC23, UC24 | DM: `participant` | IT: entry route and states, including `pending_approval` and `declined`, on generated data | dashboard, backend | Proposed |
| FR-88 | UC23 | SEC: Study codes; DM: `invite_code` | IT: code created with its name, end date, approval flag and, optionally, a limit, a per-hour limit and the account flag, and with no limit by default; format of 8 characters; two codes in one study | dashboard, backend | Proposed |
| FR-89 | UC23 | DM: `invite_code` | IT: the code, QR and limit or "no limit" are shown after creation and on a later visit; DEMO: the poster prints on A4 with the fields listed | dashboard | Proposed |
| FR-90 | UC1, UC23 | SEC: Study codes | IT: limit of 2 reached by 5 parallel entries gives exactly 2; no limit set accepts all; a declined entry frees a place; entry refused after the end date; raising or removing the limit reopens the code | backend | Proposed |
| FR-91 | UC23 | SEC: Study codes | IT: a switched-off or replaced code gets the generic error; counter kept after regeneration, with the settings including the account flag; people already in stay | dashboard, backend | Proposed |
| FR-92 | UC1 | SEC: Study codes; DM: Participant identity | IT: two entries with one code give two rows, two aliases and two tokens, and the card does not use the code up; a second entry from the same device is answered by FR-106; DEMO on Android | mobile app, backend | Proposed |
| FR-93 | UC1, UC24 | SEC: Study codes; DM: `participant` | IT: a `pending_approval` participant gets no plan, no prompt and no count in the study numbers; with approval off the participant is active at once, with the alias; with approval on the alias is assigned at approval | mobile app, backend, scheduler | Proposed |
| FR-94 | UC24, UC16 | SEC: Study codes, Audit log | IT: the list shows no alias and no identity; approve gives alias and status; decline deletes consent, hours and push token; automatic decline when the code ends, with a shortened period, and the declined entry no longer counts; the reminder appears 24 h before the end; E2E of the dashboard flow | dashboard, backend, security | Proposed |
| FR-95 | UC23, UC1, UC25 | SEC: Study codes, Participant account | IT: a code with the option on gives the card but refuses acceptance from a phone with no account, and accepts one that is signed in; the option is off by default; the dashboard shows no account | dashboard, backend, mobile app | Proposed |
| NFR-01 | UC5, UC6, UC11 | FM: Guarantees | FS-2, FS-7 | infrastructure | Proposed |
| NFR-02 | UC5, UC6 | FM: Guarantees | Extension of FS-2 with two nodes stopped | infrastructure, mobile app | Proposed |
| NFR-03 | UC5, UC6 | FM: Guarantees; ARCH: Synchronous replication | FS-1, FS-3 with a load generator counting lost entries | infrastructure, backend | Proposed |
| NFR-04 | UC5 | FM: Recovery time targets | FS-1 | infrastructure, backend | Proposed |
| NFR-05 | UC5 | FM: Guarantees | FS-1, FS-2 | infrastructure | Proposed |
| NFR-06 | UC5, UC11 | FM: Recovery time targets | FS-10; FS-2 with the node of the first gateway | infrastructure, mobile app, dashboard | Proposed |
| NFR-07 | UC4, UC9b | FM: Recovery time targets | FS-11; FS-2 with the leader's node | infrastructure, scheduler | Proposed |
| NFR-08 | UC5 | FM: Recovery time targets; ARCH: Synchronous replication | FS-3 | infrastructure | Proposed |
| NFR-09 | UC5 | FM: Recovery time targets | FS-4 | infrastructure | Proposed |
| NFR-10 | UC5, UC6 | FM: Recovery time targets | FS-5, FS-6 | infrastructure | Proposed |
| NFR-11 | UC5 | FM: Demonstration scenarios | FS-7 | infrastructure | Proposed |
| NFR-12 | UC5 | FM: What can be lost or repeated | IT: job that always fails | backend | Proposed |
| NFR-13 | UC17, UC20 | FM: Single points of failure; SEC: Erasure, retention and backups | FS-9; INS of the key location; IT: dump and bucket copy made while a participant is `erasure_scheduled` hold none of their rows or objects | infrastructure, security | Proposed |
| NFR-14 | UC17 | FM: Demonstration scenarios | FS-9 | infrastructure | Proposed |
| NFR-15 | None | ARCH: Components | DEMO: alerts fire in FS-1 to FS-11 | infrastructure | Proposed |
| NFR-16 | UC5 | ARCH: Synchronous replication | INS of the Patroni configuration; FS-3, FS-4 | infrastructure | Proposed |
| NFR-17 | UC5, UC6 | ARCH: Synchronous replication | INS; IT with a delayed replica | backend | Proposed |
| NFR-18 | UC5 | ARCH: Components | INS of the Garage layout; FS-5 | infrastructure | Proposed |
| NFR-19 | UC5 | ARCH: Transactional outbox | FS-6; IT: duplicate event | backend, infrastructure | Proposed |
| NFR-20 | UC5 | ARCH: Database connections | FS-3 | backend | Proposed |
| NFR-21 | UC5 | ARCH: Database connections | FS-7 with the primary's node isolated | infrastructure | Proposed |
| NFR-22 | UC4, UC9b | SCH: Running the scheduler with two replicas | FS-2, FS-7, FS-11 | scheduler | Proposed |
| NFR-23 | UC4, UC9b | DM: Design notes | IT: second insert refused | backend, scheduler | Proposed |
| NFR-24 | UC5 | ARCH: Transactional outbox | FS-1, FS-6 | backend | Proposed |
| NFR-25 | UC9b | SCH: Evaluation | SE on generated studies of 10, 50 and 100 participants with a seed | scheduler | Proposed |
| NFR-26 | UC9b | SCH: Evaluation | SE and AB with a fixed node budget | scheduler | Proposed |
| NFR-27 | UC5, UC6 | ARCH: Why the system is distributed | Load test with generated entries, with FS-1 and FS-3 running | infrastructure, backend | Proposed |
| NFR-28 | UC8, UC11 | ARCH: Why the system is distributed | Load test with 3 generated studies | backend, infrastructure | Proposed |
| NFR-29 | UC5, UC6 | ARCH: File first, metadata second | INS of the upload path and a traffic check | backend, infrastructure | Proposed |
| NFR-30 | UC5 | ARCH: Transactional outbox | IT: entry confirmed while the media worker is stopped | backend | Proposed |
| NFR-31 | UC11 | ARCH: Real time | Load test measuring confirmation to display | dashboard, backend | Proposed |
| NFR-32 | UC11 | ARCH: Real time | FS-1, FS-2: the dashboard keeps a complete list | dashboard, backend | Proposed |
| NFR-33 | UC14 | SEC: Researcher and administrator authentication | UT: hash parameters | security, backend | Proposed |
| NFR-34 | UC8, UC14 | SEC: Researcher and administrator authentication | ST-3; IT: reuse detection | security, backend | Proposed |
| NFR-35 | UC8 | SEC: Researcher and administrator authentication | INS of the cookie flags | dashboard, security | Proposed |
| NFR-36 | UC14 | SEC: Researcher and administrator authentication | IT: lockout; response times for known and unknown emails | security, backend | Proposed |
| NFR-37 | UC14, UC15, UC16, UC17 | SEC: Researcher and administrator authentication | IT: administrator login without a code is refused | security, backend | Proposed |
| NFR-38 | UC7, UC11, UC13 | SEC: Authorisation | ST-1, ST-2 | security, backend | Proposed |
| NFR-39 | UC1, UC1b | SEC: Participant credentials | INS: use of `hmac.compare_digest` | security, backend | Proposed |
| NFR-40 | UC5, UC6, UC11 | SEC: Media files | ST-4; IT: oversized and wrong-type upload refused | security, backend | Proposed |
| NFR-41 | UC11 | SEC: Media files | INS of the Traefik configuration; IT on headers | security, infrastructure | Proposed |
| NFR-42 | UC10, UC13, UC1c, UC25 | DM: Participant identity | IT: no identity field in entry queries; INS of the schema; no researcher query returns an account link or a device hash | security, backend | Proposed |
| NFR-43 | UC16, UC17 | SEC: Audit log | IT: UPDATE and DELETE refused for the service role | security, backend | Proposed |
| NFR-44 | UC17, UC20, UC2 | SEC: Erasure, retention and backups | IT: erasure with all nodes up; for the app path, a backup drill with a shortened retention shows no copy on the erasure date; INS of the consent text | security, backend | Proposed |
| NFR-45 | None | SEC: Network access and transport | INS of the Compose files; port scan from outside the tailnet | security, infrastructure | Proposed |
| NFR-46 | UC1, UC1b, UC14, UC26 | SEC: Network access and transport | ST-6, with a study code included; IT: recovery code and email code checks are throttled per IP, per account and per address | security, infrastructure | Proposed |
| NFR-47 | None | SEC: Secrets and the public repository | INS of the repository and the Compose files | security, infrastructure | Proposed |
| NFR-48 | None | SEC: Service privileges and container hardening | IT: forbidden queries refused for each role | security, backend | Proposed |
| NFR-49 | None | SEC: Service privileges and container hardening | INS of the Compose files | security, infrastructure | Proposed |
| NFR-50 | None | SEC: Service privileges and container hardening | INS of the reports | security | Proposed |
| NFR-51 | UC11 | SEC: Web application and notifications | IT: injection and script strings in entries | security, dashboard | Proposed |
| NFR-52 | UC4, UC1c, UC21, UC24 | SEC: Web application and notifications | INS and IT of the notification payload | security, scheduler | Proposed |
| NFR-53 | None | SEC: Encryption at rest | Decision recorded, then INS | security, infrastructure | Proposed |
| NFR-54 | UC8 to UC17, UC19, UC23, UC24 | UNIDCOM framing (R00); mockups | INS | dashboard | Proposed |
| NFR-55 | UC8 to UC17, UC19, UC23, UC24 | R00; open question on languages (R08) | INS | dashboard | Proposed |
| NFR-56 | UC11 | ARCH: Components | INS of the dashboard texts | dashboard | Proposed |
| NFR-57 | UC1, UC18, UC25 | DM: Participant identity | INS and DEMO of the join flow, with and without an account | mobile app | Proposed |
| NFR-58 | UC9, UC11 | DM: Design notes | IT: study in a time zone different from the browser | dashboard | Proposed |
| NFR-59 | None | ARCH: Deployment | DEMO on both hosts | infrastructure | Proposed |
| NFR-60 | None | ARCH: Deployment | INS; FS-2 | infrastructure | Proposed |
| NFR-61 | None | ARCH: Deployment | INS; FS-2 (containers recreated) | infrastructure | Proposed |
| NFR-62 | None | ARCH: Deployment | DEMO on the laptop | infrastructure | Proposed |
| NFR-63 | UC1 to UC7, UC18, UC20 to UC22 | ARCH: Components | DEMO and tests on the team's Android devices | mobile app | Proposed |
| NFR-64 | UC8 to UC17, UC19, UC23, UC24 | ARCH: Components | DEMO in Chrome | dashboard | Proposed |
| NFR-65 | None | ARCH: Deployment | INS | infrastructure, backend | Proposed |
| NFR-66 | None | DM: status note | INS: schema built from migrations on an empty database | backend | Proposed |
| NFR-67 | None | SEC: How the measures will be verified; FM: Demonstration scenarios | INS: the README lists the commands | documentation, infrastructure | Proposed |
| NFR-68 | UC18, UC19 | SEC: Volunteer pool privacy | IT: no profile in any researcher response; groups of fewer than 5 hidden; INS of the schema for name, email and phone | security, backend | Proposed |
| NFR-69 | UC1c, UC19 | SEC: Volunteer pool privacy; DM: Participant identity | INS of the researcher routes and exports; IT: the invitation record is in no response | security, backend | Proposed |
| NFR-70 | UC16, UC20 | SEC: Audit log, Erasure, retention and backups | IT: three audit rows with the right actor types for one erasure, and one row for each batch of invitations | security, backend | Proposed |
| NFR-71 | UC1, UC23 | SEC: Study codes; DM: `invite_code` | INS of the schema (readable value only for the study kind); IT: the code is in no export and no app response other than the card | security, backend | Proposed |
| NFR-72 | UC1, UC23 | SEC: Study codes | IT: per-IP and per-code limits under load, with the per-hour limit off and on; parallel entries do not pass the limit; the same device twice is refused; ST-6 | security, backend | Proposed |
| NFR-73 | UC16, UC23, UC24 | SEC: Audit log, Study codes | IT: one audit row for each action and entry, and one with the actor type system for an automatic decline, with the right actor types | security, backend | Proposed |
| NFR-74 | UC23 | SEC: Study codes | INS and DEMO: approval on and account off by default, the warning when approval is switched off and the stronger one when the limit is off too | dashboard | Proposed |
| NFR-75 | UC25, UC26 | SEC: Participant account | INS of the schema (Argon2id hash and keyed lookup value only); IT: a wrong code takes the same time as a right one within a margin, attempts are throttled | security, backend | Proposed |
| NFR-76 | UC25, UC26 | SEC: Participant account; DM: `participant_account`, `account_email_code` | INS: email encrypted and keyed lookup value; IT: expiry, 5 attempts, resend limits and an identical answer for known and unknown addresses | security, backend | Proposed |
| NFR-77 | UC25, UC26, UC10, UC13 | SEC: Participant account, Joining a study twice | IT: no researcher or administrator route, export or log shows an account, an email address or a device hash; INS of the consent text | security, backend, dashboard | Proposed |
| NFR-78 | UC25, UC26 | ARCH: Components; SEC: Participant account | DEMO: the code mail appears in the mail catcher and nothing leaves the lab network; INS of the Compose file and the app texts | infrastructure, backend | Proposed |
| NFR-79 | UC25, UC26 | SEC: Participant account | IT with a stubbed key set (see FR-99) | security, backend | Proposed |
| NFR-80 | UC25, UC26, UC27, UC16 | SEC: Participant account, Audit log | IT: one audit row for each account event with the right actor type; INS of the logs for secrets | security, backend | Proposed |
| NFR-81 | UC1, UC1b, UC1c | SEC: Joining a study twice | INS: no Android ID in the database or the logs; IT: the hash is unique in a study and deleted with the row | security, backend | Proposed |
| DR-01 | None | ARCH: Components | INS of the repository | mobile app | Proposed |
| DR-02 | None | ARCH: Components | INS | dashboard | Proposed |
| DR-03 | None | ARCH: Database connections | IT: connection after FS-3 | backend | Proposed |
| DR-04 | None | ARCH: Components | INS of the Compose files | infrastructure | Proposed |
| DR-05 | None | ARCH: Components | INS | infrastructure | Proposed |
| DR-06 | None | ARCH: status note | Written confirmation recorded in Cortex | documentation | Proposed |
| DR-07 | None | SCH: Algorithm | INS of the dependencies | scheduler | Proposed |
| DR-08 | None | SCH: Evaluation | SE, AB | scheduler | Proposed |
| DR-09 | None | ARCH: Deployment | DEMO | infrastructure | Proposed |
| DR-10 | None | SEC: Secrets and the public repository | INS | security, documentation | Proposed |
| DR-11 | None | Fieldnote project note | INS before each delivery | documentation | Proposed |
| DR-12 | None | MEM: Methodology | INS of the board | documentation | Proposed |
| DR-13 | None | MEM: Methodology | INS of the repository | documentation | Proposed |
| DR-14 | None | MEM: Limitations | DEMO | mobile app | Proposed |
| DR-15 | None | FM: Demonstration scenarios | FS-1 to FS-11 | infrastructure | Proposed |
| DR-16 | None | SEC: How the measures will be verified | ST-1 to ST-7 | security | Proposed |
| DR-17 | None | SEC: Why security shapes the design | INS of the demonstration data | documentation, security | Proposed |
| DR-18 | None | Fieldnote project note | INS | documentation | Proposed |
| DR-19 | None | Atlas rules | INS | documentation | Proposed |
| DR-20 | None | SEC: Consent and ethics review | INS | documentation | Proposed |
| DR-21 | None | MEM | INS | documentation | Proposed |

## Related documents

- [Personas and scenarios](personas-and-scenarios.md)
- [Use cases](use-cases.md)
- [Architecture](../architecture.md)
- [Fault model](../fault-model.md)
- [Data model](../data-model.md)
- [Scheduler](../scheduler.md)
- [Security](../security.md)
