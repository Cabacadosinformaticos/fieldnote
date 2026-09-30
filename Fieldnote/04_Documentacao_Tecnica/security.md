# Security

Status: proposed, 29 September 2026. Nothing described here is implemented yet. The threat model
follows STRIDE over the data flows in the [architecture](architecture.md): participant app,
dashboard, gateways, API, media worker, scheduler, database and object storage. The message broker
carries only internal job and event messages between services on the `cluster` network and is covered
through the service privileges, not as a flow of its own. The measures below are the design;
items marked "under analysis" or "considered" are not part of it yet.

## Why security shapes the design

Fieldnote stores what people record about their own lives for days or weeks: text, photos, audio,
video and locations, several times a day. Photos, voices and locations identify people even under an
alias, and depending on the study the entries can reveal health, religious belief or other special
categories of data under Article 9 of the GDPR. The platform cannot know which studies do, so it treats every study alike.

Security also pulls against fault tolerance. The platform keeps three copies of every row and file, and
daily backups on another machine. Each copy is one more place from which data can leak and from which it
has to be erased. The design limits this cost: backups are encrypted before they leave the host, identity
lives in one table that is easier to protect than the whole database, and erasure is written to reach
every replica and every backup. The project is a proof of concept with generated data; no personal data
of real participants is processed during the course.

## Principles

Five principles organise the measures. Minimisation: the platform collects only what a study needs.
Participants have no account, email address or password, location is off unless an activity asks for
it, and the scheduler plans from declared availability instead of watching the phone. Separation of
identity: researchers work with aliases, and names and emails live in a separate table with its own
access rule. Pseudonymised data remains personal data while the linking information exists (EDPB
guidelines 01/2025), so that table is the most sensitive part of the database. Small attack surface:
no port is open to the Internet and everything behind the gateways stays on internal Docker networks.
Defence in depth: a request passes the private network, TLS, authentication and authorisation by role and by
study, and each layer must hold even if the one before it fails; the audit log blocks nothing and records
what happened. Least
privilege: each service has its own credentials, and a researcher sees only their own studies.

## Assets and threat actors

## Assets and threat actors

The main asset is the entries: text, photos, audio, video and locations. They show the private life of
participants and may reveal health or beliefs. They live in PostgreSQL (text and metadata) and Garage
(files), three copies of each. The participant identities, in `participant_identity`, link aliases to
real people. Researcher and administrator accounts (`user_account`, `refresh_token`) give access to
whole studies. The signing keys for tokens and upload URLs, kept as Compose secrets on the host, let
whoever holds them impersonate any user. Backups on another machine contain everything, including data
erased less than 7 days ago, and are encrypted. The audit log (`audit_log`) is the evidence of who did
what.

The most plausible actor is the curious participant, who has the app and a valid token and may read other
participants' entries or tamper with their own token. A researcher of another study has a valid account
and may try to read studies they do not belong to; plausibility is medium. A malicious administrator or
team member could read identities or export data. Plausibility is low, but the impact is total, and the
design mitigates it by audit, not by prevention. An external attacker may exploit the API or the
dashboard: low while the platform is only on the private network, high in a public deployment. Someone
who steals a phone can see that participant's entries, with medium plausibility. A compromised service,
for example the media worker through a malicious file, could move sideways to the database; this is
unlikely, and it is the reason for least privilege between services.

## Threat model

STRIDE classifies threats in six types: spoofing, tampering, repudiation, information disclosure,
denial of service and elevation of privilege. The table is a first pass with one row per data flow
and threat. The final threat model will add the residual risk of each row.

| Flow | Threat | Measure |
|---|---|---|
| Participant app to API | S: using another participant's token | Device token exchanged for the invite code; random 256-bit value, stored only as a SHA-256 hash, revocable by the researcher |
| Participant app to API | T: changing an entry after it was sent | No API edits an entry; the content hash only detects resends and UUID collisions |
| Participant app to object storage | I: a file URL is shared or guessed | Signed URLs valid for 10 minutes and for one object |
| Participant app to object storage | D: filling storage with huge uploads | Maximum size and content type signed into the upload URL and enforced by storage |
| Dashboard to API | S: stealing researcher credentials | Argon2id, 15-minute access tokens, rotating refresh tokens with reuse detection, per-account lockout, TOTP for administrators |
| Dashboard to API | E: a researcher reaches a study that is not theirs | Role and study membership checked on every request |
| Dashboard to API | R: a researcher denies having exported data | Every export is written to the audit log with the content chosen |
| Dashboard to API | I: an export that identifies people | Exports leave out identity, location and media by default |
| API to PostgreSQL | I: reading the identity table | Read limited to the study owner and administrators, and audited |
| Media worker to object storage | E: a malicious file exploits ffmpeg | Own credentials without access to identities; non-root container, not privileged, all capabilities dropped |
| Media worker | I: GPS in photos | Metadata stripped when the activity does not ask for location; original not downloadable until processed |
| Clients to gateways | D: excess of requests | Rate limits per IP at Traefik, per-account login throttling in the API, three API replicas |
| Clients to gateways | I: eavesdropping | WireGuard through Tailscale, with HTTPS on top |
| Scheduler to push service, local notifications | I: notification text on a lock screen | Texts carry no participant data |
| Administration to host | E: host access gives access to everything | Reached only through the private network; secrets are files readable only by the containers that need them |

Two threats deserve a note. A researcher reading another study is the typical failure of APIs, listed
first in the OWASP API Security Top 10 (2023) as broken object level authorisation, so the membership
check is part of every request. A compromised media worker is plausible because it parses files that
participants control; it has no credentials for identities, accounts or text entries, so a bug in
ffmpeg reaches files and processing status only.

## Network access and transport

Clients reach the gateways only through Tailscale, a private network built on WireGuard. No port is
open to the Internet, so an external attacker cannot see the API at all. On top of WireGuard the
gateways serve HTTPS, with the certificate Tailscale issues for each gateway address. If the
private network were compromised, the traffic would still be encrypted.

Traffic between nodes stays on the `cluster` Docker network, which is not published on the host. The
`edge` network joins the gateways to the API replicas and the Garage S3 endpoints; the database, etcd
and RabbitMQ are not on it.

Rate limiting runs at Traefik per IP, since the gateway does not see users, and the API throttles logins per
account. This limits abuse by one address or account, not a distributed attack; in a public deployment that role would belong to the protection at the edge of the
Cloudflare Tunnel described in the architecture.

Tailnet access rules that separate test devices from administration machines are considered, not
designed.

## Researcher and administrator authentication

Researchers and administrators have accounts; participants do not. Passwords are stored as Argon2id
hashes. Argon2id is the first choice of the OWASP password storage cheat sheet; it is slow on purpose
and memory-hungry, which makes GPU attacks expensive. The design uses at least the OWASP minimum: 19 MiB of memory, 2 iterations and
parallelism 1.

A login returns a short-lived access token valid for 15 minutes and a refresh token. The refresh token
changes on every use and is stored as a hash in the database (`refresh_token`). Because it lives in
the database, any API replica can revoke it, which a self-contained JWT does not allow. The access
token is not revoked; it expires, so a revoked session can keep working for up to 15 minutes.

Each login starts a token family. Superseded refresh tokens are kept as hashes until the family
expires. If one of them is presented again, someone copied it, and the API revokes the whole family
(reuse detection). Keeping only the hash of the current token would not be enough: an old token would
just return a 401 and the attacker's copy would stay valid.

In the dashboard the refresh token lives in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie and
the access token only in memory. JavaScript never reads the refresh token, which reduces the damage
of a cross-site scripting flaw.

Login has further protection on top of the per-IP rate limit. After repeated failures an account gets
a progressive delay and then a temporary lockout, which defends against brute force and against
credential stuffing spread over many addresses. An unknown email and a wrong password return the same
error message, and for an unknown email the API still runs a dummy Argon2id verification, so the
response time does not reveal which emails have an account. Time-based one-time passwords (TOTP) are
mandatory for administrators. A password reset uses a single-use link valid for 30 minutes, sent to
the account's email.

## Participant credentials

A participant joins with a single-use invite code and receives a device token. There are no
participant passwords to store, leak or reset, the study needs no email address, and the same person in
two studies is two unrelated rows, so their diaries cannot be joined. The research platform m-Path uses
the same pattern. The cost is portability: on a new phone the researcher issues a new invite code for the
same participant row.

The invite code has 10 characters from an alphabet of 32 symbols, about 50 bits, expires after 7
days, can be used once and has an attempt limit per IP, which makes guessing impractical. It is the
participant's only credential before they hold a token, so the database stores only its SHA-256 hash
(`participant.invite_code_hash`).

The device token is a random 256-bit value. It has enough entropy that a fast hash is enough, so it is
stored only as a SHA-256 hash and the researcher can revoke it. Argon2id is reserved for passwords
chosen by people, which have little entropy. Invite codes, device tokens and refresh tokens are
compared in constant time (`hmac.compare_digest`). On the phone the device token is kept in the system's secure storage:
Keychain on iOS and Keystore on Android, through `expo-secure-store`.

## Authorisation

There are three roles: administrator, researcher and participant. A researcher sees only the studies
where they are a member (`study_member`), and a participant sees only their own entries. Every request
checks that the user belongs to the study of the object requested.

## Pseudonymisation and the identity table

Researchers see aliases. Names and emails, when the researcher has them, live in
`participant_identity`, readable only by the study owner and administrators. Every read of the table
is written to the audit log.

Exports are where pseudonymisation is easiest to undo: de Montjoye et al. (2013) found that four
spatio-temporal points identify 95% of individuals in mobility data. An export leaves out identity,
location and media files by default. Including any of them is an explicit choice by the researcher and
is recorded in the audit log.

Encrypting the columns of `participant_identity` in the application, with a key only the API holds, is
under analysis (see encryption at rest below).

## Media files

Files travel between the phone and object storage through signed URLs issued by the API. The
URL is valid for 10 minutes and for one object. Large files do not pass through the API, and a leaked URL works for at most 10 minutes, on one object.
Four measures close the remaining gaps.

Upload URLs also sign the maximum size and the content type, so object storage refuses oversized or
unexpected files whatever the app does.

The signature travels in the query string, so Traefik logs the `/media` route without the query
string. By default it would log the full URL.

A download does not pass through the API, so the audit log records the issue of every URL: who asked,
for which object and when, so a download stays attributable to a person.

The media worker checks the real type of each file from its first bytes, not from its extension, and
rejects anything that is not an image, audio or video. Files are served with their content type and
`Content-Disposition: attachment`, so a disguised HTML or SVG file cannot run inside the dashboard
(stored cross-site scripting).

Photos from phones carry GPS coordinates in EXIF, and videos carry them in metadata atoms such as
those of MP4. ffmpeg copies metadata by default. When the activity does not ask for location, the
media worker strips the metadata of every media type (EXIF in photos, metadata atoms in videos, tags
in audio), including GPS, and replaces the original file. Once processing succeeds, no copy with the
location remains downloadable. Until then, and if processing fails, the original stays in object
storage but is not offered for download or export; the dashboard offers a retry.

This handles location only. Faces, voices, documents and house numbers stay in the media. The consent
section describes the guidance given to participants.

## Audit log

`audit_log` records logins, exports, issued media URLs, reads of `participant_identity`, changes to
studies, erasures and system jobs, with the type of actor: user, participant or system. The log is
append only. The services write to it with a database role that has `INSERT` on the table and no
`UPDATE` or `DELETE`. This protects the log against a compromised service, not against a database
administrator, who can change anything.

A hash chain, where each row stores the hash of the previous one, is considered but would not close
that gap alone, because whoever can write to the table can recompute the chain. It would help only if
the latest hash were stored periodically somewhere that administrator does not control, such as another
machine. With several writers (three API replicas, the scheduler and the media worker) a single chain
also needs ordered insertion, for example one chain per writer.

The log survives the erasure of a participant, with pseudonymous identifiers only: the participant id,
never the name. It is kept for the duration of the course; a real deployment would have to define a
retention period.

## Erasure, retention and backups

The platform can erase every copy it holds in the live system. Erasing a participant removes their identity
and their entries from the three database nodes (primary and two replicas) and every copy of their files
from the three copies of each file. Every erasure is written to the audit log. Three things stay outside
it: the audit log keeps pseudonymous ids, entries still in a phone's offline queue are out of reach until
they are sent, and backups keep the data for up to 7 days.

Whether a request must be granted is the research team's decision: Article 17 of the GDPR has an
exception for research, which applies with the safeguards of Article 89(1) when erasure would make the
research impossible or seriously impair it. The platform provides the mechanism, not the policy.

Backups are the other copy to consider. The daily `pg_dump` and the copy of the object storage bucket
are kept for 7 days, so erased data leaves the last backup at most 7 days later, and the consent text will
say so.

Backups contain the identity table and photos that may still have GPS, so they are encrypted on the host
before they leave it, with a public key whose private key is kept off the host, for example with `age`.
A restore of the latest backup on a clean stack is scenario 9 of the [fault model](fault-model.md),
because a backup that has never been restored is not proven.

## Encryption at rest

Encryption at rest is under analysis with the Security course. The analysis has to cover where the keys
live and what happens to recovery if one is lost. Three options are on the table.

| Option | Protects against | Does not protect against | Cost |
|---|---|---|---|
| Encrypted volumes on the Docker host, for example LUKS | Theft of the disk or of a powered-off machine | An attacker with access to the running host | Low; the key must be available at boot |
| Application-level encryption of the identity columns | A stolen copy of the database or of a backup | A compromised API, which holds the key | Medium; searching by name stops working |
| Encryption of files with keys managed by the API | Direct access to object storage | A compromised API | High; losing the key makes files unrecoverable, and because the app uploads straight to storage, encryption would have to be done by storage with keys supplied in the request, or afterwards by the media worker |

A key on the same host protects little against someone who enters the host. The combination under
discussion is encrypted volumes for everything plus application-level encryption for the identity
table only, which is small and the most sensitive.

## Secrets and the public repository

The repository is public. Signing keys and the passwords for the database,
RabbitMQ and Garage are Docker Compose secrets: files on the host mounted only in the containers that
need them. Non-secret settings go in an `.env` file, also outside the repository. The repository will hold an
`.env.example` file without values. GitHub secret scanning with push protection is enabled, which is free for
public repositories and blocks known secret formats before they reach the repository. Running a
secret-detection tool before each commit is considered as an extra layer.

## Service privileges and container hardening

Each service has its own credentials for the database, RabbitMQ and object storage, with only the
permissions it needs.

| Service | Can | Cannot |
|---|---|---|
| API | Read and write studies, entries and prompts; read identities with audit | Change or delete the audit log |
| Media worker | Read and write files; update media status | Read identities, accounts or text entries |
| Scheduler | Read studies, activities and availability; write prompts | Access files or identities |

Containers run as non-root users, drop all Linux capabilities (`cap_drop: [ALL]`) and are never
privileged. File systems are read-only where possible. Images are pinned by digest, so a tag cannot
change underneath the stack. Dependabot, `pip-audit` and `npm audit` report vulnerable dependencies.

## Web application and notifications

All database queries are parameterised; user text is never concatenated into SQL. Participant text is
shown in the dashboard as text and never as HTML, React escapes it by default, raw HTML insertion is not
used, and the dashboard sends a restrictive Content-Security-Policy header. Access tokens travel in the
`Authorization` header, which a third-party site cannot set, so cross-site requests cannot use them, and
the refresh cookie is `SameSite=Strict`.

Push and local notifications appear on the lock screen. Their text carries no participant data; it says
only that a new activity is available.

## Consent and ethics review

The platform records informed consent. Participants accept it in the app before the first activity, and
the accepted version is stored (`consent`). The consent text will state that daily backups keep erased
data for up to 7 days. It will also say what participants should avoid photographing or recording:
people who have not agreed to take part, documents and house numbers. The instruction the researcher
writes in each activity repeats this guidance.

Informed consent in research ethics and consent as a legal basis under the GDPR are different things;
a university may rely on a task in the public interest instead. The legal basis, the data management
plan and, when needed, the impact assessment belong to the study. Fieldnote supplies the technical
measures.

A one-page data protection summary for ethics committees is planned for the final delivery. It states
where data is stored, who can see it, how long it is kept and how it is erased.

## How the measures will be verified

Each measure is treated as a requirement. The planned automated tests are:

- A researcher cannot read or export studies they do not belong to.
- A participant cannot read the entries of another participant.
- A revoked token stops working on every API replica.
- A signed URL stops working after it expires.
- Exported photos, videos and audio carry no coordinates in their metadata when the activity does not
  ask for location.
- Rate limits are applied under load.
- An export with no options contains no identity, location or media.

An OWASP ZAP scan of the API and a check against OWASP ASVS level 1 are considered if time allows.

## Residual risks

The host is a single point of failure and of security: whoever controls it holds the volumes and the
secrets. Encrypted backups with the key off the host limit the damage, and so would application-level
encryption of the identity table if adopted.

An administrator with direct access to the database can read and change data, including the audit
log; detecting that would need the external hash anchoring described above.

The offline queue on the phone is not encrypted. It sits in the app's private SQLite database, so on an
unlocked stolen phone the entries not yet sent can be seen, and a thief can send false entries in that
participant's name until the researcher revokes the token. Encrypting the local queue is future work.

The platform does not blur faces or voices in media automatically, so people who appear or speak in a
photo, video or recording stay identifiable; automatic face blurring in exports is future work.

External services handle some data for the study: Expo Push and FCM receive the notification token
and text, and Tailscale coordinates the network; Cloudflare would join them in a public deployment. The controller has to consider them under Article 28 of the GDPR.

A public deployment changes the threat model. The external attacker becomes highly plausible, and rate
limits, input validation and protection against cross-site scripting and injection become the first
line. This design does not test that case. Incident response, including the 72-hour notification
duty of Article 33, is outside the scope of the project.

## Related documents

- [Architecture](architecture.md)
- [Data model](data-model.md)
- [Fault model](fault-model.md)
- [Scheduler](scheduler.md)
