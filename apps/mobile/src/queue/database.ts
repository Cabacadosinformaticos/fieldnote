import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'fieldnote-queue.db';

const CREATE_OUTBOX = `
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY NOT NULL,
    study_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    activity_title TEXT NOT NULL,
    prompt_id TEXT,
    entry_type TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    media TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    server_received_at TEXT
  );
`;

const CREATE_OUTBOX_INDEXES = `
  CREATE INDEX IF NOT EXISTS outbox_state_next_attempt
    ON outbox (state, next_attempt_at);
  CREATE INDEX IF NOT EXISTS outbox_prompt
    ON outbox (prompt_id);
`;

const CREATE_PROMPT_CACHE = `
  CREATE TABLE IF NOT EXISTS prompt_activities (
    activity_id TEXT PRIMARY KEY NOT NULL,
    prompt_id TEXT UNIQUE NOT NULL,
    study_id TEXT NOT NULL,
    closes_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    cached_at TEXT NOT NULL
  );
`;

const CREATE_PROMPT_CACHE_INDEX = `
  CREATE INDEX IF NOT EXISTS prompt_activities_study
    ON prompt_activities (study_id);
`;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function queueDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(CREATE_OUTBOX);
      await db.execAsync(CREATE_OUTBOX_INDEXES);
      await db.execAsync(CREATE_PROMPT_CACHE);
      await db.execAsync(CREATE_PROMPT_CACHE_INDEX);
      return db;
    })();
  }

  return databasePromise;
}
