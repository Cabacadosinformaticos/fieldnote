# Demonstration data

Fills a running Fieldnote stack with the study shown in the mockups, **through the public
API only**. The script creates the researchers, the study, its activities and questions, 22
participants with their availability and the entries of the last two weeks, including generated
garden photos uploaded through signed URLs.

All the data is invented. There is no real person behind the names, e-mail addresses, answers
or photographs. The photos are drawn locally (sky, trees, a bench, a pond, flowers) with no
people and no text.

## Requirements

- The development stack running (see `infra/deploy/README.md`), with the API reachable at
  `http://127.0.0.1:8080`. Use `127.0.0.1`, never `localhost`.
- `uv` on `PATH`. The project only depends on `httpx` and `Pillow`.
- `docker compose` on `PATH`. The administrator has TOTP enabled, so the script derives the
  current code by running the API's own `app.security.totp` helper inside the `api` container,
  exactly like `infra/deploy/smoke.sh`. It never reads or writes the database itself.

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

Open the dashboard at `http://127.0.0.1:5173` (override with `FIELDNOTE_DASHBOARD_URL`) and sign
in as `ines.marques@fieldnote.test`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--base-url` | `http://127.0.0.1:8080` | API through the gateway |
| `--admin-email` | required | Administrator that owns the setup calls |
| `--admin-password-stdin` | off | Read the administrator password from standard input |
| `--days` | `14` | Days of entries, ending today |
| `--participants` | `22` | Participants in the study (at least 4) |
| `--seed` | `20261006` | Seed for the generated data |

## What is created

- **Team**: Inês Marques (principal investigator), Duarte Lopes (co-investigator) and Rita
  Ferraz (member), all `@fieldnote.test`. The administrator hands the study to Inês and leaves
  the team.
- **Study**: “Viver o Jardim da Estrela”, running from `today - (days - 1)` to today in
  `Europe/Lisbon`, with the two study questions from the mockups.
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

## Idempotency and dates

The script finds an existing study by its exact title and stops without creating anything, so
running it twice never duplicates the study or its data. Researcher accounts are reused when
their e-mail already exists.

The dates are relative to the day of the run so that the dashboard always shows recent data.
The mockups show 6–19 October; run with `--days 14` on those dates to reproduce them.

## Known limitation

The scheduler only plans prompts for today and tomorrow and the public API has no way to create
a prompt in the past. The demonstration entries are therefore **free entries** (`prompt_id`
absent) submitted with the historical `recorded_at`. The entry list and the timeline show them
on the right day and time; the prompt adherence matrix only counts the prompts the scheduler
creates while the stack is running, not these historical entries. The activities allow free
entries for this reason.
