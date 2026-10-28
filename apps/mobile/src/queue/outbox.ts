import { queueDatabase } from './database';
import type {
  CaptureType,
  EntryPayload,
  MediaAttachment,
  NewOutboxEntry,
  OutboxEntry,
  OutboxState,
} from './types';

type OutboxRow = {
  id: string;
  study_id: string;
  activity_id: string;
  activity_title: string;
  prompt_id: string | null;
  entry_type: CaptureType;
  recorded_at: string;
  payload: string;
  media: string;
  content_sha256: string;
  state: OutboxState;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  sent_at: string | null;
  server_received_at: string | null;
};

const listeners = new Set<() => void>();

/** Tells every mounted screen that the outbox changed. */
export function notifyOutbox(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toEntry(row: OutboxRow): OutboxEntry {
  return {
    id: row.id,
    studyId: row.study_id,
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    promptId: row.prompt_id,
    entryType: row.entry_type,
    recordedAt: row.recorded_at,
    payload: JSON.parse(row.payload) as EntryPayload,
    media: JSON.parse(row.media) as MediaAttachment[],
    contentSha256: row.content_sha256,
    state: row.state,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    serverReceivedAt: row.server_received_at,
  };
}

export async function insertOutboxEntry(entry: NewOutboxEntry): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    `INSERT INTO outbox
       (id, study_id, activity_id, activity_title, prompt_id, entry_type, recorded_at,
        payload, media, content_sha256, state, attempts, last_error, next_attempt_at,
        created_at, sent_at, server_received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, NULL, ?, ?, NULL, NULL)`,
    [
      entry.id,
      entry.studyId,
      entry.activityId,
      entry.activityTitle,
      entry.promptId,
      entry.entryType,
      entry.recordedAt,
      JSON.stringify(entry.payload),
      JSON.stringify(entry.media),
      entry.contentSha256,
      entry.createdAt,
      entry.createdAt,
    ],
  );
  notifyOutbox();
}

export async function listOutboxEntries(): Promise<OutboxEntry[]> {
  const db = await queueDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    'SELECT * FROM outbox ORDER BY recorded_at DESC',
  );
  return rows.map(toEntry);
}

export async function getOutboxEntry(id: string): Promise<OutboxEntry | null> {
  const db = await queueDatabase();
  const row = await db.getFirstAsync<OutboxRow>(
    'SELECT * FROM outbox WHERE id = ?',
    [id],
  );
  return row ? toEntry(row) : null;
}

export async function listPendingEntries(includeBackoff: boolean): Promise<OutboxEntry[]> {
  const db = await queueDatabase();
  const now = new Date().toISOString();
  const rows = includeBackoff
    ? await db.getAllAsync<OutboxRow>(
        `SELECT * FROM outbox
         WHERE state = 'queued'
         ORDER BY created_at ASC`,
      )
    : await db.getAllAsync<OutboxRow>(
        `SELECT * FROM outbox
         WHERE state = 'queued' AND next_attempt_at <= ?
         ORDER BY created_at ASC`,
        [now],
      );
  return rows.map(toEntry);
}

export async function resetInterruptedEntries(): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    "UPDATE outbox SET state = 'queued' WHERE state = 'sending'",
  );
}

export async function markEntrySending(id: string): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    "UPDATE outbox SET state = 'sending', attempts = attempts + 1 WHERE id = ?",
    [id],
  );
}

export async function markEntrySent(id: string, serverReceivedAt: string): Promise<void> {
  const db = await queueDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE outbox
     SET state = 'sent', sent_at = ?, server_received_at = ?, last_error = NULL
     WHERE id = ?`,
    [now, serverReceivedAt, id],
  );
  notifyOutbox();
}

export async function markEntryRetry(
  id: string,
  error: string,
  nextAttemptAt: string,
): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    `UPDATE outbox
     SET state = 'queued', last_error = ?, next_attempt_at = ?
     WHERE id = ?`,
    [error, nextAttemptAt, id],
  );
  notifyOutbox();
}

export async function markEntryFailed(id: string, error: string): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    "UPDATE outbox SET state = 'failed', last_error = ? WHERE id = ?",
    [error, id],
  );
  notifyOutbox();
}

export async function updateEntryMedia(
  id: string,
  media: MediaAttachment[],
): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync('UPDATE outbox SET media = ? WHERE id = ?', [
    JSON.stringify(media),
    id,
  ]);
}

export async function listAnsweredPromptIds(): Promise<Set<string>> {
  const db = await queueDatabase();
  const rows = await db.getAllAsync<{ prompt_id: string }>(
    'SELECT DISTINCT prompt_id FROM outbox WHERE prompt_id IS NOT NULL',
  );
  return new Set(rows.map((row) => row.prompt_id));
}
