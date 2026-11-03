# Demonstration data

Fills a running Fieldnote stack with the study shown in the mockups. The `seed` step creates
the researchers, the study, its activities and questions, 22 participants with their
availability and the entries of the study's past days, including generated garden photos
uploaded through signed URLs, **through the public API only**. The optional `history` step then
writes past prompts **directly into the development database**, because the API has no endpoint
to create a prompt in the past; it makes the adherence charts show data instead of an empty
matrix. The `reset` step does all of it in one command after deleting the studies of earlier
runs, and asks the scheduler to plan today.

All the data is invented. There is no real person behind the names, e-mail addresses, answers
or photographs. The photos are drawn locally (sky, trees, a bench, a pond, flowers) with no
people and no text.

## Requirements

- The development stack running (see `infra/deploy/README.md`), with the API reachable at
  `http://127.0.0.1:8080`. Use `127.0.0.1`, never `localhost`.
- `uv` on `PATH`. The project depends on `httpx`, `Pillow` and `psycopg` (the last one only
  for the `history` step).
- `docker compose` on `PATH`. The administrator has TOTP enabled, so the `seed` step derives
  the current code by running the API's own `app.security.totp` helper inside the `api`
  container, exactly like `infra/deploy/smoke.sh`. The `seed` step never reads or writes the
  database itself; only the explicit `history` and `reset` steps do. `reset` also runs the
  scheduler's own `plan_study` in the `scheduler` container, so that container must be up.
- For `history`, the development PostgreSQL reachable at `127.0.0.1:5432`. Set
  `SEED_DATABASE_URL` to its psycopg URL, for example
  `postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote` (the safe development value in
  `services/api/app/config.py`). The variable is read from the environment only; the script
  never reads `.env` files. The step refuses any host other than `127.0.0.1:5432`.

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

The researcher logins are written to `_private/entregas/entrega-2/dev-logins.md`, which Git
excludes, and never to a tracked file.

Open the dashboard at `http://127.0.0.1:5173` (override with `FIELDNOTE_DASHBOARD_URL`) and sign
in as `ines.marques@fieldnote.test`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `step` | `seed` | `seed` fills the stack through the API; `history` writes past prompts directly to the database; `reset` deletes every study, then seeds, fills the past and plans today |
| `--base-url` | `http://127.0.0.1:8080` | API through the gateway |
| `--admin-email` | required for `seed` and `reset` | Administrator that owns the setup calls |
| `--admin-password-stdin` | off | Read the administrator password from standard input |
| `--end-in-days` | `1` | Days from today to the end of the study; it always starts 12 days before today |
| `--participants` | `22` | Participants in the study (at least 4) |
| `--seed` | `20261006` | Seed for the generated data and the prompt times of `history` |
| `--yes` | off | `reset` only: confirm deleting every study in the development database |

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
