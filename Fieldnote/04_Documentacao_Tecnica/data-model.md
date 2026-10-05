# Data model

Status: proposed, 29 September 2026. Tables and columns will change during implementation.

![Data model](diagrams/data-model.svg)

*Figure 5. Data model. Solid lines are foreign keys; dashed lines are logical references without a foreign key (the outbox, the audit log and the scheduler lease).*

## Why the model looks like this

The model follows the vocabulary of diary studies (see `06_Dados_Investigacao`): a study defines
activities, the scheduler turns activities into prompts for each participant, and participants
answer with entries. Four concerns shape the rest:

- No entry may be lost or duplicated. The entry's primary key is created on the phone, so a
  resend after a failure is recognised as the same entry. `outbox_event` makes the database commit
  and the broker message one atomic step.
- Participants are pseudonymous. Researchers work with aliases; the real identity lives in its
  own table (`participant_identity`), as the GDPR research provisions recommend.
- Media is heavy. Files live in object storage; the database keeps only `media_object` rows
  with the key, checksum and processing status.
- Everything relevant is traceable. `audit_log` records who did what, including system jobs.

## Participant identity: why there is no participant account

Researchers and administrators have accounts (`user_account`, email and password). Participants do
not. A participant is a row in one study, joins by typing a single-use invite code, and the phone
then keeps a device token. This was chosen because:

1. Data minimisation. The platform does not need a participant's email or a password to run a
   study. Name and email, when the researcher has them, stay in `participant_identity` and are never
   used to log in.
2. Pseudonymity across studies. A person in two studies is two unrelated participant rows, so
   their diaries cannot be joined across studies.
3. Less friction and less to secure. Typing a code is faster than creating an account, and
   there are no participant passwords to store, reset or leak.

The cost is portability: on a new phone the participant cannot log in by themselves. The researcher
issues a new invite code for the same participant row, which links the new phone and keeps the
history. A participant account (email with password or a login link, one account for many studies)
is the alternative if self-service access or one person in several studies becomes a requirement.

## Main entities

| Entity | Purpose |
|---|---|
| `user_account` | Administrators and researchers. Passwords stored as Argon2id hashes, failed login counter and lockout time, TOTP secret for administrators |
| `refresh_token` | Refresh tokens of dashboard sessions, stored as hashes, grouped by family; superseded tokens are kept until the family expires, for reuse detection |
| `study`, `study_member` | A study, its time zone, prompt limits and schedule style (fixed, balanced or varied), and the researchers who can see it, as owner or collaborator |
| `activity` | What participants are asked to record, the entry types it accepts (one or more, so the participant can choose, for example photo or text), the expected effort per entry in minutes (`expected_minutes`), whether location is requested, whether free entries are allowed and how many per day, and the rules for when to ask |
| `participant` | A pseudonymous participant in one study, identified by an alias, with the hash of the current invite code and of the device token, with the language of the app and the consent text (`locale`, `pt` or `en`) |
| `participant_identity` | Name and email, kept apart from the entries, only when the researcher has them (zero or one row per participant). Researchers see aliases by default |
| `consent` | Which version of the informed consent each participant accepted, and when |
| `availability` | The hours when each participant accepts prompts, used by the scheduler |
| `prompt` | One planned request of one activity to one participant, produced by the scheduler |
| `entry` | What the participant recorded, with the entry type chosen among the activity's accepted types, the text, the scale value or the chosen option. The primary key is the UUID created on the phone. Confirming an entry that answers a prompt sets the prompt's status to `answered` |
| `plan_run` | One run of the scheduler for a study and a day: whether it finished or was cut by the time limit, nodes expanded, prompts planned and unplanned, solve time |
| `media_object` | A file in object storage attached to an entry, with its checksum and status: `pending` from the moment an upload URL is issued, then `uploaded`, `processed` or `failed` |
| `tag`, `entry_tag` | Labels researchers attach to entries to organise them |
| `audit_log` | Relevant actions by users, participants and the system: logins, exports, changes to studies, erasures, cleanup jobs. Append only, kept for the duration of the course |
| `outbox_event` | Events waiting to be published to the broker. Published events are deleted after 7 days |
| `leader_lease` | The lease that decides which scheduler replica is active |

## Design notes

- `entry.recorded_at` comes from the phone clock and `entry.received_at` from the server clock.
  Both are shown in the dashboard, so entries captured late or in a burst are visible (see
  `06_Dados_Investigacao/01-diary-studies-and-experience-sampling.md`). Entries are never rejected
  for arriving after the activity window.
- `prompt.unplanned_reason` records why a prompt was not planned: `outside_availability`,
  `min_gap_infeasible`, `daily_cap`, `slot_cap` or `search_cut` (see the scheduler).
- `prompt.shown_at` and `prompt.opened_at` are reported by the app, so delivery delays of push and
  local notifications can be measured.
  Entries sent late from the offline queue keep the moment they were recorded.
- Identity and entries are separate so that an export can be pseudonymised by default, and an
  erasure request can remove the identity and the entries of one participant.
- `prompt` has a unique key on participant, activity, plan date and occurrence. The scheduler uses
  it to avoid planning or sending the same prompt twice after a failover.
- `media_object.entry_id` holds the entry UUID generated on the phone before the entry row exists.
  The foreign key is checked when the entry is confirmed.
- `entry.content_sha256` lets the API tell a duplicate resend (same hash) from a UUID collision
  (different hash).
- `entry.activity_id` must match the activity of `entry.prompt_id` when a prompt is given; entries
  recorded without a prompt (free entries) only carry the activity.
- `activity.expected_minutes` is the expected effort per entry. The dashboard sums it per participant and per day to estimate the load of a day, because the effort of each prompt is expected to affect burden. Eisele et al. (2022) found this for questionnaire length; for media prompts it is reasoned, not measured (see `06_Dados_Investigacao/01-diary-studies-and-experience-sampling.md`).
- `participant.locale` selects the language of the interface and of the consent text. It is `pt` or `en`.
- All times of day (availability, activity windows) are in the study's time zone.
