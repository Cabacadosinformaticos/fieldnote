"""Fill a running Fieldnote stack with the demonstration study through the public API.

The script only talks to the API at ``--base-url`` (plus ``docker compose exec`` to derive a
TOTP code for the administrator, exactly as ``infra/deploy/smoke.sh`` does). It creates the
researchers, the study, its activities and questions, the participants, their availability and
their entries spread over the last days. Running it again finds the study by title and stops
without creating a second one.

Run with:

    uv run seed.py --admin-email <email> --admin-password-stdin

Then, after the seed finishes, write the prompts of the past days directly to the development
database so that the adherence charts have data (the API has no endpoint for a past prompt):

    SEED_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/fieldnote uv run seed.py history

For the day of a presentation, ``reset --yes`` deletes the studies of earlier runs, seeds the
study, fills its past days and asks the scheduler to plan today, all in one command:

    SEED_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/fieldnote \\
        uv run seed.py reset --yes --admin-email <email> --admin-password-stdin
"""

from __future__ import annotations

import argparse
import calendar
import getpass
import hashlib
import io
import os
import random
import secrets
import subprocess
import sys
import time as clock
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
import psycopg
from PIL import Image, ImageDraw
from psycopg.rows import dict_row

API_ROOT = "/api/v1"
STUDY_TITLE = "Viver o Jardim da Estrela"
STUDY_DESCRIPTION = (
    "Como é que os moradores usam o Jardim da Estrela ao longo do dia, durante duas semanas."
)
TIMEZONE = "Europe/Lisbon"

# Windows normally has no IANA database, and the project may install only httpx and Pillow.
# Europe/Lisbon follows the EU rule (last Sunday of March to last Sunday of October), so the
# fallback below derives the offset with the standard library rather than adding tzdata.
try:
    _LISBON = ZoneInfo(TIMEZONE)
except ZoneInfoNotFoundError:
    _LISBON = None


def _last_sunday(year: int, month: int) -> date:
    last = date(year, month, calendar.monthrange(year, month)[1])
    return last - timedelta(days=last.isoweekday() % 7)


def _is_dst(local_date: date) -> bool:
    return _last_sunday(local_date.year, 3) <= local_date < _last_sunday(local_date.year, 10)


def _lisbon_tz(local_date: date) -> timezone | ZoneInfo:
    if _LISBON is not None:
        return _LISBON
    return timezone(timedelta(hours=1 if _is_dst(local_date) else 0))


def _now_lisbon() -> datetime:
    if _LISBON is not None:
        return datetime.now(_LISBON)
    now_utc = datetime.now(UTC)
    offset = 1 if _is_dst(now_utc.date()) else 0
    local_date = (now_utc + timedelta(hours=offset)).date()
    if _is_dst(local_date) != bool(offset):
        offset = 1 - offset
    return now_utc.astimezone(timezone(timedelta(hours=offset)))

PRINCIPAL = "ines.marques@fieldnote.test"
CO_INVESTIGATOR = "duarte.lopes@fieldnote.test"
MEMBER = "rita.ferraz@fieldnote.test"
RESEARCHERS = (
    (PRINCIPAL, "principal_investigator"),
    (CO_INVESTIGATOR, "co_investigator"),
    (MEMBER, "member"),
)

QUESTIONS = (
    {
        "kind": "single_choice",
        "text": "Com que frequência vai ao Jardim da Estrela?",
        "options": [
            "Todos os dias",
            "Algumas vezes por semana",
            "Algumas vezes por mês",
            "Raramente",
        ],
    },
    {
        "kind": "multiple_choice",
        "text": "Como costuma chegar ao jardim?",
        "options": ["A pé", "De bicicleta", "Transportes públicos", "De carro", "Outro"],
    },
)

ACTIVITIES = (
    {
        "key": "A1",
        "title": "Um momento no jardim",
        "instructions": "Fotografe o sítio onde está agora no jardim e o que está a fazer.",
        "entry_types": ["photo"],
        "options": None,
        "prompts_per_day": 1,
        "window_start": "08:00:00",
        "window_end": "20:00:00",
        "min_gap_minutes": 30,
        "capture_location": True,
        "allow_free_entries": True,
        "max_free_entries_per_day": 2,
        "expected_minutes": 2,
    },
    {
        "key": "A2",
        "title": "O que o trouxe ao jardim?",
        "instructions": (
            "Conte em poucas palavras o que o trouxe hoje ao jardim. "
            "Pode gravar até 1 minuto de áudio ou escrever."
        ),
        "entry_types": ["text", "audio"],
        "options": None,
        "prompts_per_day": 1,
        "window_start": "09:00:00",
        "window_end": "20:00:00",
        "min_gap_minutes": 30,
        "capture_location": False,
        "allow_free_entries": True,
        "max_free_entries_per_day": 1,
        "expected_minutes": 1,
    },
    {
        "key": "A3",
        "title": "Como se sente agora?",
        "instructions": "Escolha a cara que melhor descreve como se sente neste momento.",
        "entry_types": ["scale"],
        "options": {
            "scale_type": "faces",
            "points": 5,
            "start_label": "Muito mal",
            "middle_label": "Assim-assim",
            "end_label": "Muito bem",
        },
        "prompts_per_day": 1,
        "window_start": "09:00:00",
        "window_end": "23:59:00",
        "min_gap_minutes": 30,
        "capture_location": False,
        "allow_free_entries": True,
        "max_free_entries_per_day": 1,
        "expected_minutes": 1,
    },
)

# Each entry is (start minute, end minute, ISO weekdays). Weekdays use 1 = Monday, 7 = Sunday.
AVAILABILITY_SPECS = (
    (8 * 60, 21 * 60, [1, 2, 3, 4, 5, 6, 7]),
    (9 * 60, 18 * 60, [1, 2, 3, 4, 5]),
    (10 * 60, 20 * 60, [1, 2, 3, 4, 5, 6, 7]),
    (8 * 60 + 30, 19 * 60 + 30, [1, 2, 3, 4, 5]),
    (9 * 60, 22 * 60, [1, 2, 3, 4, 5, 6, 7]),
    (10 * 60, 18 * 60, [6, 7]),
    (7 * 60 + 30, 20 * 60, [1, 2, 3, 4, 5, 6, 7]),
)

FAKE_IDENTITIES = (
    ("Ana Silva", "ana.silva@exemplo.pt"),
    ("Bruno Costa", "bruno.costa@exemplo.pt"),
    ("Carla Nunes", "carla.nunes@exemplo.pt"),
    ("Diogo Martins", "diogo.martins@exemplo.pt"),
    ("Elisa Rocha", "elisa.rocha@exemplo.pt"),
    ("Filipe Almeida", "filipe.almeida@exemplo.pt"),
    ("Gabriela Pinto", "gabriela.pinto@exemplo.pt"),
    ("Hugo Carvalho", "hugo.carvalho@exemplo.pt"),
    ("Inês Teixeira", "ines.teixeira@exemplo.pt"),
    ("João Neves", "joao.neves@exemplo.pt"),
    ("Lara Mendes", "lara.mendes@exemplo.pt"),
    ("Miguel Santos", "miguel.santos@exemplo.pt"),
    ("Nádia Ferreira", "nadia.ferreira@exemplo.pt"),
    ("Óscar Pereira", "oscar.pereira@exemplo.pt"),
    ("Patrícia Lopes", "patricia.lopes@exemplo.pt"),
    ("Ricardo Sousa", "ricardo.sousa@exemplo.pt"),
    ("Sara Oliveira", "sara.oliveira@exemplo.pt"),
    ("Tiago Marques", "tiago.marques@exemplo.pt"),
    ("Vera Matos", "vera.matos@exemplo.pt"),
    ("Xavier Gomes", "xavier.gomes@exemplo.pt"),
    ("Zulmira Reis", "zulmira.reis@exemplo.pt"),
    ("André Fonseca", "andre.fonseca@exemplo.pt"),
)

TEXTS = (
    "Vim ler um livro à sombra, como faço quase todas as sextas-feiras.",
    "Trago a minha filha ao parque infantil e fico a conversar com outros pais.",
    "Atravessei o jardim a caminho do trabalho e sentei-me cinco minutos num banco.",
    "Encontrei um vizinho e ficámos a falar sobre as obras do quiosque.",
    "Vim caminhar depois do almoço e contar as voltas ao lago.",
    "Trago o cão a passear todos os dias e hoje ficámos mais tempo do que o costume.",
    "Vim esperar por uma amiga e aproveitei para ver as flores novas junto à estufa.",
    "Gosto de vir aqui ler quando o jardim está mais calmo, ao fim da tarde.",
    "Hoje vim só para descansar um pouco antes de voltar para casa.",
    "Passei a correr pelo caminho de terra e parei para beber água.",
    "Vim com os netos ao parque infantil e ficámos até ao lanche.",
    "Sentei-me num banco ao sol a ver as pessoas a passar.",
    "Vim buscar sombra: em casa não se consegue estar com este calor.",
    "Atravessei o jardim para apanhar o autocarro e parei para ver o lago.",
    "Costumo vir aqui à hora do almoço e hoje trouxe uma sandes.",
    "Vim ver se as árvores do lado da estufa já tinham flores.",
    "Passei pelo jardim a caminho da consulta e sentei-me um pouco.",
    "Vim ler as notícias no telemóvel e acabei a olhar para os patos.",
    "Hoje apeteceu-me vir ouvir os pássaros antes de começar o dia.",
    "Vim com uma amiga que não conhecia o jardim e mostrei-lhe o lago.",
)

PHOTO_NOTES = (
    "Sombra perto do lago.",
    "Os bancos estão quase todos ocupados.",
    "O caminho de terra está mais calmo hoje.",
    "As árvores junto à estufa estão cheias de flores.",
    "Um canto do jardim onde quase não passa ninguém.",
    "A luz desta hora apanha o relvado todo.",
    "O quiosque está fechado mas o jardim continua cheio.",
    "Parei aqui porque havia sombra e silêncio.",
)

SCALE_WEIGHTS = (2, 8, 20, 35, 35)  # value 1..5, mostly the positive end

# The scheduler plans 15-minute slots inside the activity window and the participant's
# availability (scheduler.md). The history step writes prompts on the same grid.
HISTORY_SLOT_MINUTES = 15
HISTORY_ANSWER_LOOKBACK = 2  # an answered prompt is sent at most 30 minutes before the entry
# The API counts free entries by the server's ``received_at``, so every backfilled entry counts
# as today's. The limit is raised while the entries are submitted and restored afterwards.
SEED_FREE_ENTRY_LIMIT = 20
DATABASE_URL_VARIABLE = "SEED_DATABASE_URL"
PARTICIPANT_STATUSES = ("active", "withdrawn", "removed")  # the states the researcher views count

# The demonstration is always on day 13 of 14: the study began 12 days ago and ends tomorrow.
DEMO_DAYS_BEFORE_TODAY = 12
DEMO_END_IN_DAYS = 1
DEV_LOGINS_RELATIVE_PATH = Path("_private") / "entregas" / "entrega-2" / "dev-logins.md"


class SeedError(RuntimeError):
    """A step of the demonstration data could not be completed."""


class ApiError(SeedError):
    def __init__(self, method: str, path: str, status: int, body: str) -> None:
        super().__init__(f"{method} {path} answered HTTP {status}: {body}")
        self.status = status
        self.body = body


def _normalise_base_url(value: str) -> str:
    cleaned = value.strip().rstrip("/")
    if "//localhost" in cleaned:
        cleaned = cleaned.replace("//localhost", "//127.0.0.1")
    return cleaned


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class Api:
    """Thin JSON client. Administrator calls re-authenticate once on a 401."""

    def __init__(self, base_url: str) -> None:
        self.base_url = _normalise_base_url(base_url)
        self.client = httpx.Client(base_url=self.base_url, timeout=httpx.Timeout(60.0))
        self.admin_token: str | None = None
        self.admin_email: str | None = None
        self.admin_password: str | None = None
        self.totp_secret: str | None = None

    def close(self) -> None:
        self.client.close()

    # Raw helpers -----------------------------------------------------------------------------

    def _raw(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        scheme: str = "Bearer",
        **kwargs: Any,
    ) -> httpx.Response:
        headers = dict(kwargs.pop("headers", {}))
        if token is not None:
            headers["Authorization"] = f"{scheme} {token}"
        return self.client.request(method, f"{API_ROOT}{path}", headers=headers, **kwargs)

    def _checked(self, method: str, path: str, response: httpx.Response) -> Any:
        if response.status_code == 204:
            return None
        try:
            payload = response.json()
        except ValueError as exc:
            raise ApiError(method, path, response.status_code, response.text) from exc
        if response.status_code >= 400:
            raise ApiError(method, path, response.status_code, response.text)
        return payload

    # Administrator ---------------------------------------------------------------------------

    def login_admin(self) -> str:
        if not self.admin_email or not self.admin_password:
            raise SeedError("The administrator credentials are not set.")
        response = self._raw(
            "POST",
            "/auth/login",
            json={"email": self.admin_email, "password": self.admin_password},
        )
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            return self.admin_token

        code = _error_code(response)
        if code == "totp_enrolment_required":
            enrolment = self._raw(
                "POST",
                "/auth/totp/enrolment",
                json={"email": self.admin_email, "password": self.admin_password},
            )
            payload = self._checked("POST", "/auth/totp/enrolment", enrolment)
            self.totp_secret = payload["secret"]
        elif code != "totp_required":
            raise ApiError("POST", "/auth/login", response.status_code, response.text)

        last: httpx.Response | None = None
        for attempt in range(4):
            totp_code = self._totp_code()
            last = self._raw(
                "POST",
                "/auth/login",
                json={
                    "email": self.admin_email,
                    "password": self.admin_password,
                    "totp_code": totp_code,
                },
            )
            if last.status_code == 200:
                self.admin_token = last.json()["access_token"]
                return self.admin_token
            if _error_code(last) not in {"invalid_credentials", "totp_required"}:
                break
            clock.sleep(1 + attempt)
        assert last is not None
        raise ApiError("POST", "/auth/login", last.status_code, last.text)

    def _totp_code(self) -> str:
        if self.totp_secret is not None:
            return _totp_for_secret(self.totp_secret)
        assert self.admin_email is not None
        return _totp_for_account(self.admin_email)

    def admin(
        self, method: str, path: str, *, expected: tuple[int, ...] = (200,), **kwargs: Any
    ) -> Any:
        if self.admin_token is None:
            self.login_admin()
        response = self._raw(method, path, token=self.admin_token, **kwargs)
        if response.status_code == 401:
            self.login_admin()
            response = self._raw(method, path, token=self.admin_token, **kwargs)
        if response.status_code not in expected:
            raise ApiError(method, path, response.status_code, response.text)
        return self._checked(method, path, response)

    # Researcher ------------------------------------------------------------------------------

    def login_user(self, email: str, password: str) -> str:
        response = self._raw(
            "POST", "/auth/login", json={"email": email, "password": password}
        )
        payload = self._checked("POST", "/auth/login", response)
        return payload["access_token"]

    def change_password(self, token: str, current: str, new: str) -> None:
        response = self._raw(
            "POST",
            "/auth/password/change",
            token=token,
            json={"current_password": current, "new_password": new},
        )
        self._checked("POST", "/auth/password/change", response)

    # Participant -----------------------------------------------------------------------------

    def device(
        self,
        method: str,
        path: str,
        token: str,
        *,
        expected: tuple[int, ...] = (200,),
        **kwargs: Any,
    ) -> Any:
        response = self._raw(method, path, token=token, scheme="Device", **kwargs)
        if response.status_code not in expected:
            raise ApiError(method, path, response.status_code, response.text)
        return self._checked(method, path, response)

    def public(
        self, method: str, path: str, *, expected: tuple[int, ...] = (200,), **kwargs: Any
    ) -> Any:
        response = self._raw(method, path, **kwargs)
        if response.status_code not in expected:
            raise ApiError(method, path, response.status_code, response.text)
        return self._checked(method, path, response)


def _error_code(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    error = payload.get("error") if isinstance(payload, dict) else None
    return error.get("code") if isinstance(error, dict) else None


def _compose_file() -> Path:
    path = _repo_root() / "infra" / "deploy" / "compose.yaml"
    if not path.is_file():
        raise SeedError(
            "The TOTP code needs docker compose: infra/deploy/compose.yaml was not found."
        )
    return path


def _compose_exec(python_code: str, *arguments: str, service: str = "api") -> str:
    command = [
        "docker",
        "compose",
        "-f",
        str(_compose_file()),
        "--profile",
        "dev",
        "exec",
        "-T",
        service,
        "python",
        "-c",
        python_code,
        *arguments,
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise SeedError(f"Cannot run the {service} container: {exc}") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise SeedError(f"The {service} container failed: {detail}")
    output = result.stdout.strip().splitlines()[-1].strip() if result.stdout.strip() else ""
    if not output:
        raise SeedError(f"The {service} container did not return a result.")
    return output


def _totp_for_secret(secret: str) -> str:
    return _compose_exec(
        "import sys; from app.security import totp; print(totp.generate_code(sys.argv[1]))",
        secret,
    )


def _totp_for_account(email: str) -> str:
    # The administrator is already enrolled, so the secret is read from its row and the code is
    # generated by the API's own helper. Nothing is written.
    return _compose_exec(
        "import sys\n"
        "from sqlalchemy import select\n"
        "from app.db import SessionLocal\n"
        "from app.models import UserAccount\n"
        "from app.security import totp\n"
        "session = SessionLocal()\n"
        "account = session.scalar(select(UserAccount).where(UserAccount.email == sys.argv[1]))\n"
        "if account is None or account.totp_secret is None:\n"
        "    raise SystemExit('account has no TOTP secret')\n"
        "print(totp.generate_code(account.totp_secret))\n"
        "session.close()\n",
        email,
    )


def _find_study(api: Api) -> dict[str, Any] | None:
    studies = api.admin("GET", "/admin/studies")
    matches = [study for study in studies if study.get("title") == STUDY_TITLE]
    return matches[0] if matches else None


def _print_existing(api: Api, study: dict[str, Any], dashboard_url: str) -> None:
    participants = api.admin("GET", f"/studies/{study['id']}/participants")
    statuses = Counter(item["status"] for item in participants)
    unused = sum(
        1 for item in participants if item["status"] == "active" and item.get("entered_at") is None
    )
    print(f"Study already exists: {STUDY_TITLE} ({study['id']})")
    print(
        "Participants: "
        f"{len(participants)} total, {statuses.get('active', 0)} active "
        f"({unused} invite unused), {statuses.get('withdrawn', 0)} withdrawn, "
        f"{statuses.get('removed', 0)} removed, {statuses.get('declined', 0)} declined"
    )
    print(f"Entries: {study.get('entries', 0)}")
    team = ", ".join(
        f"{member['email']} ({member['role']})" for member in study.get("team", [])
    )
    print(f"Team: {team}")
    print(
        "Researcher passwords: unchanged from the first run "
        "(they are printed only when the accounts are created)."
    )
    print(f"Dashboard: {dashboard_url}")
    print("Nothing was created: a second run does not duplicate the study.")


def _account_passwords(api: Api) -> dict[str, str]:
    accounts = api.admin("GET", "/admin/accounts")
    by_email = {account["email"]: account for account in accounts}
    passwords: dict[str, str] = {}
    for email, _role in RESEARCHERS:
        if email in by_email:
            print(f"Account already exists, password unchanged: {email}")
            continue
        created = api.admin(
            "POST",
            "/admin/accounts",
            expected=(201,),
            json={"email": email, "role": "researcher"},
        )
        # The administrator password is temporary: sign in with it and replace it with the one
        # this step prints.
        temporary = created["temporary_password"]
        password = secrets.token_urlsafe(12)
        token = api.login_user(email, temporary)
        api.change_password(token, temporary, password)
        passwords[email] = password
        print(f"Created account: {email}")
    return passwords


def _create_study(
    api: Api, starts_on: str, ends_on: str, researchers: dict[str, str]
) -> str:
    study = api.admin(
        "POST",
        "/studies",
        expected=(201,),
        json={
            "title": STUDY_TITLE,
            "description": STUDY_DESCRIPTION,
            "starts_on": starts_on,
            "ends_on": ends_on,
            "timezone": TIMEZONE,
            "max_prompts_per_day": 4,
            "max_prompts_per_slot": 2,
            "schedule_style": "varied",
        },
    )
    study_id = study["id"]
    accounts = {account["email"]: account for account in api.admin("GET", "/admin/accounts")}
    for email, role in RESEARCHERS:
        api.admin(
            "POST",
            f"/studies/{study_id}/members",
            expected=(201,),
            json={"email": email, "role": role},
        )
    # The administrator created the study; hand it to the principal investigator.
    admin_id = accounts[api.admin_email]["id"]
    api.admin("DELETE", f"/studies/{study_id}/members/{admin_id}", expected=(204,))
    return study_id


def _create_questions(api: Api, study_id: str) -> list[dict[str, Any]]:
    created = []
    for question in QUESTIONS:
        created.append(
            api.admin(
                "POST",
                f"/studies/{study_id}/questions",
                expected=(201,),
                json=question,
            )
        )
    return created


def _create_activities(api: Api, study_id: str) -> dict[str, str]:
    ids: dict[str, str] = {}
    for activity in ACTIVITIES:
        payload = {key: value for key, value in activity.items() if key != "key"}
        payload["max_free_entries_per_day"] = SEED_FREE_ENTRY_LIMIT
        created = api.admin(
            "POST",
            f"/studies/{study_id}/activities",
            expected=(201,),
            json=payload,
        )
        ids[activity["key"]] = created["id"]
    return ids


def _restore_free_entry_limits(api: Api, study_id: str, activity_ids: dict[str, str]) -> None:
    for activity in ACTIVITIES:
        api.admin(
            "PATCH",
            f"/studies/{study_id}/activities/{activity_ids[activity['key']]}",
            json={"max_free_entries_per_day": activity["max_free_entries_per_day"]},
        )


def _study_dates(end_in_days: int) -> tuple[date, date]:
    today = _now_lisbon().date()
    return today - timedelta(days=DEMO_DAYS_BEFORE_TODAY), today + timedelta(days=end_in_days)


@dataclass
class Participant:
    id: str
    alias: str
    token: str
    availability: tuple[int, int, list[int]]
    answers: list[dict[str, Any]]
    profile: float
    entries: int = 0


@dataclass(frozen=True)
class ActivityRule:
    id: uuid.UUID
    prompts_per_day: int
    window_start: int
    window_end: int
    min_gap_minutes: int


@dataclass(frozen=True)
class AvailabilityWindow:
    start_minute: int
    end_minute: int
    weekdays: frozenset[int]


@dataclass(frozen=True)
class EntryRow:
    id: uuid.UUID
    recorded_at: datetime


@dataclass(frozen=True)
class PlannedPrompt:
    participant_id: uuid.UUID
    activity: ActivityRule
    plan_date: date
    occurrence: int
    slot: int | None  # None when the study-wide slot cap left no free slot
    timezone: tzinfo
    entry_id: uuid.UUID | None


def _answers(rng: random.Random, questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    answers: list[dict[str, Any]] = []
    for question in questions:
        kind = question["kind"]
        options = question.get("options") or []
        if kind == "multiple_choice":
            count = rng.randint(1, min(2, len(options)))
            answers.append(
                {"question_id": question["id"], "answer": rng.sample(list(options), count)}
            )
        elif kind == "single_choice":
            answers.append({"question_id": question["id"], "answer": rng.choice(list(options))})
        elif kind == "yes_no":
            answers.append({"question_id": question["id"], "answer": rng.choice(["yes", "no"])})
        else:
            answers.append(
                {
                    "question_id": question["id"],
                    "answer": "Venho ao jardim quase todas as semanas.",
                }
            )
    return answers


def _personal_code(api: Api, study_id: str, index: int) -> dict[str, Any]:
    alias = f"P-{index + 1:02d}"
    name, email = FAKE_IDENTITIES[index % len(FAKE_IDENTITIES)]
    return api.admin(
        "POST",
        f"/studies/{study_id}/participants",
        expected=(201,),
        json={"alias": alias, "name": name, "email": email},
    )


def _join(
    api: Api,
    code: str,
    android_id: str,
    answers: list[dict[str, Any]],
    rng: random.Random,
) -> dict[str, Any]:
    lookup = api.public(
        "POST",
        "/participation/invitations/lookup",
        json={"code": code, "android_id": android_id},
    )
    accepted = api.public(
        "POST",
        "/participation/invitations/accept",
        json={
            "code": code,
            "android_id": android_id,
            "locale": "pt",
            "consent_version": lookup["consent_version"],
            "answers": answers,
        },
    )
    if accepted["outcome"] not in {
        "joined",
        "returned",
        "already_participating",
        "pending_approval",
        "waiting_approval",
    }:
        raise SeedError(f"Unexpected join outcome for {code}: {accepted['outcome']}")
    if not accepted.get("device_token"):
        raise SeedError(f"Joining with {code} did not return a device token.")
    return accepted


def _set_availability(api: Api, participant: Participant) -> None:
    start, end, weekdays = participant.availability
    api.device(
        "PUT",
        "/participation/me/availability",
        participant.token,
        json={
            "any_time": False,
            "intervals": [
                {
                    "start_time": f"{start // 60:02d}:{start % 60:02d}:00",
                    "end_time": f"{end // 60:02d}:{end % 60:02d}:00",
                    "weekdays": weekdays,
                }
            ],
        },
    )


def _join_participants(
    api: Api,
    created: list[tuple[dict[str, Any], str, int]],
    questions: list[dict[str, Any]],
    rng: random.Random,
) -> list[Participant]:
    joined: list[Participant] = []
    for index, (record, code, spec_index) in enumerate(created):
        answers = _answers(rng, questions)
        accepted = _join(api, code, f"demo-{rng.getrandbits(48):012x}", answers, rng)
        participant = Participant(
            id=accepted["participant"]["id"],
            alias=record["alias"],
            token=accepted["device_token"],
            availability=AVAILABILITY_SPECS[spec_index % len(AVAILABILITY_SPECS)],
            answers=answers,
            profile=_profile_for(index),
        )
        _set_availability(api, participant)
        joined.append(participant)
        print(f"  joined {participant.alias} ({index + 1}/{len(created)})")
    return joined


def _profile_for(index: int) -> float:
    # Most participants answer almost everything; a few answer much less.
    return (0.90, 0.90, 0.90, 0.90, 0.90, 0.62, 0.35)[index % 7]


def _declined_participant(
    api: Api, study_id: str, questions: list[dict[str, Any]], rng: random.Random, ends_on: str
) -> None:
    code = api.admin(
        "POST",
        f"/studies/{study_id}/invite-codes",
        expected=(201,),
        json={
            "name": "Cartaz no quiosque do jardim",
            "end_date": ends_on,
            "max_uses": 10,
            "max_per_hour": 5,
            "requires_approval": True,
            "requires_account": False,
        },
    )
    answers = _answers(rng, questions)
    accepted = _join(api, code["code"], f"demo-declined-{rng.getrandbits(48):012x}", answers, rng)
    if accepted["outcome"] != "pending_approval":
        raise SeedError("The poster code did not leave the participant waiting for approval.")
    participant_id = accepted["participant"]["id"]
    api.admin(
        "POST",
        f"/studies/{study_id}/approvals/{participant_id}/decline",
        json={},
    )
    # Keep a personal code on the row too, so every participant has one in the list.
    api.admin(
        "POST",
        f"/studies/{study_id}/participants/{participant_id}/invite-code",
        expected=(201,),
    )
    print("  one participant entered by the poster code and was declined")


def _pick_time(
    rng: random.Random,
    local_date: Any,
    availability: tuple[int, int, list[int]],
    activity_key: str,
    now_local: datetime,
) -> datetime | None:
    start, end, weekdays = availability
    if local_date.isoweekday() not in weekdays:
        return None
    activity = next(item for item in ACTIVITIES if item["key"] == activity_key)
    window_start = _minutes(activity["window_start"])
    window_end = _minutes(activity["window_end"])
    low = max(start, window_start)
    high = min(end, window_end)
    if local_date == now_local.date():
        high = min(high, now_local.hour * 60 + now_local.minute - 10)
    if high - low < 20:
        return None
    minute = rng.randint(low + 10, high - 5)
    return datetime.combine(
        local_date, time(minute // 60, minute % 60), tzinfo=_lisbon_tz(local_date)
    )


def _minutes(value: str) -> int:
    hours, minutes, _seconds = (int(part) for part in value.split(":"))
    return hours * 60 + minutes


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _garden_photo(rng: random.Random) -> bytes:
    width, height = 800, 600
    image = Image.new("RGB", (width, height), (220, 235, 250))
    draw = ImageDraw.Draw(image)

    sky_top = (rng.randint(100, 140), rng.randint(165, 195), rng.randint(215, 245))
    sky_bottom = (rng.randint(205, 235), rng.randint(225, 240), rng.randint(240, 250))
    for y in range(height * 2 // 3):
        ratio = y / max(1, height * 2 // 3)
        colour = tuple(int(sky_top[i] + (sky_bottom[i] - sky_top[i]) * ratio) for i in range(3))
        draw.line([(0, y), (width, y)], fill=colour)

    horizon = int(height * 0.62)
    ground_top = (rng.randint(52, 82), rng.randint(105, 135), rng.randint(52, 78))
    ground_bottom = (rng.randint(30, 58), rng.randint(78, 104), rng.randint(34, 58))
    for y in range(horizon, height):
        ratio = (y - horizon) / max(1, height - horizon)
        colour = tuple(
            int(ground_top[i] + (ground_bottom[i] - ground_top[i]) * ratio) for i in range(3)
        )
        draw.line([(0, y), (width, y)], fill=colour)

    if rng.random() < 0.55:
        pond_left = rng.randint(40, 300)
        pond_top = horizon + rng.randint(20, 80)
        draw.ellipse(
            [
                pond_left,
                pond_top,
                pond_left + rng.randint(180, 320),
                pond_top + rng.randint(50, 100),
            ],
            fill=(rng.randint(90, 130), rng.randint(150, 185), rng.randint(190, 220)),
            outline=(70, 115, 150),
            width=3,
        )

    path_y = horizon + rng.randint(80, 140)
    draw.polygon(
        [
            (0, height),
            (rng.randint(120, 300), path_y),
            (rng.randint(480, 680), path_y),
            (width, height),
        ],
        fill=(rng.randint(178, 205), rng.randint(160, 186), rng.randint(125, 150)),
    )

    for _ in range(rng.randint(2, 4)):
        x = rng.randint(50, width - 80)
        tree_height = rng.randint(150, 260)
        trunk_width = rng.randint(12, 24)
        base = horizon + rng.randint(20, 90)
        draw.rectangle(
            [x, base - tree_height, x + trunk_width, base],
            fill=(rng.randint(78, 105), rng.randint(52, 72), rng.randint(34, 52)),
        )
        canopy = (rng.randint(35, 70), rng.randint(90, 140), rng.randint(40, 80))
        for _ in range(rng.randint(4, 7)):
            radius = rng.randint(35, 70)
            cx = x + trunk_width // 2 + rng.randint(-55, 55)
            cy = base - tree_height + rng.randint(-35, 55)
            draw.ellipse(
                [cx - radius, cy - radius, cx + radius, cy + radius],
                fill=canopy,
            )

    if rng.random() < 0.8:
        bench_x = rng.randint(380, 650)
        bench_y = horizon + rng.randint(70, 130)
        wood = (rng.randint(110, 140), rng.randint(72, 95), rng.randint(42, 62))
        draw.rectangle([bench_x, bench_y, bench_x + 120, bench_y + 14], fill=wood)
        draw.rectangle([bench_x, bench_y + 22, bench_x + 120, bench_y + 34], fill=wood)
        draw.rectangle([bench_x + 8, bench_y + 34, bench_x + 18, bench_y + 68], fill=wood)
        draw.rectangle([bench_x + 102, bench_y + 34, bench_x + 112, bench_y + 68], fill=wood)

    sun_x = rng.randint(60, width - 60)
    sun_y = rng.randint(40, horizon - 80)
    sun_radius = rng.randint(24, 40)
    draw.ellipse(
        [sun_x - sun_radius, sun_y - sun_radius, sun_x + sun_radius, sun_y + sun_radius],
        fill=(rng.randint(240, 255), rng.randint(215, 240), rng.randint(150, 190)),
    )

    for _ in range(rng.randint(8, 22)):
        flower_x = rng.randint(0, width)
        flower_y = rng.randint(horizon + 20, height - 10)
        flower_radius = rng.randint(3, 7)
        draw.ellipse(
            [flower_x, flower_y, flower_x + flower_radius, flower_y + flower_radius],
            fill=(rng.randint(200, 250), rng.randint(80, 180), rng.randint(90, 190)),
        )

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85, optimize=True)
    return buffer.getvalue()


def _upload_photo(api: Api, participant: Participant, entry_id: str, payload: bytes) -> str:
    digest = _sha256(payload)
    upload = api.device(
        "POST",
        "/media/upload-url",
        participant.token,
        expected=(201,),
        json={
            "entry_id": entry_id,
            "mime_type": "image/jpeg",
            "size_bytes": len(payload),
            "sha256": digest,
        },
    )
    signed = urlsplit(upload["upload_url"])
    base = urlsplit(api.base_url)
    port = signed.port or (443 if signed.scheme == "https" else 80)
    target = f"{base.scheme}://{base.hostname}:{port}{signed.path}"
    if signed.query:
        target = f"{target}?{signed.query}"
    response = api.client.put(
        target,
        content=payload,
        headers={
            "Host": signed.netloc,
            "Content-Type": "image/jpeg",
            "Content-Length": str(len(payload)),
        },
    )
    if response.status_code not in (200, 204):
        raise SeedError(
            f"Uploading the photo answered HTTP {response.status_code}: {response.text[:200]}"
        )
    return upload["media_object_id"]


def _submit_photo(
    api: Api,
    participant: Participant,
    activity_id: str,
    recorded_at: datetime,
    rng: random.Random,
    index: int,
) -> None:
    entry_id = str(uuid.uuid4())
    payload = _garden_photo(random.Random(f"{index}-{rng.getrandbits(32)}"))
    media_id = _upload_photo(api, participant, entry_id, payload)
    body = rng.choice(PHOTO_NOTES) if rng.random() < 0.4 else None
    latitude = 38.7145 + rng.uniform(-0.0008, 0.0008)
    longitude = -9.1590 + rng.uniform(-0.0008, 0.0008)
    request: dict[str, Any] = {
        "id": entry_id,
        "activity_id": activity_id,
        "entry_type": "photo",
        "content_sha256": _sha256(payload),
        "recorded_at": recorded_at.isoformat(),
        "media_object_ids": [media_id],
        "latitude": latitude,
        "longitude": longitude,
    }
    if body:
        request["body"] = body
    api.device("POST", "/entries", participant.token, json=request)


def _submit_text(
    api: Api, participant: Participant, activity_id: str, recorded_at: datetime, rng: random.Random
) -> None:
    body = rng.choice(TEXTS)
    api.device(
        "POST",
        "/entries",
        participant.token,
        json={
            "id": str(uuid.uuid4()),
            "activity_id": activity_id,
            "entry_type": "text",
            "content_sha256": _sha256(body.encode("utf-8")),
            "recorded_at": recorded_at.isoformat(),
            "body": body,
        },
    )


def _submit_scale(
    api: Api, participant: Participant, activity_id: str, recorded_at: datetime, rng: random.Random
) -> None:
    value = rng.choices(range(1, 6), weights=SCALE_WEIGHTS, k=1)[0]
    shown = {
        "scale_type": "faces",
        "points": 5,
        "start_label": "Muito mal",
        "middle_label": "Assim-assim",
        "end_label": "Muito bem",
    }
    api.device(
        "POST",
        "/entries",
        participant.token,
        json={
            "id": str(uuid.uuid4()),
            "activity_id": activity_id,
            "entry_type": "scale",
            "content_sha256": _sha256(f"scale:{value}".encode()),
            "recorded_at": recorded_at.isoformat(),
            "value": value,
            "scale_shown": shown,
        },
    )


def _seed_entries(
    api: Api,
    participants: list[Participant],
    activity_ids: dict[str, str],
    first_day: date,
    last_day: date,
    seed: int,
) -> None:
    now_local = _now_lisbon()
    days = (last_day - first_day).days + 1
    for index, participant in enumerate(participants):
        rng = random.Random(f"{seed}-{index}-entries")
        count = 0
        for offset in range(days):
            local_date = first_day + timedelta(days=offset)
            for activity in ACTIVITIES:
                if rng.random() > participant.profile:
                    continue
                recorded_at = _pick_time(
                    rng, local_date, participant.availability, activity["key"], now_local
                )
                if recorded_at is None:
                    continue
                activity_id = activity_ids[activity["key"]]
                if activity["key"] == "A1":
                    _submit_photo(api, participant, activity_id, recorded_at, rng, index)
                elif activity["key"] == "A2":
                    _submit_text(api, participant, activity_id, recorded_at, rng)
                else:
                    _submit_scale(api, participant, activity_id, recorded_at, rng)
                count += 1
        participant.entries = count
        print(f"  {participant.alias}: {count} entries")


def _list_entries(api: Api, study_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        params: dict[str, Any] = {"limit": 200}
        if cursor:
            params["cursor"] = cursor
        page = api.admin("GET", f"/studies/{study_id}/entries", params=params)
        items.extend(page["items"])
        cursor = page.get("next_cursor")
        if not cursor:
            return items


def _wait_for_media(api: Api, study_id: str, timeout: int = 600) -> list[dict[str, Any]]:
    deadline = clock.monotonic() + timeout
    last_report = 0.0
    while True:
        entries = _list_entries(api, study_id)
        statuses = [media["status"] for entry in entries for media in entry.get("media", [])]
        processed = sum(1 for status in statuses if status == "processed")
        failed = sum(1 for status in statuses if status == "failed")
        if failed:
            raise SeedError(f"{failed} media files failed processing.")
        if not statuses or processed == len(statuses):
            print(f"  media processed: {processed}")
            return entries
        now = clock.monotonic()
        if now >= deadline:
            pending = len(statuses) - processed
            raise SeedError(
                f"{pending} of {len(statuses)} media files are still not processed "
                f"after {timeout} seconds."
            )
        if now - last_report >= 10:
            print(f"  waiting for media: {processed}/{len(statuses)} processed")
            last_report = now
        clock.sleep(3)


def _finish_participants(
    api: Api, study_id: str, joined: list[Participant]
) -> tuple[Participant | None, Participant | None]:
    if len(joined) < 2:
        return None, None
    withdrawn = joined[-1]
    removed = joined[-2]
    api.device("POST", "/participation/me/leave", withdrawn.token, json={})
    api.admin(
        "POST",
        f"/studies/{study_id}/participants/{removed.id}/remove",
        expected=(204,),
        json={},
    )
    print(f"  {withdrawn.alias} withdrew; {removed.alias} was removed by the team")
    return withdrawn, removed


def _print_summary(
    api: Api,
    study_id: str,
    entries: list[dict[str, Any]],
    passwords: dict[str, str],
    dashboard_url: str,
) -> None:
    participants = api.admin("GET", f"/studies/{study_id}/participants")
    statuses = Counter(item["status"] for item in participants)
    unused = sum(
        1 for item in participants if item["status"] == "active" and item.get("entered_at") is None
    )
    by_type = Counter(entry["entry_type"] for entry in entries)
    media = [item for entry in entries for item in entry.get("media", [])]
    processed = sum(1 for item in media if item["status"] == "processed")
    members = api.admin("GET", f"/studies/{study_id}/members")
    team = ", ".join(f"{member['email']} ({member['role']})" for member in members)

    print()
    print("Demo study ready")
    print(f"  Study: {STUDY_TITLE} ({study_id})")
    print(f"  Team: {team}")
    print(
        "  Participants: "
        f"{len(participants)} total, {statuses.get('active', 0)} active "
        f"({unused} invite unused), {statuses.get('withdrawn', 0)} withdrawn, "
        f"{statuses.get('removed', 0)} removed, {statuses.get('declined', 0)} declined"
    )
    print(
        "  Entries: "
        f"{len(entries)} total, {by_type.get('photo', 0)} photo, "
        f"{by_type.get('text', 0)} text, {by_type.get('scale', 0)} scale"
    )
    print(f"  Media: {len(media)} files, {processed} processed")
    print("  Researcher logins (passwords are shown only in this run):")
    for email, _role in RESEARCHERS:
        password = passwords.get(email)
        if password:
            print(f"    {email} / {password}")
        else:
            print(f"    {email} / unchanged (the account already existed)")
    print(f"  Dashboard: {dashboard_url}")


@dataclass
class HistoryContext:
    study_id: uuid.UUID
    timezone_name: str
    max_prompts_per_day: int
    max_prompts_per_slot: int
    first_day: date
    last_day: date
    participants: list[uuid.UUID]
    activities: list[ActivityRule]
    availability: dict[uuid.UUID, list[AvailabilityWindow]]
    any_time: dict[uuid.UUID, bool]
    entries: dict[tuple[uuid.UUID, date, uuid.UUID], list[EntryRow]]
    existing: set[tuple[uuid.UUID, uuid.UUID, date, int]]
    existing_slots: list[tuple[date, int]]


def _time_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _study_timezone(name: str, day: date) -> tzinfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        if name == TIMEZONE:
            return _lisbon_tz(day)
        return UTC


def _database_url() -> str:
    value = os.environ.get(DATABASE_URL_VARIABLE, "").strip()
    if not value:
        raise SeedError(
            f"Set {DATABASE_URL_VARIABLE}, for example "
            "postgresql://fieldnote:fieldnote@127.0.0.1:5432/fieldnote"
        )
    if value.startswith("postgresql+psycopg://"):
        value = "postgresql://" + value.removeprefix("postgresql+psycopg://")
    parts = urlsplit(value)
    if parts.hostname != "127.0.0.1" or parts.port != 5432:
        raise SeedError(
            f"{DATABASE_URL_VARIABLE} must point at the development database on "
            "127.0.0.1:5432, never at another host."
        )
    return value


def _database_label(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.hostname}:{parts.port}{parts.path}"


def _load_history(connection: psycopg.Connection) -> HistoryContext:
    study = connection.execute(
        "SELECT id, starts_on, ends_on, timezone, max_prompts_per_day, max_prompts_per_slot "
        "FROM study WHERE title = %s ORDER BY starts_on, id LIMIT 1",
        (STUDY_TITLE,),
    ).fetchone()
    if study is None:
        raise SeedError(f"The study {STUDY_TITLE!r} was not found: run the seed step first.")
    if study["starts_on"] is None or study["ends_on"] is None:
        raise SeedError("The study has no start and end dates yet.")

    timezone_name = study["timezone"]
    today = datetime.now(UTC).astimezone(_study_timezone(timezone_name, study["ends_on"])).date()
    last_day = min(study["ends_on"], today - timedelta(days=1))
    first_day = study["starts_on"]
    if last_day < first_day:
        raise SeedError("The study has no past day to fill yet: run the history step tomorrow.")

    participants = connection.execute(
        "SELECT id, availability_any_time FROM participant "
        "WHERE study_id = %s AND status::text = ANY(%s) "
        "ORDER BY alias, id",
        (study["id"], list(PARTICIPANT_STATUSES)),
    ).fetchall()
    participant_ids = [participant["id"] for participant in participants]
    any_time = {
        participant["id"]: participant["availability_any_time"] for participant in participants
    }

    activity_rows = connection.execute(
        "SELECT id, prompts_per_day, window_start, window_end, min_gap_minutes "
        "FROM activity WHERE study_id = %s ORDER BY id",
        (study["id"],),
    ).fetchall()
    activities = [
        ActivityRule(
            id=row["id"],
            prompts_per_day=row["prompts_per_day"],
            window_start=_time_minutes(row["window_start"]),
            window_end=_time_minutes(row["window_end"]),
            min_gap_minutes=row["min_gap_minutes"],
        )
        for row in activity_rows
    ]

    availability: dict[uuid.UUID, list[AvailabilityWindow]] = {}
    for row in connection.execute(
        "SELECT participant_id, start_time, end_time, weekdays FROM availability "
        "WHERE participant_id = ANY(%s) ORDER BY participant_id, start_time",
        (participant_ids,),
    ):
        availability.setdefault(row["participant_id"], []).append(
            AvailabilityWindow(
                start_minute=_time_minutes(row["start_time"]),
                end_minute=_time_minutes(row["end_time"]),
                weekdays=frozenset(row["weekdays"]),
            )
        )

    start_bound = datetime.combine(
        first_day, time.min, tzinfo=_study_timezone(timezone_name, first_day)
    ).astimezone(UTC)
    end_bound = datetime.combine(
        last_day + timedelta(days=1),
        time.min,
        tzinfo=_study_timezone(timezone_name, last_day + timedelta(days=1)),
    ).astimezone(UTC)
    entries: dict[tuple[uuid.UUID, date, uuid.UUID], list[EntryRow]] = {}
    for row in connection.execute(
        "SELECT id, participant_id, activity_id, recorded_at FROM entry "
        "WHERE participant_id = ANY(%s) AND prompt_id IS NULL AND activity_id IS NOT NULL "
        "AND recorded_at >= %s AND recorded_at < %s ORDER BY recorded_at, id",
        (participant_ids, start_bound, end_bound),
    ):
        zone = _study_timezone(timezone_name, row["recorded_at"].astimezone(UTC).date())
        local_date = row["recorded_at"].astimezone(zone).date()
        entries.setdefault((row["participant_id"], local_date, row["activity_id"]), []).append(
            EntryRow(id=row["id"], recorded_at=row["recorded_at"])
        )

    prompt_rows = connection.execute(
        "SELECT participant_id, activity_id, plan_date, occurrence, scheduled_at, status "
        "FROM prompt WHERE participant_id = ANY(%s)",
        (participant_ids,),
    ).fetchall()
    existing = {
        (row["participant_id"], row["activity_id"], row["plan_date"], row["occurrence"])
        for row in prompt_rows
    }
    # Prompts of an earlier run still occupy their slots, so a second run keeps the same cap.
    existing_slots = [
        (
            row["plan_date"],
            _entry_slot(
                row["scheduled_at"],
                _study_timezone(timezone_name, row["plan_date"]),
            ),
        )
        for row in prompt_rows
        if row["scheduled_at"] is not None and row["status"] != "unplanned"
    ]

    return HistoryContext(
        study_id=study["id"],
        timezone_name=timezone_name,
        max_prompts_per_day=study["max_prompts_per_day"],
        max_prompts_per_slot=study["max_prompts_per_slot"],
        first_day=first_day,
        last_day=last_day,
        participants=participant_ids,
        activities=activities,
        availability=availability,
        any_time=any_time,
        entries=entries,
        existing=existing,
        existing_slots=existing_slots,
    )


def _slot_domain(
    activity: ActivityRule,
    windows: list[AvailabilityWindow],
    any_time: bool,
    weekday: int,
) -> list[int]:
    first = (activity.window_start + HISTORY_SLOT_MINUTES - 1) // HISTORY_SLOT_MINUTES
    last = (activity.window_end - 1) // HISTORY_SLOT_MINUTES
    if last < first:
        return []
    spans = (
        [(0, 24 * 60)]
        if any_time
        else [
            (window.start_minute, window.end_minute)
            for window in windows
            if weekday in window.weekdays
        ]
    )
    slots: set[int] = set()
    for start, end in spans:
        low = max(first, (start + HISTORY_SLOT_MINUTES - 1) // HISTORY_SLOT_MINUTES)
        high = min(last, (end - 1) // HISTORY_SLOT_MINUTES)
        if high >= low:
            slots.update(range(low, high + 1))
    return sorted(slots)


def _slot_fits(slot: int, activity: ActivityRule, used: list[tuple[int, int]]) -> bool:
    return all(
        abs(slot - other) * HISTORY_SLOT_MINUTES >= max(activity.min_gap_minutes, gap)
        for other, gap in used
    )


def _entry_slot(recorded_at: datetime, zone: tzinfo) -> int:
    local = recorded_at.astimezone(zone)
    return (local.hour * 60 + local.minute) // HISTORY_SLOT_MINUTES


def _free_slot(
    domain: list[int],
    target: int,
    activity: ActivityRule,
    used: list[tuple[int, int]],
    slot_usage: dict[tuple[date, int], int],
    day: date,
    max_prompts_per_slot: int,
) -> int | None:
    """The next slot at or after ``target`` that respects the gap and the study-wide cap."""
    ordered = [slot for slot in domain if slot >= target] + [
        slot for slot in domain if slot < target
    ]
    for slot in ordered:
        if slot_usage.get((day, slot), 0) >= max_prompts_per_slot:
            continue
        if not _slot_fits(slot, activity, used):
            continue
        return slot
    return None


def _plan_day(
    context: HistoryContext,
    day: date,
    entries: dict[uuid.UUID, dict[uuid.UUID, EntryRow]],
    rngs: dict[uuid.UUID, random.Random],
    slot_usage: dict[tuple[date, int], int],
) -> list[PlannedPrompt]:
    zone = _study_timezone(context.timezone_name, day)
    domains: dict[uuid.UUID, dict[uuid.UUID, list[int]]] = {}
    used: dict[uuid.UUID, list[tuple[int, int]]] = {}
    planned: dict[uuid.UUID, int] = {}
    # Answered prompts of the whole day are placed first, so one participant's expired prompt
    # does not take the slot next to another participant's entry.
    items: list[tuple[int, str, str, int, uuid.UUID, ActivityRule, EntryRow | None]] = []
    for participant_id in context.participants:
        participant_entries = entries.get(participant_id, {})
        domains[participant_id] = {
            activity.id: _slot_domain(
                activity,
                context.availability.get(participant_id, []),
                context.any_time.get(participant_id, False),
                day.isoweekday(),
            )
            for activity in context.activities
        }
        used[participant_id] = []
        planned[participant_id] = 0
        for activity in context.activities:
            entry = participant_entries.get(activity.id)
            for occurrence in range(activity.prompts_per_day):
                answer = entry if occurrence == 0 else None
                items.append(
                    (
                        0 if answer is not None else 1,
                        str(participant_id),
                        str(activity.id),
                        occurrence,
                        participant_id,
                        activity,
                        answer,
                    )
                )
    items.sort(key=lambda item: item[:4])

    plans: list[PlannedPrompt] = []
    for _priority, _pid, _activity, occurrence, participant_id, activity, entry in items:
        if planned[participant_id] >= context.max_prompts_per_day:
            continue
        domain = domains[participant_id][activity.id]
        if not domain:
            continue
        slot: int | None = None
        if entry is not None:
            entry_slot = _entry_slot(entry.recorded_at, zone)
            near = [slot for slot in domain if 0 <= entry_slot - slot <= HISTORY_ANSWER_LOOKBACK]
            if near:
                slot = _free_slot(
                    near,
                    rngs[participant_id].choice(near),
                    activity,
                    used[participant_id],
                    slot_usage,
                    day,
                    context.max_prompts_per_slot,
                )
            if slot is None:
                # No free slot next to the entry: the prompt expires instead of moving so far
                # that it would no longer be sent before the answer.
                entry = None
        if entry is None and slot is None:
            slot = _free_slot(
                domain,
                rngs[participant_id].choice(domain),
                activity,
                used[participant_id],
                slot_usage,
                day,
                context.max_prompts_per_slot,
            )
        planned[participant_id] += 1
        if slot is not None:
            used[participant_id].append((slot, activity.min_gap_minutes))
            slot_usage[(day, slot)] = slot_usage.get((day, slot), 0) + 1
        plans.append(
            PlannedPrompt(
                participant_id=participant_id,
                activity=activity,
                plan_date=day,
                occurrence=occurrence,
                slot=slot,
                timezone=zone,
                entry_id=entry.id if entry is not None else None,
            )
        )
    return plans


def _write_history(connection: psycopg.Connection, seed: int) -> None:
    context = _load_history(connection)
    slot_usage: dict[tuple[date, int], int] = Counter(context.existing_slots)
    plans: list[PlannedPrompt] = []
    day = context.first_day
    while day <= context.last_day:
        entries: dict[uuid.UUID, dict[uuid.UUID, EntryRow]] = {}
        rngs: dict[uuid.UUID, random.Random] = {}
        for participant_id in context.participants:
            entries_by_activity: dict[uuid.UUID, EntryRow] = {}
            for activity in context.activities:
                rows = context.entries.get((participant_id, day, activity.id))
                if rows:
                    entries_by_activity[activity.id] = rows[0]
            entries[participant_id] = entries_by_activity
            rngs[participant_id] = random.Random(
                f"{seed}-history-{participant_id}-{day.isoformat()}"
            )
        plans.extend(_plan_day(context, day, entries, rngs, slot_usage))
        day += timedelta(days=1)

    inserted_answered = 0
    inserted_expired = 0
    inserted_unplanned = 0
    already_present = 0
    linked = 0
    for plan in plans:
        key = (plan.participant_id, plan.activity.id, plan.plan_date, plan.occurrence)
        if key in context.existing:
            already_present += 1
            continue
        if plan.slot is None:
            scheduled_at = None
        else:
            minute = plan.slot * HISTORY_SLOT_MINUTES
            scheduled_at = datetime.combine(
                plan.plan_date, time(minute // 60, minute % 60), tzinfo=plan.timezone
            )
        answered = plan.entry_id is not None
        prompt_id = uuid.uuid4()
        inserted = connection.execute(
            """
            INSERT INTO prompt
                (id, activity_id, participant_id, plan_date, occurrence,
                 scheduled_at, sent_at, shown_at, opened_at, status, unplanned_reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::prompt_status, %s::unplanned_reason)
            ON CONFLICT (participant_id, activity_id, plan_date, occurrence) DO NOTHING
            RETURNING id
            """,
            (
                prompt_id,
                plan.activity.id,
                plan.participant_id,
                plan.plan_date,
                plan.occurrence,
                scheduled_at,
                scheduled_at,
                None if scheduled_at is None else scheduled_at + timedelta(seconds=15),
                scheduled_at + timedelta(seconds=30) if answered else None,
                "answered" if answered else ("expired" if scheduled_at else "unplanned"),
                None if scheduled_at is not None else "slot_cap",
            ),
        ).fetchone()
        if inserted is None:
            already_present += 1
            continue
        if scheduled_at is None:
            inserted_unplanned += 1
        elif answered:
            inserted_answered += 1
            linked += connection.execute(
                "UPDATE entry SET prompt_id = %s WHERE id = %s AND prompt_id IS NULL",
                (prompt_id, plan.entry_id),
            ).rowcount
        else:
            inserted_expired += 1

    start_bound = datetime.combine(
        context.first_day,
        time.min,
        tzinfo=_study_timezone(context.timezone_name, context.first_day),
    ).astimezone(UTC)
    end_bound = datetime.combine(
        context.last_day + timedelta(days=1),
        time.min,
        tzinfo=_study_timezone(context.timezone_name, context.last_day + timedelta(days=1)),
    ).astimezone(UTC)
    still_free = connection.execute(
        "SELECT count(*) AS count FROM entry "
        "WHERE participant_id = ANY(%s) AND prompt_id IS NULL AND activity_id IS NOT NULL "
        "AND recorded_at >= %s AND recorded_at < %s",
        (context.participants, start_bound, end_bound),
    ).fetchone()["count"]

    days = (context.last_day - context.first_day).days + 1
    print(f"History step: {days} past days, {len(context.participants)} participants")
    print(
        f"  prompts inserted: {inserted_answered + inserted_expired + inserted_unplanned} "
        f"({inserted_answered} answered, {inserted_expired} expired, "
        f"{inserted_unplanned} unplanned)"
    )
    print(f"  prompts already present: {already_present}")
    print(f"  entries linked to a prompt: {linked}")
    print(f"  past entries still free: {still_free}")


def _run_history(seed: int) -> int:
    url = _database_url()
    label = _database_label(url)
    print(f"Writing past prompts directly to the development database at {label}")
    try:
        with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as connection:
            _write_history(connection, seed)
    except psycopg.Error as exc:
        raise SeedError(f"Cannot write to the database at {label}: {exc}") from exc
    return 0


def _dev_logins_path() -> Path:
    if DEV_LOGINS_RELATIVE_PATH.parts[0] != "_private":
        raise SeedError("The logins file must stay inside _private.")
    return _repo_root() / DEV_LOGINS_RELATIVE_PATH


def _previous_logins(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    passwords: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("`")
        if len(parts) >= 5 and parts[0].strip() == "-" and parts[2].strip() == "/":
            passwords[parts[1]] = parts[3]
    return passwords


def _write_dev_logins(passwords: dict[str, str], admin_email: str) -> None:
    """Write the logins to the untracked file, keeping the passwords of existing accounts."""
    path = _dev_logins_path()
    previous = _previous_logins(path)
    lines = [
        "# Contas de teste do ambiente de desenvolvimento (só locais, dados de demonstração)",
        "",
        "Geradas por tools/demo-data/seed.py a "
        f"{_now_lisbon().date().isoformat()}. Não são contas reais.",
        "",
    ]
    for email, _role in RESEARCHERS:
        password = passwords.get(email) or previous.get(email)
        if password:
            lines.append(f"- `{email}` / `{password}`")
        else:
            lines.append(
                f"- `{email}` / (palavra-passe desconhecida: a conta já existia "
                "antes deste ficheiro)"
            )
    lines.append(f"- Admin do seed: {admin_email} (palavra-passe passada por stdin na corrida)")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Logins escritos em {path} (fora do Git)")


def _delete_studies(confirmed: bool) -> None:
    url = _database_url()
    label = _database_label(url)
    print(f"Looking for studies in the development database at {label}")
    try:
        with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as connection:
            titles = [
                row["title"]
                for row in connection.execute("SELECT title FROM study ORDER BY title, id")
            ]
            if not titles:
                print("  no studies to delete")
                return
            print(f"Studies to delete ({len(titles)}):")
            for title in titles:
                print(f"  - {title}")
            if not confirmed:
                raise SeedError("Refusing to delete studies: pass --yes to confirm.")
            deleted = connection.execute("DELETE FROM study").rowcount
            print(f"  deleted {deleted} studies")
    except psycopg.Error as exc:
        raise SeedError(f"Cannot delete studies at {label}: {exc}") from exc


def _plan_today() -> None:
    """Plan today through the scheduler's own service, in its container.

    The service has no HTTP trigger, and the leader only plans on startup, at the planning
    hour or when an availability fingerprint changes. Calling ``plan_study`` directly avoids
    waiting for one of those moments.
    """
    today = _now_lisbon().date().isoformat()
    output = _compose_exec(
        "import sys\n"
        "from datetime import UTC, date, datetime\n"
        "from scheduler import db\n"
        "from scheduler.service import SchedulerService\n"
        "from scheduler.settings import Settings\n"
        "service = SchedulerService(Settings())\n"
        "with db.connect(service.settings) as connection:\n"
        "    row = connection.execute(\n"
        "        'SELECT id FROM study WHERE title = %s ORDER BY starts_on DESC, id LIMIT 1',\n"
        "        (sys.argv[1],),\n"
        "    ).fetchone()\n"
        "    if row is None:\n"
        "        raise SystemExit('study not found')\n"
        "    plan = service.plan_study(\n"
        "        connection, row[0], date.fromisoformat(sys.argv[2]), datetime.now(UTC)\n"
        "    )\n"
        "print('no plan' if plan is None else (\n"
        "    f'planned={plan.planned_count} unplanned={plan.unplanned_count}'\n"
        "))\n",
        STUDY_TITLE,
        today,
        service="scheduler",
    )
    print(f"  scheduler: {output}")


def _run_seed(arguments: argparse.Namespace, password: str, dashboard_url: str) -> int:
    api = Api(arguments.base_url)
    api.admin_email = arguments.admin_email.strip().lower()
    api.admin_password = password
    try:
        print(f"Signing in to {api.base_url} as {api.admin_email}")
        api.login_admin()

        existing = _find_study(api)
        if existing is not None:
            _print_existing(api, existing, dashboard_url)
            _write_dev_logins({}, api.admin_email)
            return 0

        print("Creating the researcher accounts")
        passwords = _account_passwords(api)

        starts_on, ends_on = _study_dates(arguments.end_in_days)
        print(f"Creating the study ({starts_on.isoformat()} to {ends_on.isoformat()})")
        study_id = _create_study(api, starts_on.isoformat(), ends_on.isoformat(), passwords)
        questions = _create_questions(api, study_id)
        activity_ids = _create_activities(api, study_id)
        api.admin("POST", f"/studies/{study_id}/start", json={})
        print(f"  study {study_id} is running")

        personal_count = arguments.participants - 1
        joined_count = max(0, personal_count - 1)
        print(f"Creating {personal_count} participants with personal codes")
        created: list[tuple[dict[str, Any], str, int]] = []
        for index in range(personal_count):
            record = _personal_code(api, study_id, index)
            created.append((record, record["invite_code"]["code"], index))

        print(f"Joining {joined_count} participants as phones")
        joined = _join_participants(
            api, created[:joined_count], questions, random.Random(arguments.seed)
        )
        rng = random.Random(arguments.seed + 1)
        _declined_participant(api, study_id, questions, rng, ends_on.isoformat())

        last_entry_day = _now_lisbon().date()
        print(f"Submitting entries from {starts_on.isoformat()} to {last_entry_day.isoformat()}")
        _seed_entries(api, joined, activity_ids, starts_on, last_entry_day, arguments.seed)
        _restore_free_entry_limits(api, study_id, activity_ids)

        print("Waiting for the media worker")
        entries = _wait_for_media(api, study_id)

        print("Finishing the demonstration states")
        _finish_participants(api, study_id, joined)

        entries = _list_entries(api, study_id)
        _print_summary(api, study_id, entries, passwords, dashboard_url)
        _write_dev_logins(passwords, api.admin_email)
        return 0
    finally:
        api.close()


def _run_reset(arguments: argparse.Namespace, password: str, dashboard_url: str) -> int:
    _delete_studies(arguments.yes)
    status = _run_seed(arguments, password, dashboard_url)
    if status != 0:
        return status
    _run_history(arguments.seed)
    print("Asking the scheduler to plan today")
    _plan_today()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fill a running Fieldnote stack with the demonstration study."
    )
    parser.add_argument(
        "step",
        nargs="?",
        choices=("seed", "history", "reset"),
        default="seed",
        help="seed (default) fills the stack through the API; history writes past prompts "
        "directly to the development database; reset deletes every study, seeds, fills the "
        "past and plans today",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--admin-email")
    parser.add_argument("--admin-password-stdin", action="store_true")
    parser.add_argument(
        "--end-in-days",
        type=int,
        default=DEMO_END_IN_DAYS,
        help="days from today to the end of the study (default: %(default)s)",
    )
    parser.add_argument("--participants", type=int, default=22)
    parser.add_argument("--seed", type=int, default=20261006)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="confirm that reset may delete every study in the development database",
    )
    arguments = parser.parse_args(argv)

    if arguments.step == "history":
        try:
            return _run_history(arguments.seed)
        except SeedError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1

    if not arguments.admin_email:
        parser.error(f"--admin-email is required for the {arguments.step} step")
    if arguments.end_in_days < 0:
        parser.error("--end-in-days must not be negative")
    if arguments.participants < 4:
        parser.error("--participants must be at least 4")

    if arguments.admin_password_stdin:
        password = sys.stdin.readline().rstrip("\r\n")
    else:
        password = getpass.getpass("Administrator password: ")
    if not password:
        print("ERROR: the administrator password is empty.", file=sys.stderr)
        return 2

    dashboard_url = _normalise_base_url(
        os.environ.get("FIELDNOTE_DASHBOARD_URL", "http://127.0.0.1:5173")
    )

    try:
        if arguments.step == "reset":
            return _run_reset(arguments, password, dashboard_url)
        return _run_seed(arguments, password, dashboard_url)
    except (ApiError, SeedError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
