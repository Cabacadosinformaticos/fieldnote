import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type { components } from '@/api/schema';

export type ParticipationStatus = components['schemas']['ParticipantStatus'];

export type Participation = {
  studyId: string;
  title: string;
  description: string | null;
  team: string[];
  maxPromptsPerDay: number | null;
  status: ParticipationStatus;
  alias: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timezone: string | null;
  updatedAt: string;
};

/** Older callers keep the fields they do not know; the stored value is preserved. */
export type ParticipationInput = Omit<
  Participation,
  'updatedAt' | 'description' | 'team' | 'maxPromptsPerDay'
> & {
  description?: string | null;
  team?: string[] | null;
  maxPromptsPerDay?: number | null;
};

const DATABASE_NAME = 'fieldnote-participations.db';
const TOKEN_PREFIX = 'fieldnote.device.';

// Tokens live in the system keystore, the cached study card in SQLite. SQLite is already part of
// the agreed mobile stack and gives a durable list without adding another dependency.
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS participations (
    study_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    team TEXT,
    max_prompts_per_day INTEGER,
    status TEXT NOT NULL,
    alias TEXT,
    starts_on TEXT,
    ends_on TEXT,
    timezone TEXT,
    updated_at TEXT NOT NULL
  );
`;

const ADDED_COLUMNS: { name: string; definition: string }[] = [
  { name: 'description', definition: 'TEXT' },
  { name: 'team', definition: 'TEXT' },
  { name: 'max_prompts_per_day', definition: 'INTEGER' },
];

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(participations)',
  );
  const present = new Set(columns.map((column) => column.name));

  for (const column of ADDED_COLUMNS) {
    if (!present.has(column.name)) {
      await db.execAsync(
        `ALTER TABLE participations ADD COLUMN ${column.name} ${column.definition}`,
      );
    }
  }
}

function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(CREATE_TABLE);
      await ensureColumns(db);
      return db;
    })();
  }

  return databasePromise;
}

type ParticipationRow = {
  study_id: string;
  title: string;
  description: string | null;
  team: string | null;
  max_prompts_per_day: number | null;
  status: ParticipationStatus;
  alias: string | null;
  starts_on: string | null;
  ends_on: string | null;
  timezone: string | null;
  updated_at: string;
};

function parseTeam(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toParticipation(row: ParticipationRow): Participation {
  return {
    studyId: row.study_id,
    title: row.title,
    description: row.description,
    team: parseTeam(row.team),
    maxPromptsPerDay: row.max_prompts_per_day,
    status: row.status,
    alias: row.alias,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    timezone: row.timezone,
    updatedAt: row.updated_at,
  };
}

export function deviceTokenKey(studyId: string): string {
  return `${TOKEN_PREFIX}${studyId}`;
}

export async function saveDeviceToken(studyId: string, deviceToken: string): Promise<void> {
  await SecureStore.setItemAsync(deviceTokenKey(studyId), deviceToken);
}

export async function getDeviceToken(studyId: string): Promise<string | null> {
  return SecureStore.getItemAsync(deviceTokenKey(studyId));
}

export async function saveParticipation(input: ParticipationInput): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO participations
       (study_id, title, description, team, max_prompts_per_day, status, alias,
        starts_on, ends_on, timezone, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(study_id) DO UPDATE SET
       title = excluded.title,
       description = COALESCE(excluded.description, participations.description),
       team = COALESCE(excluded.team, participations.team),
       max_prompts_per_day = COALESCE(
         excluded.max_prompts_per_day,
         participations.max_prompts_per_day
       ),
       status = excluded.status,
       alias = excluded.alias,
       starts_on = excluded.starts_on,
       ends_on = excluded.ends_on,
       timezone = excluded.timezone,
       updated_at = excluded.updated_at`,
    [
      input.studyId,
      input.title,
      input.description ?? null,
      input.team ? JSON.stringify(input.team) : null,
      input.maxPromptsPerDay ?? null,
      input.status,
      input.alias,
      input.startsOn,
      input.endsOn,
      input.timezone,
      new Date().toISOString(),
    ],
  );
}

export async function updateParticipationStatus(
  studyId: string,
  status: ParticipationStatus,
  alias: string | null,
): Promise<void> {
  const db = await database();
  await db.runAsync(
    `UPDATE participations
       SET status = ?, alias = ?, updated_at = ?
     WHERE study_id = ?`,
    [status, alias, new Date().toISOString(), studyId],
  );
}

export async function listParticipations(): Promise<Participation[]> {
  const db = await database();
  const rows = await db.getAllAsync<ParticipationRow>(
    'SELECT * FROM participations ORDER BY updated_at DESC',
  );

  return rows.map(toParticipation);
}

export async function getParticipation(studyId: string): Promise<Participation | null> {
  const db = await database();
  const row = await db.getFirstAsync<ParticipationRow>(
    'SELECT * FROM participations WHERE study_id = ?',
    studyId,
  );

  return row ? toParticipation(row) : null;
}
