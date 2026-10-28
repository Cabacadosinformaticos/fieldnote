import { deviceClientForStudy } from '@/api/client';
import type { Participation } from '@/state/participations';
import { listParticipations } from '@/state/participations';

import { listAnsweredPromptIds } from './outbox';
import {
  getCachedActivity,
  getCachedActivityByPrompt,
  listCachedPromptActivities,
  replaceCachedPrompts,
} from './promptCache';
import type {
  CaptureType,
  PromptActivity,
  ScaleConfig,
  ScaleType,
  WarningId,
} from './types';

type PromptSource = {
  id: string;
  activity_id: string;
  title: string;
  instructions: string | null;
  entry_types: string[];
  options: Record<string, unknown> | null;
  expected_minutes: number;
  capture_location: boolean;
  scheduled_at: string | null;
  sent_at: string | null;
  closes_at: string;
};

const CAPTURE_TYPES: CaptureType[] = ['text', 'photo', 'video', 'audio', 'scale'];
const SCALE_TYPES: ScaleType[] = ['numbers', 'faces', 'text', 'slider'];

function captureTypeOf(value: string): CaptureType | null {
  return CAPTURE_TYPES.includes(value as CaptureType) ? (value as CaptureType) : null;
}

function scaleTypeOf(value: unknown): ScaleType | null {
  return typeof value === 'string' && SCALE_TYPES.includes(value as ScaleType)
    ? (value as ScaleType)
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function pointCount(value: unknown, type: ScaleType): number | null {
  if (type === 'slider') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(11, Math.max(2, Math.trunc(value)));
  }
  return type === 'faces' ? 5 : 7;
}

export function scaleConfigOf(options: Record<string, unknown> | null): ScaleConfig | null {
  if (!options) {
    return null;
  }
  const type = scaleTypeOf(options.scale_type);
  if (!type) {
    return null;
  }
  return {
    type,
    points: pointCount(options.points, type),
    startLabel: textValue(options.start_label),
    middleLabel: textValue(options.middle_label),
    endLabel: textValue(options.end_label),
  };
}

export function activityFromPrompt(
  prompt: PromptSource,
  participation: Participation,
): PromptActivity {
  const captureTypes: CaptureType[] = [];
  for (const value of prompt.entry_types) {
    const type = captureTypeOf(value);
    if (type && !captureTypes.includes(type)) {
      captureTypes.push(type);
    }
  }

  const scale = scaleConfigOf(prompt.options);
  const supported = captureTypes.filter((type) => type !== 'scale' || scale !== null);
  const warnings: WarningId[] = [];

  if (supported.some((type) => type === 'photo' || type === 'video' || type === 'audio')) {
    warnings.push('privacy');
  }
  warnings.push(prompt.capture_location ? 'locationOn' : 'locationOff');

  return {
    id: prompt.activity_id,
    promptId: prompt.id,
    studyId: participation.studyId,
    studyTitle: participation.title,
    title: prompt.title,
    instructions: prompt.instructions?.trim() ?? '',
    captureTypes: supported,
    warnings,
    expectedMinutes: prompt.expected_minutes,
    captureLocation: prompt.capture_location,
    scale,
    scheduledAt: prompt.scheduled_at,
    sentAt: prompt.sent_at,
    closesAt: prompt.closes_at,
  };
}

type PromptResult = {
  ok: boolean;
  activities: PromptActivity[];
};

async function fetchForParticipation(
  participation: Participation,
): Promise<PromptResult> {
  if (participation.status !== 'active') {
    return { ok: true, activities: [] };
  }

  const client = await deviceClientForStudy(participation.studyId).catch(
    () => null,
  );
  if (!client) {
    return { ok: false, activities: [] };
  }

  try {
    const { data } = await client.GET('/api/v1/participation/me/prompts');
    if (!data) {
      return { ok: false, activities: [] };
    }

    const activities = data.prompts.map((prompt) =>
      activityFromPrompt(prompt, participation),
    );
    await replaceCachedPrompts(participation.studyId, activities);
    return { ok: true, activities };
  } catch {
    return { ok: false, activities: [] };
  }
}

export type TodayPrompts = {
  activities: PromptActivity[];
  participations: Participation[];
  offline: boolean;
};

/**
 * Fetches the open prompts of every active participation, then falls back to the last copy
 * saved on the phone for studies whose request failed. A prompt with an outbox entry is not
 * shown again, even if it has not reached the server yet.
 */
export async function loadTodayPrompts(): Promise<TodayPrompts> {
  const participations = await listParticipations();
  const active = participations.filter(
    (participation) => participation.status === 'active',
  );
  const results = await Promise.all(active.map(fetchForParticipation));
  const offline = results.some((result) => !result.ok);
  const activeStudyIds = new Set(active.map((participation) => participation.studyId));

  const byPrompt = new Map<string, PromptActivity>();
  for (const activity of results.flatMap((result) => result.activities)) {
    byPrompt.set(activity.promptId, activity);
  }

  if (offline) {
    const cached = await listCachedPromptActivities();
    for (const activity of cached) {
      if (
        activeStudyIds.has(activity.studyId) &&
        !byPrompt.has(activity.promptId)
      ) {
        byPrompt.set(activity.promptId, activity);
      }
    }
  }

  const answered = await listAnsweredPromptIds();
  const activities = [...byPrompt.values()]
    .filter((activity) => !answered.has(activity.promptId))
    .sort((left, right) => left.closesAt.localeCompare(right.closesAt));

  return { activities, participations, offline };
}

export async function cachedActivity(
  activityId: string | undefined,
): Promise<PromptActivity | null> {
  return getCachedActivity(activityId);
}

export async function cachedActivityForPrompt(
  promptId: string,
): Promise<PromptActivity | null> {
  return getCachedActivityByPrompt(promptId);
}

/** Used when a notification arrives before this session refreshed the prompt cache. */
export async function refreshPromptCache(): Promise<void> {
  await loadTodayPrompts();
}
