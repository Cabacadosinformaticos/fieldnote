import { queueDatabase } from './database';
import type { PromptActivity } from './types';

type PromptRow = {
  payload: string;
};

let pendingWrite: Promise<void> = Promise.resolve();

export function replaceCachedPrompts(
  studyId: string,
  activities: PromptActivity[],
): Promise<void> {
  const write = pendingWrite.then(async () => {
    const db = await queueDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM prompt_activities WHERE study_id = ?', [studyId]);
      for (const activity of activities) {
        await db.runAsync(
          `INSERT INTO prompt_activities
             (activity_id, prompt_id, study_id, closes_at, payload, cached_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            activity.id,
            activity.promptId,
            activity.studyId,
            activity.closesAt,
            JSON.stringify(activity),
            new Date().toISOString(),
          ],
        );
      }
    });
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}

export async function listCachedPromptActivities(): Promise<PromptActivity[]> {
  const db = await queueDatabase();
  const rows = await db.getAllAsync<PromptRow>(
    'SELECT payload FROM prompt_activities ORDER BY closes_at ASC',
  );
  return rows.map((row) => JSON.parse(row.payload) as PromptActivity);
}

export async function getCachedActivity(
  activityId: string | undefined,
): Promise<PromptActivity | null> {
  if (!activityId) {
    return null;
  }
  const db = await queueDatabase();
  const row = await db.getFirstAsync<PromptRow>(
    'SELECT payload FROM prompt_activities WHERE activity_id = ?',
    [activityId],
  );
  return row ? (JSON.parse(row.payload) as PromptActivity) : null;
}

export async function getCachedActivityByPrompt(
  promptId: string,
): Promise<PromptActivity | null> {
  const db = await queueDatabase();
  const row = await db.getFirstAsync<PromptRow>(
    'SELECT payload FROM prompt_activities WHERE prompt_id = ?',
    [promptId],
  );
  return row ? (JSON.parse(row.payload) as PromptActivity) : null;
}
