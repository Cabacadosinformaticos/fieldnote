import { deviceClientForStudy } from '@/api/client';

import { queueDatabase } from './database';

/**
 * The shown and opened times of a prompt, kept locally until the API accepts them (FR-19).
 *
 * A report can be made without a network, and the participant must never see an error for it.
 * The API keeps the first value of each field, so a resend after a failed flush is harmless.
 */
type PromptEventRow = {
  prompt_id: string;
  study_id: string;
  shown_at: string | null;
  opened_at: string | null;
};

// A prompt is reported as shown or opened only once per session. The row is deleted after the
// API accepts it, so without this set every refresh of Today would send the same event again.
const shownReported = new Set<string>();
const openedReported = new Set<string>();

/**
 * One row per prompt. The upsert keeps the first local value of each field, so a refresh of
 * Today or a second open cannot move the time that is waiting to be sent.
 */
async function upsertPromptEvent(
  studyId: string,
  promptId: string,
  shownAt: string | null,
  openedAt: string | null,
): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    `INSERT INTO prompt_events
       (prompt_id, study_id, shown_at, opened_at, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(prompt_id) DO UPDATE SET
       shown_at = COALESCE(prompt_events.shown_at, excluded.shown_at),
       opened_at = COALESCE(prompt_events.opened_at, excluded.opened_at)`,
    [promptId, studyId, shownAt, openedAt, new Date().toISOString()],
  );
}

export async function recordPromptShown(
  studyId: string,
  promptId: string,
  at = new Date(),
): Promise<void> {
  if (shownReported.has(promptId)) {
    return;
  }
  shownReported.add(promptId);
  try {
    await upsertPromptEvent(studyId, promptId, at.toISOString(), null);
  } catch (error) {
    shownReported.delete(promptId);
    throw error;
  }
}

export async function recordPromptOpened(
  studyId: string,
  promptId: string,
  at = new Date(),
): Promise<void> {
  if (openedReported.has(promptId)) {
    return;
  }
  openedReported.add(promptId);
  try {
    await upsertPromptEvent(studyId, promptId, null, at.toISOString());
  } catch (error) {
    openedReported.delete(promptId);
    throw error;
  }
}

export async function listPendingPromptEvents(): Promise<
  {
    promptId: string;
    studyId: string;
    shownAt: string | null;
    openedAt: string | null;
  }[]
> {
  const db = await queueDatabase();
  const rows = await db.getAllAsync<PromptEventRow>(
    'SELECT * FROM prompt_events ORDER BY created_at ASC',
  );
  return rows.map((row) => ({
    promptId: row.prompt_id,
    studyId: row.study_id,
    shownAt: row.shown_at,
    openedAt: row.opened_at,
  }));
}

/**
 * Clears the row only if it still holds exactly what was accepted. A field recorded while the
 * request was in flight keeps the row, so the next flush sends it instead of dropping it.
 */
async function deletePromptEvent(
  promptId: string,
  shownAt: string | null,
  openedAt: string | null,
): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync(
    `DELETE FROM prompt_events
       WHERE prompt_id = ? AND shown_at IS ? AND opened_at IS ?`,
    [promptId, shownAt, openedAt],
  );
}

/** Drops the events of a study, so an erasure does not leave prompt metadata on the phone. */
export async function clearStudyPromptEvents(studyId: string): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync('DELETE FROM prompt_events WHERE study_id = ?', [studyId]);
}

function isPermanent(status: number | undefined): boolean {
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

/**
 * Sends every queued event, called by the outbox flush. A 204 or a 404 (the prompt is gone)
 * clears the row; a network error keeps it for the next flush. Nothing is ever surfaced to the
 * participant and the flush of entries is not delayed by a failure here.
 */
export async function sendPendingPromptEvents(): Promise<void> {
  const events = await listPendingPromptEvents().catch(() => []);
  for (const event of events) {
    const client = await deviceClientForStudy(event.studyId).catch(() => null);
    if (!client) {
      continue;
    }

    let status: number | undefined;
    try {
      const result = await client.POST(
        '/api/v1/participation/me/prompts/{prompt_id}/events',
        {
          params: { path: { prompt_id: event.promptId } },
          body: {
            shown_at: event.shownAt ?? undefined,
            opened_at: event.openedAt ?? undefined,
          },
        },
      );
      status = result.response?.status;
    } catch {
      continue;
    }

    if (status === 204 || status === 404 || isPermanent(status)) {
      await deletePromptEvent(
        event.promptId,
        event.shownAt,
        event.openedAt,
      ).catch(() => undefined);
    }
  }
}
