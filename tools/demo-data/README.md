# Demonstration data

Fills a running Fieldnote stack with the study shown in the mockups. The `seed` step creates
the researchers, the study, its activities and questions, 22 participants with their
availability and the entries of the study's past days, including generated garden photos
uploaded through signed URLs, **through the public API only**. The optional `history` step then
writes past prompts **directly into the development database**, because the API has no endpoint
to create a prompt in the past; it makes the adherence charts show data instead of an empty
matrix. The `reset` step does all of it in one command after deleting the studies of earlier
runs, and asks the scheduler to plan today.

Each run creates three studies instead of one: the main running study above, a finished
21-day study (“Rotinas de estudo em época de exames”, principal Duarte Lopes) closed three
days before today with 10 participants and text and scale entries, and a draft study in
preparation (“Caminhos casa-escola”, principal Rita Ferraz) that starts in five days with
activities for video, audio, photo and a scale, a consent text and a poster code but no
participants. The `history` step fills the past prompts of the main and finished studies, and
the scheduler only plans today for the running one.

All the data is invented. There is no real person behind the names, e-mail addresses, answers
or photographs. The photos are drawn locally (sky, trees, a bench, a pond, flowers) with no
people and no text.

## Requirements

- The development stack running (see `infra/deploy/README.md`), with the API reachable at
  `http://127.0.0.1:8080`. Use `127.0.0.1`, never `localhost`.
- Or, on the server, the cluster stack (`infra/deploy/compose.cluster.yaml`, project
  `fieldnote-cluster`) running with the `cluster` profile and `--target cluster`. The API gateway
  is then `http://127.0.0.1:8090`, Mailpit `http://127.0.0.1:8026`, and the TOTP and scheduler
  helpers run in `api1` and `scheduler1`.
- `uv` on `PATH`. The project depends on `httpx`, `Pillow` and `psycopg` (the last one only
  for the `history` step).
- `docker compose` on `PATH`. The administrator has TOTP enabled, so the `seed` step derives
  the current code by running the API's own `app.security.totp` helper inside the `api`
  container, exactly like `infra/deploy/smoke.sh`. The `seed` step never reads or writes the
  database itself; only the explicit `history` and `reset` steps do. `reset` also runs the
  scheduler's own `plan_study` in the `scheduler` container, so that container must be up.
- For `history`, `reset` and `reset --clean-audit`, PostgreSQL reachable on the loopback. Set
  `SEED_DATABASE_URL` to its psycopg URL. On `dev` it must point at `127.0.0.1:5432`, for example
  `postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote` (the safe development value in
  `services/api/app/config.py`). On `cluster` it is a libpq multi-host URL whose hosts are all
  `127.0.0.1` on ports 5441, 5442 and 5443, with `target_session_attrs=read-write` so libpq
  follows the Patroni leader:
  `postgresql://fieldnote:<password>@127.0.0.1:5441,127.0.0.1:5442,127.0.0.1:5443/fieldnote?target_session_attrs=read-write`.
  The password is the one in `infra/deploy/.env` on the server. The variable is read from the
  environment only; the script never reads `.env` files. The step refuses any other host.

## Create the administrator once

The API has no endpoint that creates the first administrator. Use the same command as the smoke
test:

```bash
printf '%s\n' 'ChangeMe!2026' |
  docker compose -f infra/deploy/compose.yaml --profile dev exec -T api \
    python -m app.cli create-admin \
      --email demo-admin@fieldnote.test --password-stdin
```

The first time the seed script signs in, it enrols TOTP for that administrator and reuses the
enrolment on later runs.

## Run

```bash
cd tools/demo-data
printf '%s\n' 'ChangeMe!2026' |
  uv run seed.py --admin-email demo-admin@fieldnote.test --admin-password-stdin
```

The password is read from standard input so it never appears in the process list. At the end
the script prints the study, the team, the participant and entry counts and the temporary
passwords of the researcher accounts. Those passwords are only returned by the API once, when
the accounts are created; a later run reports them as unchanged.

Then write the prompts of the past study days and link the entries to them:

```bash
cd tools/demo-data
SEED_DATABASE_URL='postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote' \
  uv run seed.py history
```

For the day of a presentation, `reset` replaces the three commands: it deletes **every study**
in the development database (the demo study of an earlier run and the test studies), prints the
titles, runs `seed` and `history`, and asks the running scheduler to plan today. It needs
`--yes` because it deletes data, and it refuses to run against a database that is not on
`127.0.0.1:5432`:

```bash
cd tools/demo-data
printf '%s\n' 'ChangeMe!2026' |
  SEED_DATABASE_URL='postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote' \
  uv run seed.py reset --yes \
    --admin-email demo-admin@fieldnote.test --admin-password-stdin
```

Both `history` and `reset` write to the database directly, and they are meant for demo data
only: they insert `prompt` rows and set `entry.prompt_id` in the development database. They
never run against another host, never change the API data and do not touch migrations.

`reset --yes --clean-audit` also clears `audit_log` before seeding. It truncates the table, or
deletes its rows when the role the seed connects with cannot truncate it, and then writes one
`system` row with action `audit_log_cleared` and the number of rows removed, so the log itself
shows that it was cleared. This is a demonstration-only step: in a real deployment the audit log
is never cleared.

The researcher logins are written to `.local/dev-logins.md`, which Git
ignores, and never to a tracked file. On the server use `--logins-file` to write them somewhere
outside the checkout instead.

Open the dashboard at `http://127.0.0.1:5173` (override with `FIELDNOTE_DASHBOARD_URL`) and sign
in as `ines.marques@fieldnote.test`.

## Cluster

Run the same steps from the server with `--target cluster`. The script then reads
`infra/deploy/compose.cluster.yaml` with the `cluster` profile, derives the TOTP code in `api1`,
asks `scheduler1` to plan today, and defaults to the gateway on `http://127.0.0.1:8090` and
Mailpit on `http://127.0.0.1:8026` (both can still be overridden with `--base-url` and
`--mailpit-url` or `SEED_MAILPIT_URL`):

```bash
cd tools/demo-data
printf '%s\n' 'ChangeMe!2026' |
  SEED_DATABASE_URL='postgresql://fieldnote:<password>@127.0.0.1:5441,127.0.0.1:5442,127.0.0.1:5443/fieldnote?target_session_attrs=read-write' \
  uv run seed.py reset --yes --clean-audit --target cluster \
    --logins-file /srv/fieldnote/dev-logins.md \
    --admin-email demo-admin@fieldnote.test --admin-password-stdin
```

The `<password>` is the database password in `infra/deploy/.env` on the server; never commit it.
The three PostgreSQL ports are published on the loopback only, for this seed.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `step` | `seed` | `seed` fills the stack through the API; `history` writes past prompts directly to the database; `reset` deletes every study, then seeds, fills the past and plans today |
| `--target` | `dev` | `dev` uses `compose.yaml` with `api` and `scheduler`; `cluster` uses `compose.cluster.yaml` with `api1` and `scheduler1` |
| `--base-url` | `http://127.0.0.1:8080` (`8090` on cluster) | API through the gateway |
| `--mailpit-url` | `http://127.0.0.1:8025` (`8026` on cluster) | Local Mailpit API used to read the account links; `SEED_MAILPIT_URL` overrides it |
| `--admin-email` | required for `seed` and `reset` | Administrator that owns the setup calls |
| `--admin-password-stdin` | off | Read the administrator password from standard input |
| `--end-in-days` | `1` | Days from today to the end of the study; it always starts 12 days before today |
| `--participants` | `22` | Participants in the study (at least 4) |
| `--seed` | `20261006` | Seed for the generated data and the prompt times of `history` |
| `--logins-file` | `.local/dev-logins.md` | Path of the researcher logins file; use it to keep the file outside the checkout on the server |
| `--yes` | off | `reset` only: confirm deleting every study and, with `--clean-audit`, clearing the audit log |
| `--clean-audit` | off | `reset` only: delete every `audit_log` row before seeding and leave one `audit_log_cleared` row (demonstration only) |

`history` and `reset` also read `SEED_DATABASE_URL` from the environment as described above.

## What is created

- **Team**: Inês Marques (principal investigator), Duarte Lopes (co-investigator) and Rita
  Ferraz (member), all `@fieldnote.test`. The administrator hands the study to Inês and leaves
  the team.
- **Study**: “Viver o Jardim da Estrela”, running from `today - 12` to
  `today + --end-in-days` (tomorrow by default) in `Europe/Lisbon`, with the two study
  questions from the mockups. The default run is therefore on day 13 of 14.
- **Activities**:
  - A1 “Um momento no jardim” — photo, 1 request a day, location requested, up to 2 free
    entries a day.
  - A2 “O que o trouxe ao jardim?” — text or audio, 1 request a day, 1 free entry a day.
  - A3 “Como se sente agora?” — faces scale with 5 points, 1 request a day, 1 free entry a day.
- **Participants**: 22 rows `P-01` … `P-22` with invented names and addresses. Twenty join
  with their personal code, one personal code is left unused, one person enters with a poster
  code and is declined, one person withdraws and one is removed by the team.
- **Entries**: each joined participant has availability (working hours, all week or weekends
  only) and entries whose recorded time falls inside it. Most participants answer almost
  everything; two answer much less. Photos go through `POST /media/upload-url` and a signed
  `PUT`, then the script waits until the media worker reports every file as `processed`.
- **Past prompts** (`history`): for each past study day, each participant and each activity
  occurrence, one prompt on the scheduler's 15-minute grid, inside the participant's
  availability and the activity window, respecting the minimum gap, the study's daily cap and
  its study-wide slot cap (`max_prompts_per_slot`). When the slot next to the intended time is
  full, the prompt moves to the next free slot; when none is free, the row is written as
  `unplanned` with reason `slot_cap`. A prompt whose activity has a seeded entry on that day is
  `answered`, sent at most 30 minutes before the entry, and the entry is linked to it with
  `entry.prompt_id`. The other prompts are `expired` with no entry, which gives an adherence
  around 80 %. Prompts already present are skipped.

## Idempotency and dates

The seed step finds an existing study by its exact title and stops without creating anything, so
running it twice never duplicates the study or its data. Researcher accounts are reused when
their e-mail already exists.

The `history` step is idempotent too: prompts use the
`(participant_id, activity_id, plan_date, occurrence)` key with `ON CONFLICT DO NOTHING`, and it
only links entries whose `prompt_id` is still null. A second run reports zero inserts and zero
links and leaves the adherence numbers unchanged.

The study dates are relative to the day of the run so that the dashboard always shows a study
on day 13 of 14: it starts 12 days before today and ends tomorrow. `--end-in-days` moves the
end. The scheduler still plans today and tomorrow; `history` only fills the days before today.

`reset` is idempotent in the same sense: it deletes and recreates the study, so a second run
leaves a single demo study with the same shape and no test study beside it. It prints the
titles it deletes before deleting them and refuses to continue without `--yes`.

## Prompt timestamps

`prompt` stores `scheduled_at`, `sent_at`, `shown_at` and `opened_at`, but no answered or expired
timestamp. For an answered prompt the answer time is the linked `entry.recorded_at`; for an
expired prompt the end of the activity window on `plan_date` is when it expired. The `history`
step leaves `opened_at` null on expired prompts (they were not opened) and sets it a few seconds
after `sent_at` on answered ones.
