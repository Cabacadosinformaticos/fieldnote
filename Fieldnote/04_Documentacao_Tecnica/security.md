# Security

Status: proposed, 2 October 2026; stale statements reconciled on 3 October 2026 (first written on 29 September 2026; the volunteer pool, erasure from the app and several studies on one phone were added on 2 October, and later that day the study codes and the exclusion of pending erasures from the backups; the optional participant account, the device check against joining twice and the final rules of the study codes came in a third decision of the same day). Nothing described here is implemented yet. The threat model
follows STRIDE over the data flows in the [architecture](architecture.md): participant app,
dashboard, gateways, API, media worker, scheduler, database and object storage. The message broker
carries only internal job and event messages between services on the `cluster` network and is covered
through the service privileges, not as a flow of its own. The measures below are the design;
items marked "under analysis" or "considered" are not part of it yet. The security design still waits for validation by the Information Security lecturers.

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
Participants need no account, email address or password (an account is optional and holds no name), location is off unless an activity asks for
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

The main asset is the entries: text, photos, audio, video and locations. They show the private life of
participants and may reveal health or beliefs. They live in PostgreSQL (text and metadata) and Garage
(files), three copies of each. The participant identities, in `participant_identity`, link aliases to
real people. Researcher and administrator accounts (`user_account`, `refresh_token`) give access to
whole studies. The signing keys for tokens and upload URLs, kept as Compose secrets on the host, let
whoever holds them impersonate any user. Backups on another machine contain everything, including data
erased by the manual route less than 7 days ago, and are encrypted. They do not contain the data of participants whose erasure from the app is pending. The audit log (`audit_log`) is the evidence of who did
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
| Participant app to API | S, I: stealing or losing a recovery code | 80 bits, shown once, stored only as an Argon2id hash with a keyed lookup value; attempts limited per IP and per account. A lost code with no other method cannot be recovered, a declared limit. See participant account |
| Participant app to API | S: brute force of a 6-digit email code | 10 minutes, 5 attempts, a newer code replaces the older one, 60 s between codes and 5 codes per hour for an address, the same answer for known and unknown addresses. See participant account |
| Participant app to API | S, E: account takeover | An account needs a method the person holds. The email is the weakest link: whoever controls the mailbox controls the account, which is why the recovery code is the default. A restore replaces the device tokens, so the old phone stops working and the person can see the change. See participant account |
| Participant app to API | S: a forged Google sign-in | The ID token is accepted only after the signature is checked against the public keys of Google, with issuer, audience, expiry and nonce. See participant account |
| API to PostgreSQL | I: linking participations through an account or a device hash | The account link is a table that no researcher query reads, the device hash is salted for each study, and the Android ID is stored nowhere. The platform can still link participations of one account: declared limitation |
| Participant app to API | I: guessing invite codes through the invitation card | The lookup that precedes the card counts as an attempt under the per-IP limit, and the card shows study information only, never participant data |
| Participant app to API | R, E: an erasure or a withdrawal started by someone who holds the unlocked phone | The request, the cancellation and the erasure are in the audit log; the state is visible in the app and the participant can cancel for 7 days. Residual risk below |
| Participant app to API | D: mass sign-ups through a public study code | Per-IP limit, a limit per code per hour, the optional entry limit, the end date and the switch-off. With approval, a waiting entry holds no data and receives no request. See study codes |
| Participant app to API | I, E: a study code photographed or shared beyond the poster | The code grants only an invitation card and an entry that is pending or active in one study. Approval, the limits and regeneration keep control. See study codes |
| Participant app to API | D: spam through a study code | A waiting entry has no entries, no media and no free text, and the team sees only its order and time. See study codes |
| Dashboard to API | I: singling out pool members through small groups | A count below 5 is not shown, an invitation to a group below 5 is refused, no researcher route returns a pool profile |
| API to PostgreSQL | I: linking a pool member to a study | `pool_invitation` is readable by no researcher interface, and the participant row holds no reference to the pool member. The platform can still read the link: declared limitation |
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

Researchers and administrators have accounts with a password; participants never have a password
(their optional account, described under "Participant account", uses a recovery code, an email code
or Google). Researcher and administrator passwords are stored as Argon2id hashes. Argon2id is the first choice of the OWASP password storage cheat sheet; it is slow on purpose
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

A participant joins with an invite code (a personal single-use code, or a reusable study code from a
poster) and receives a device token. By default there is no participant account: there are no
participant passwords to store, leak or reset, the study needs no email address, and the same person in
two studies is two unrelated rows, so researchers cannot join their diaries. The research platform
m-Path uses the same pattern. A participant who creates the optional account still has no password, and
then the platform, never a researcher, can link that person's participations (see "Participant
account"). The cost is portability: on a new phone the researcher issues a new invite code for the
same participant row, or the person restores an optional account (see below).

The personal invite code has 12 characters in three groups of four from an alphabet of 32 symbols, about 60 bits, expires after 7
days, can be used once and has an attempt limit per IP, which makes guessing impractical. It is the
participant's only credential before they hold a token, so the database stores only its SHA-256 hash
(`invite_code.code_hash`) and shows the code once. The study code is another kind of invite code and is
described in its own section below.

The device token is a random 256-bit value. It has enough entropy that a fast hash is enough, so it is
stored only as a SHA-256 hash and the researcher can revoke it. Argon2id is reserved for passwords
chosen by people, which have little entropy. Invite codes, device tokens and refresh tokens are
compared in constant time (`hmac.compare_digest`). On the phone the device token is kept in the system's secure storage:
Keychain on iOS and Keystore on Android, through `expo-secure-store`.

A study can be joined in three ways: by scanning a QR code that encodes the invite code, by typing
the code (a personal code or a study code), or from a volunteer pool invitation. All three end on the invitation card, which shows the
study, the team, the dates, the requests per day, the effort and what is recorded before anything is
issued. Checking a code and showing the card do not use the code up. The code is invalidated and the
device token issued only when the participant accepts, so declining or deciding later leaves the code
valid until it expires. The lookup that precedes the card shows study information to anyone who holds
a valid code, so it counts as an attempt under the per-IP limit. The QR code holds the same code as
the typed one and adds no new credential; the camera only reads it and the app stores no image.
For a study code the card is the same, with a line saying that the entry is by the poster of the study.

A person in several studies on one phone holds one device token per study, each with its own
participant row and alias, so the pseudonymity between studies described above holds against
researchers. The push token is the exception: it belongs to the phone, every participation of that
phone holds the same value, and the platform could link them. This is declared, not removed. A
notification carries the prompt id and no study name, and the app finds the study locally.

## Study codes

A study code is a reusable invite code that a researcher prints on a poster or a leaflet. It exists
because one personal code for each person does not work for recruiting in a public place. The two
kinds differ on purpose.

| | Personal code | Study code |
|---|---|---|
| Used by | one person, once | many people, until a limit |
| Pseudonym | the row exists before the code is used | a new participant row and alias for each entry |
| Stored | SHA-256 hash only, shown once | readable, the team can see it, its QR code and the poster at any time |
| Length | 12 characters in three groups of four, about 60 bits | 8 characters in two groups of four, about 40 bits |
| Controls | 7-day validity | name, end date, optional entry limit, optional limit per hour, on or off, approval of each entry, option to require an account, regeneration |

Why storing the study code readable is acceptable. A personal code is a credential: whoever holds it
becomes a particular person's participant, so it is hashed like a password. A study code is not a secret.
It is printed in a public place, so hashing it would protect nothing against a person who has read the
poster, and it would stop the team from seeing the code and printing the poster later. The code grants
only an invitation card and an entry that is pending or active in the one study it belongs to. It gives
no access to entries, identities or any other participant. It is shown only to members of the study and
administrators, and it is in no export.

Why 8 characters are enough. The code is not a secret, so its length decides only how hard it is to guess
the code of a study that nobody has seen. With 8 characters from 32 symbols there are about 10^12 codes
and a platform holds a few dozen valid ones, so a guess hits with a probability of about 10^-11. The
per-IP attempt limit counts the lookup, so guessing at scale is impractical, and a guessed code still
leads only to an entry that the team can decline.

### Threats

| Threat | What can happen | Measures | Residual risk |
|---|---|---|---|
| Mass sign-ups | A script enters many times to fill the limit or to flood the team with waiting entries | Per-IP attempt limit and a limit on entries created from one address; an optional limit on entries accepted per code per hour (off by default); the optional entry limit (off by default), which caps the rows a code can create and which a declined entry does not use; the end date, when entries nobody decided are declined; the check against the same phone or account entering twice; the switch-off; the count of uses is increased in the statement that checks the limit, so parallel requests cannot pass it. A waiting entry holds only the consent, hours, push token and locale, and no entry | With no limit set, which is the default, a determined attacker with many addresses can flood the team with waiting entries until the end date, and with a limit set the attacker can fill it and lock real people out. The researcher sees it (uses climb, entries arrive at odd hours), declines the entries, raises the limit or switches the code off |
| Code photographed or shared | Anyone who has seen the poster, or a photo of it, can enter. The code is public by design | The code grants only an invitation card and a pending or active entry in one study. Approval, on by default, means nobody becomes a participant without a decision. The limit and end date bound the exposure. Regeneration replaces the code at once. Each entry is audited with its time | A person who is not the intended public can still ask to enter. Approval filters them only if the team can tell, which the next paragraph limits |
| Spam | A person or script tries to push content at the team | A waiting entry cannot record anything, receives no request and has no free text, so there is nothing for the team to read. The team sees only an order number and a time. After approval the person is a normal participant: the token can be revoked (FR-29) and an administrator can erase the participant (FR-44) | An approved person can still send unwanted entries until the team acts |
| Guessing a study code | An attacker tries codes at random to enter a study nobody told them about | About 10^12 codes, few valid, the per-IP limit counts every lookup, and a guessed code gives only a pending entry | Negligible compared with the other rows |
| Leak of the database or a backup | Active study codes become known | The attacker can enter the studies that use them, with the limits and approval above, and reads no data | Same as a photographed poster. A database leak has far larger consequences for entries and identities |
| Poster that outlives the study | People enter long after the recruitment | The end date is required, and the code refuses entries after it | The poster stays on the wall, and the app refuses it with the generic error |
| Repudiation | A researcher denies having approved or switched off a code, or an entry is disputed | Creation, change, switch-off, regeneration, each entry, each approval and each decline are in the audit log | The log is append only for the services, not for a database administrator |

### Approval keeps control

With approval on, a person who enters by a study code becomes a participant only when a member of the
study decides it. Until then the person is in `pending_approval`: no request is planned, sent or shown,
the scheduler and the researcher queries skip the row, the person is not counted in the numbers of the
study, and the dashboard shows only an order number, the time and the code used, with no alias and no
identity. Declining deletes the consent, the hours and the push token at once and leaves no research data,
because none existed. Approval is the default for a study code, and switching it off is an explicit choice
that the dashboard warns about.

Approval has a limit that has to be stated. The team cannot see who a waiting person is, because the
entry carries no name, email address or alias. It decides volume and timing, for example refusing the
fifth entry when a poster at a kiosk was expected to bring four, not identity. A person who really is part
of the public the poster targets and a person who is not look the same. The study design, not the
platform, decides whether that is enough: a study that needs verified participants should issue personal
codes (UC10).

## Participant account

Taking part never needs an account. The account is optional, holds no name and holds no entries: it exists to
recover the participations on a new phone, to block a second entry from another phone, and to satisfy a study
code that requires one. Researchers never see an account, an account identifier, an email address or whether a
participant has one. The platform can link the participations of one account, and the pool membership if the
person links it, which is a declared limit that the consent text states.

Three methods, all free:

- Recovery code (default). 16 characters in four groups from the 32-symbol alphabet, about 80 bits, shown once.
  It is stored as an Argon2id hash (the parameters of the researcher passwords) and a keyed lookup value
  (HMAC-SHA256 with a key kept as a Compose secret), because a salted hash cannot be searched. The lookup finds one
  row and Argon2id verifies it; a code that matches no row still costs a dummy verification. 80 bits is far beyond
  what the per-IP and per-account limits allow an attacker to try, so the hash is a second layer for the case of a
  leaked database.
- Email with a 6-digit code. The platform sends the code with its own mail server. In the course project that
  server is Mailpit, a local mail catcher on the lab network: it keeps the mail and delivers none, so no real mail
  is sent, no paid service is used, and the demonstration reads the code in its web page. A production deployment
  replaces it with a real mail server. The code is valid 10 minutes, allows 5 attempts and is invalidated when a
  newer code is issued. A 6-digit code has about 20 bits, so security rests on the attempt limit and the expiry, not
  on the hash. The address is stored encrypted (AES-256-GCM, key as a Compose secret) because the platform has to
  send mail to it, with a keyed lookup value. A request gets the same answer and delay whether or not the address
  has an account, so the form cannot be used to list who has one.
- Google (a production option, off in the course project). The app obtains a Google ID token and the API verifies
  the signature against the public keys that Google publishes (cached per its cache headers, refreshed once when
  the key identifier is unknown), the issuer, the audience (the client identifier of the app), the expiry and the
  nonce. Only the subject identifier is kept, never the name or the email address. Without the verification a
  forged token would sign anyone in as anyone.

A person can add a second method later. Signing in on a new phone replaces the device token of every linked
participation, so the token of the old phone stops working and a stolen recovery code is noticed by the person when
the old phone is refused.

Deleting the account removes the account and its sign-in data at once, in one transaction. The participations stay
unless the person also asks for the data of all studies to be erased, which starts the 7-day path of the erasure
section for each linked participation. A backup made before the deletion keeps the account for up to 7 days.

| Threat | Measure | Residual risk |
|---|---|---|
| Recovery code stolen or lost | Shown once, hashed, limited attempts; a restore replaces the old tokens; a second method can be added | A stolen code gives the thief the participations until the person notices. A lost code with no other method cannot be recovered, and the researcher can issue a new invite code |
| Email code brute force | 5 attempts, 10 minutes, one valid code, resend and hourly limits, per-IP limit | A mailbox owner is the account owner |
| Account takeover | Method needed, audit row for each sign-in on a new phone, old token revoked | An attacker who controls the email address or the phone |
| Google token forged or replayed | Signature, issuer, audience, expiry and nonce verified against the public keys of Google | Off in the course project, so untested there |
| Linking of participations | Link kept in its own table that researcher queries never read; consent says the platform can link; deletion at once | The platform can link them |
| Account email leaks with the database | Encrypted, with the key outside the database | A leak of the database and the key together |

## Joining a study twice

Without an account the platform recognises a phone, not a person. Each study has a random salt (`study.device_salt`), and the app sends
the Android ID of the installation (`expo-application`) when it joins. The API stores only
`HMAC-SHA256(device_salt, android_id)` and discards the ID. The value cannot link two studies, because the salt
differs, and a copy of the database holds no Android ID. The Android ID is stable across reinstalls on Android 8
and later and changes on a factory reset. The lookup that precedes the invitation card sends it too, so the person
is told at once, before the card, that they already take part, left on a date, have an erasure pending, wait for
approval or were declined. An erased participation leaves no row and no hash, so the person may join again as new.
The code is not used up. With an account the account link blocks as well, on any phone.

The limits are stated plainly. Another phone, or a factory reset, is not detected without an account, so approval
of poster entries and the option that requires an account cover those cases. Two people who share a phone count as
one. The Android ID is an identifier, not a secret: if a stranger knew a person's ID and a code of the study, the
system would issue a new token for that person's existing participation (the case of a reinstall) and the stranger
would reach it. The ID is 64 random bits, scoped to the signing key of the app, sent only over TLS and stored
nowhere, so an attacker cannot read it from the platform and has to take it from the phone, where the attacker
could take the token as well. This residual risk is accepted and should be confirmed with the owner.

## Volunteer pool privacy

The volunteer pool lets a person receive invitations to studies without joining one first. It is a
second store of personal data, apart from the studies, and its rules are stricter than the study
rules because researchers recruit from it.

- Opt-in. Joining is never a default and never a condition of joining a study.
- No name, email address or phone number. The pool member is identified by a random 256-bit device
  credential, kept in the phone's secure storage and stored as a SHA-256 hash, like a participant
  token and separate from every study token.
- Only the concelho is required. It is chosen from the list of the 308 municipalities and never read
  from the phone's location. The other fields (freguesia, age band, gender, occupation, usual means
  of travel, languages) are optional, each with "prefer not to say".
- Researchers never see a profile or a person. They set criteria and see a number. A number below 5
  is shown as "fewer than 5", and the API refuses to send invitations to a group of fewer than 5, so
  that nobody is singled out. The administrator overview shows counts only and hides groups below 5.
- The invitation notification says only that there is a new study in which the person can take
  part. The invitation card says why the person was invited (member of the pool, living in the
  concelho given) and when it expires, 7 days after it was sent.
- Accepting an invitation creates a new participant row with a new alias and token. The pool profile
  is not copied into the study.
- The member can see and edit the profile, pause invitations and leave. Leaving deletes the profile
  at once, with no 7-day wait, because the profile holds no research data. Backups lose it within 7
  days.
- Sending invitations is written to the audit log with the researcher, the study, the criteria and
  the number sent.

Three limits remain, and they are stated in the consent text and in the data protection summary.
The invitation record shows which pool member was invited to which study, so the platform, not the
researchers, can link the two; to keep this link short, the record does not hold the id of the
participant row created on acceptance, and the member reference is set to null when the member
leaves. The push token is the same for every participation on one phone, so the platform could link
a pool member to the participations of that phone through it. A researcher who changes the criteria
by one value and compares two counts of 5 or more can infer a trait of a few members; limiting the
number of count queries is considered, not designed.

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

Pool profiles are not in `participant_identity` and are never copied into a study; see the volunteer pool section.

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
rejects anything that is not an image, audio or video. The dashboard shows images and plays audio and video inline. Files are served with the content type that the
media worker checked and `X-Content-Type-Options: nosniff`, so a disguised HTML or SVG file cannot run inside the
dashboard (stored cross-site scripting). Downloads and exports use `Content-Disposition: attachment`.

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

An erasure started in the app writes three rows: the request and the cancellation, if any, with the
actor type participant and the participant id only, and the final erasure with the actor type system.
A batch of pool invitations writes one row with the researcher, the study, the criteria and the number
sent. Study codes write a row for the creation, each change, the switch-off and switch-on and the
regeneration, with the researcher, a row for each entry by the code, with the actor type participant and
the participant id only (no alias exists before approval), and a row for each approval and decline, with
the researcher.

The log survives the erasure of a participant, with pseudonymous identifiers only: the participant id,
never the name. It is kept for the duration of the course; a real deployment would have to define a
retention period.

## Erasure, retention and backups

The platform can erase every copy it holds in the live system. Erasing a participant removes their identity
and their entries from the three database nodes (primary and two replicas) and every copy of their files
from the three copies of each file. Every erasure is written to the audit log. Three things stay outside
it: the audit log keeps pseudonymous ids, entries still in a phone's offline queue are out of reach until
they are sent, and backups made before an erasure that reaches the team keep the data for up to 7 days.
An erasure started in the app is different, as the next subsection says.

Whether a request must be granted is the research team's decision: Article 17 of the GDPR has an
exception for research, which applies with the safeguards of Article 89(1) when erasure would make the
research impossible or seriously impair it. The platform provides the mechanism, not the policy.

### Data after a study closes

Closing a study does not erase anything. The entries stay, under their pseudonyms, for the analysis
and the publications that come from the study, and the researchers can still read and export them.
A participant's data is erased only when the participant asks for it in the app (also after the
study has closed), when a request reaches the team and the administrator erases it, or when the team
decides, under its ethics protocol, to delete a whole study. Pseudonymous data is still personal data
under the GDPR: photos, voices, places and free text can identify a person, and the identity table
may hold names and emails. How long a closed study is kept is therefore a decision of each research
team, written in its ethics protocol and its consent text; the platform does not impose one.

### Erasure started by the participant

Google Play and the App Store expect an app to offer a way to delete data from inside the app, so
the participant can erase their data in each study from the app, and in all studies and the pool
from the app settings. After a confirmation in which the participant types a confirmation word:

- At once, requests and the participation stop, the participant's data is hidden from the research
  team and left out of exports, and the entries still waiting in the phone's queue are deleted from
  the phone.
- The participation is marked `erasure_scheduled` with a due time 7 days after the request. Until then
  the participant can cancel in the app, which restores the participation as it was; requests resume
  from the next nightly plan.
- When the due time passes, a system job runs the same erasure as the administrator path: identity,
  entries and every copy of the files on the three database nodes and the three object storage
  copies. It runs in the API role, because the scheduler has no access to identities or files.
- From the request, the daily backups no longer hold the data: the `pg_dump` leaves out the
  participant's rows and the rows that depend on them, and the copy of the object storage bucket skips
  their objects. Backups are kept 7 days, so the last backup that holds the data was made on the day
  of the request or before and has expired by the due time. On the erasure date no copy of the data
  remains, in the live system or in a backup, so the erasure is complete everywhere after 7 days. The retention must therefore never be longer than the 7-day wait.
- The screen says that exports the team already made cannot be recalled.

The administrator screens list these erasures read only. The administrator cannot cancel or bring
them forward.

This path does not wait for a decision of the research team, which the administrator path does. The
exception of Article 17 for research can still be invoked for requests that reach the team, but the
app does not apply it, so a study cannot refuse an erasure started in the app. The consent text and
the ethics protocol of each study have to say this. It is a decision of 2 October 2026 that the
ethics review of a real study should confirm.

Backups are the other copy to consider. The daily `pg_dump` and the copy of the object storage bucket
are kept for 7 days. For an erasure that reaches the team (the administrator path) the data is erased at
once in the live system and the backups made before it clear within 7 days, so the data leaves the last
backup at most 7 days later, and the consent text says so.

Leaving the pending data out of the backups has a cost, which is stated here and in the consent text. If
a restore from backup is needed during the 7 days, the data of a participant whose erasure is pending
cannot come back from backup. The participant asked for the erasure, so this is acceptable. If that
participant tries to cancel after such a restore, the restored system holds no row for the participation
and the cancellation cannot restore anything: the app finds its token unknown and says so, and the person
can join the study again with a new code as a new participant, with no earlier entries. The erasure job
treats a missing row as already erased. A participant who cancels before any restore returns to the
backups from the next daily backup.
The audit log is not filtered, because it holds only pseudonymous ids.

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
only that a new activity is available. The notification of a pool invitation says only that there is a new
study in which the person can take part.

## Consent and ethics review

The platform records informed consent. Participants accept it in the app before the first activity, and
the accepted version is stored (`consent`). The consent text will state that for an erasure that reaches the team, daily backups keep the erased
data for up to 7 days. It will also say what participants should avoid photographing or recording:
people who have not agreed to take part, documents and house numbers. The instruction the researcher
writes in each activity repeats this guidance. The consent text will also say that the platform keeps, for each study, a code derived from an identifier of the phone to stop the same phone joining twice, and that, for a person with an account, the platform can link the participations of that account while researchers cannot. The consent text will also say that the participant can leave the study or erase their data in the app, that the erasure happens 7 days after the request
unless the participant cancels, and that from the request the data no longer goes into the backups, so no copy remains on the erasure date. For a study code with approval the text also says that the team confirms each entry.

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

Further checks cover the optional account (a recovery code and an email code are throttled, a restore replaces the old token, no researcher route returns an account, an email address or a device hash, a forged Google token is refused) and the check against joining twice (one test for each state, no Android ID in the database or logs). They also cover the study codes, the pool and the erasure from the app. For study codes: parallel entries do not pass the limit, a code that is off or replaced is refused like an unknown one, a waiting entry gets no plan and no request, and no export or app response shows a study code. For the erasure, a dump and a bucket copy made while an erasure is scheduled hold none of the participant's rows or objects. The rest: no researcher route returns a pool profile or
an invitation record; a group of fewer than 5 is neither counted nor invited; a code survives a declined
card; an erasure hides the data from queries and exports at once, runs when due and is undone by a
cancellation; the audit rows carry the right actor types.

An OWASP ZAP scan of the API and a check against OWASP ASVS level 1 are considered if time allows.

## Residual risks

The host is a single point of failure and of security: whoever controls it holds the volumes and the
secrets. Encrypted backups with the key off the host limit the damage, and so would application-level
encryption of the identity table if adopted.

An administrator with direct access to the database can read and change data, including the audit
log; detecting that would need the external hash anchoring described above.

The platform can link a pool member to a study through the invitation record, and the participations
of one phone through the shared push token. The researchers cannot. Exports made before an erasure
cannot be recalled. Anyone who holds an unlocked phone can start an erasure or a withdrawal in the app;
the visible state and the 7-day window let the participant notice and cancel it, and they do not
prevent it. A restore during that window cannot bring back the data of a participant whose erasure is
pending, and a later cancellation cannot restore it.

The account and the device check have limits that the consent text states: the platform can link the participations of one account, a person who loses the recovery code and has no other method cannot recover the account, and another phone or a factory reset is not detected without an account.

A study code is public. Whoever sees the poster can ask to enter, and approval, the limits and
regeneration bound the harm without removing the possibility. The team cannot tell the people waiting
for approval apart, so approval controls the number and the timing of entries and not who the people are.

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
