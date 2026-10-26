import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type { components } from '@/api/schema';

export type ParticipationStatus = components['schemas']['ParticipantStatus'];

export type Participation = {
  studyId: string;
  title: string;
  status: ParticipationStatus;
  alias: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timezone: string | null;
  updatedAt: string;
};

export type ParticipationInput = Omit<Participation, 'updatedAt'>;

const DATABASE_NAME = 'fieldnote-participations.db';
const TOKEN_PREFIX = 'fieldnote.device.';

// Tokens live in the system keystore, the cached study card in SQLite. SQLite is already part of
// the agreed mobile stack and gives a durable list without adding another dependency.
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS participations (
    study_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    alias TEXT,
    starts_on TEXT,
    ends_on TEXT,
    timezone TEXT,
    updated_at TEXT NOT NULL
  );
`;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(CREATE_TABLE);
      return db;
    })();
  }

  return databasePromise;
}

type ParticipationRow = {
  study_id: string;
  title: string;
  status: ParticipationStatus;
  alias: string | null;
  starts_on: string | null;
  ends_on: string | null;
  timezone: string | null;
  updated_at: string;
};

function toParticipation(row: ParticipationRow): Participation {
  return {
    studyId: row.study_id,
    title: row.title,
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
       (study_id, title, status, alias, starts_on, ends_on, timezone, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(study_id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       alias = excluded.alias,
       starts_on = excluded.starts_on,
       ends_on = excluded.ends_on,
       timezone = excluded.timezone,
       updated_at = excluded.updated_at`,
    [
      input.studyId,
      input.title,
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
