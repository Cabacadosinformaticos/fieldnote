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

// A study can open more than one prompt for the same activity, so the prompt is the identity of
// a cached row and the activity is only a lookup key.
const CREATE_PROMPT_CACHE = `
  CREATE TABLE IF NOT EXISTS prompt_activities (
    prompt_id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL,
    study_id TEXT NOT NULL,
    closes_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    cached_at TEXT NOT NULL
  );
`;

const CREATE_PROMPT_CACHE_INDEXES = `
  CREATE INDEX IF NOT EXISTS prompt_activities_study
    ON prompt_activities (study_id);
  CREATE INDEX IF NOT EXISTS prompt_activities_activity
    ON prompt_activities (activity_id);
`;

// Old installs keyed the cache by activity, which drops the second prompt of the same activity.
const MIGRATED_PROMPT_CACHE = `
  CREATE TABLE prompt_activities_migrated (
    prompt_id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL,
    study_id TEXT NOT NULL,
    closes_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    cached_at TEXT NOT NULL
  );
`;

async function migratePromptCache(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string; pk: number }>(
    'PRAGMA table_info(prompt_activities)',
  );
  if (columns.length === 0) {
    return;
  }

  const promptColumn = columns.find((column) => column.name === 'prompt_id');
  if (promptColumn?.pk === 1) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATED_PROMPT_CACHE);
    await db.execAsync(`
      INSERT OR REPLACE INTO prompt_activities_migrated
        (prompt_id, activity_id, study_id, closes_at, payload, cached_at)
      SELECT prompt_id, activity_id, study_id, closes_at, payload, cached_at
        FROM prompt_activities
    `);
    await db.execAsync('DROP TABLE prompt_activities');
    await db.execAsync(
      'ALTER TABLE prompt_activities_migrated RENAME TO prompt_activities',
    );
  });
}

// Free-entry activities have no prompt, so they cannot share the prompt cache, whose prompt_id
// is unique and mandatory.
const CREATE_FREE_CACHE = `
  CREATE TABLE IF NOT EXISTS free_entry_activities (
    activity_id TEXT PRIMARY KEY NOT NULL,
    study_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    cached_at TEXT NOT NULL
  );
`;

const CREATE_FREE_CACHE_INDEX = `
  CREATE INDEX IF NOT EXISTS free_entry_activities_study
    ON free_entry_activities (study_id);
`;

// The shown and opened times of a prompt wait here when the API cannot be reached (FR-19).
// One row per prompt: the first value of each field wins, like on the server.
const CREATE_PROMPT_EVENTS = `
  CREATE TABLE IF NOT EXISTS prompt_events (
    prompt_id TEXT PRIMARY KEY NOT NULL,
    study_id TEXT NOT NULL,
    shown_at TEXT,
    opened_at TEXT,
    created_at TEXT NOT NULL
  );
`;

const CREATE_PROMPT_EVENTS_INDEX = `
  CREATE INDEX IF NOT EXISTS prompt_events_study
    ON prompt_events (study_id);
`;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function queueDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(CREATE_OUTBOX);
      await db.execAsync(CREATE_OUTBOX_INDEXES);
      await db.execAsync(CREATE_PROMPT_CACHE);
      await migratePromptCache(db);
      await db.execAsync(CREATE_PROMPT_CACHE_INDEXES);
      await db.execAsync(CREATE_FREE_CACHE);
      await db.execAsync(CREATE_FREE_CACHE_INDEX);
      await db.execAsync(CREATE_PROMPT_EVENTS);
      await db.execAsync(CREATE_PROMPT_EVENTS_INDEX);
      return db;
    })();
  }

  return databasePromise;
}
