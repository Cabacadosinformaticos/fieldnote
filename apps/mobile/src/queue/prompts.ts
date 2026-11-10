import { deviceClientForStudy } from '@/api/client';
import type { Participation } from '@/state/participations';
import { listParticipations, setTodayFreeEntryDisplay } from '@/state/participations';

import { listAnsweredPromptIds } from './outbox';
import {
  cacheFreeActivity,
  clearCachedFreeActivity,
  getCachedActivity,
  getCachedActivityByPrompt,
  getCachedFreeActivity,
  listCachedFreeActivities,
  listCachedPromptActivities,
  replaceCachedFreeActivities,
  replaceCachedPrompts,
} from './promptCache';
import type {
  CaptureType,
  FreeEntryActivity,
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

function supportedCaptureTypes(
  entryTypes: string[],
  scale: ScaleConfig | null,
): CaptureType[] {
  const captureTypes: CaptureType[] = [];
  for (const value of entryTypes) {
    const type = captureTypeOf(value);
    if (type && !captureTypes.includes(type)) {
      captureTypes.push(type);
    }
  }

  return captureTypes.filter((type) => type !== 'scale' || scale !== null);
}

function warningsOf(captureTypes: CaptureType[], captureLocation: boolean): WarningId[] {
  const warnings: WarningId[] = [];

  if (captureTypes.some((type) => type === 'photo' || type === 'video' || type === 'audio')) {
    warnings.push('privacy');
  }
  warnings.push(captureLocation ? 'locationOn' : 'locationOff');

  return warnings;
}

export function activityFromPrompt(
  prompt: PromptSource,
  participation: Participation,
): PromptActivity {
  const scale = scaleConfigOf(prompt.options);
  const captureTypes = supportedCaptureTypes(prompt.entry_types, scale);

  return {
    id: prompt.activity_id,
    promptId: prompt.id,
    studyId: participation.studyId,
    studyTitle: participation.title,
    title: prompt.title,
    instructions: prompt.instructions?.trim() ?? '',
    captureTypes,
    warnings: warningsOf(captureTypes, prompt.capture_location),
    expectedMinutes: prompt.expected_minutes,
    captureLocation: prompt.capture_location,
    scale,
    scheduledAt: prompt.scheduled_at,
    sentAt: prompt.sent_at,
    closesAt: prompt.closes_at,
  };
}

type FreeEntrySource = {
  id: string;
  title: string;
  instructions: string | null;
  entry_types: string[];
  options: Record<string, unknown> | null;
  capture_location: boolean;
  max_free_entries_per_day: number | null;
  free_entries_used_today: number;
};

export function activityFromFreeEntry(
  activity: FreeEntrySource,
  participation: Participation,
): FreeEntryActivity {
  const scale = scaleConfigOf(activity.options);
  const captureTypes = supportedCaptureTypes(activity.entry_types, scale);

  return {
    id: activity.id,
    studyId: participation.studyId,
    studyTitle: participation.title,
    title: activity.title,
    instructions: activity.instructions?.trim() ?? '',
    captureTypes,
    warnings: warningsOf(captureTypes, activity.capture_location),
    captureLocation: activity.capture_location,
    scale,
    maxFreeEntriesPerDay: activity.max_free_entries_per_day,
    freeEntriesUsedToday: activity.free_entries_used_today,
  };
}

export function promptActivityOf(free: FreeEntryActivity): PromptActivity {
  return {
    id: free.id,
    promptId: null,
    studyId: free.studyId,
    studyTitle: free.studyTitle,
    title: free.title,
    instructions: free.instructions,
    captureTypes: free.captureTypes,
    warnings: free.warnings,
    expectedMinutes: 0,
    captureLocation: free.captureLocation,
    scale: free.scale,
    scheduledAt: null,
    sentAt: null,
    closesAt: '',
  };
}

type ParticipationResult = {
  ok: boolean;
  activities: PromptActivity[];
  freeActivities: FreeEntryActivity[];
};

async function fetchForParticipation(
  participation: Participation,
): Promise<ParticipationResult> {
  if (participation.status !== 'active') {
    return { ok: true, activities: [], freeActivities: [] };
  }

  const client = await deviceClientForStudy(participation.studyId).catch(
    () => null,
  );
  if (!client) {
    return { ok: false, activities: [], freeActivities: [] };
  }

  let ok = true;
  let activities: PromptActivity[] = [];
  let freeActivities: FreeEntryActivity[] = [];

  try {
    const { data } = await client.GET('/api/v1/participation/me/prompts');
    if (!data) {
      ok = false;
    } else {
      activities = data.prompts.map((prompt) =>
        activityFromPrompt(prompt, participation),
      );
      // A failed local write must not turn a successful request into "offline".
      await replaceCachedPrompts(participation.studyId, activities).catch(
        () => undefined,
      );
    }
  } catch {
    ok = false;
  }

  try {
    const { data } = await client.GET('/api/v1/participation/me/activities');
    if (!data) {
      ok = false;
    } else {
      freeActivities = data
        .filter((activity) => activity.allow_free_entries)
        .map((activity) => activityFromFreeEntry(activity, participation));
      await replaceCachedFreeActivities(
        participation.studyId,
        freeActivities,
      ).catch(() => undefined);
    }
  } catch {
    ok = false;
  }

  // The team can change what Today shows at any time; offline, the last known choice stays.
  try {
    const { data } = await client.GET('/api/v1/participation/me');
    if (data) {
      await setTodayFreeEntryDisplay(
        participation.studyId,
        data.study.today_free_entry_display,
      );
    }
  } catch {
    // Not a reason to report the phone as offline: the requests above already say so.
  }

  return { ok, activities, freeActivities };
}

export type TodayPrompts = {
  activities: PromptActivity[];
  freeActivities: FreeEntryActivity[];
  participations: Participation[];
  offline: boolean;
};

/**
 * Fetches the open prompts and the free-entry activities of every active participation, then
 * falls back to the last copy saved on the phone for studies whose request failed. A prompt
 * with an outbox entry is not shown again, even if it has not reached the server yet.
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
    if (activity.promptId) {
      byPrompt.set(activity.promptId, activity);
    }
  }

  const freeActivities = new Map<string, FreeEntryActivity>();
  for (const activity of results.flatMap((result) => result.freeActivities)) {
    freeActivities.set(activity.id, activity);
  }

  if (offline) {
    const cached = await listCachedPromptActivities();
    for (const activity of cached) {
      if (
        activity.promptId &&
        activeStudyIds.has(activity.studyId) &&
        !byPrompt.has(activity.promptId)
      ) {
        byPrompt.set(activity.promptId, activity);
      }
    }

    for (const activity of await listCachedFreeActivities(activeStudyIds)) {
      if (!freeActivities.has(activity.id)) {
        freeActivities.set(activity.id, activity);
      }
    }
  }

  const answered = await listAnsweredPromptIds();
  const activities = [...byPrompt.values()]
    .filter((activity) => !activity.promptId || !answered.has(activity.promptId))
    .sort((left, right) => left.closesAt.localeCompare(right.closesAt));

  return {
    activities,
    freeActivities: [...freeActivities.values()],
    participations: await listParticipations(),
    offline,
  };
}

export async function cachedActivity(
  activityId: string | undefined,
  promptId?: string | null,
): Promise<PromptActivity | null> {
  // Two open prompts can share one activity, so the prompt wins when the caller knows it.
  if (promptId) {
    const prompted = await getCachedActivityByPrompt(promptId);
    if (prompted) {
      return prompted;
    }
  }

  const free = await getCachedFreeActivity(activityId);
  if (free) {
    return promptActivityOf(free);
  }

  return getCachedActivity(activityId);
}

/** Prepares the recording flow for a free entry, which carries no prompt. */
export async function cacheFreeEntry(activity: FreeEntryActivity): Promise<void> {
  await cacheFreeActivity(activity);
}

/** A prompt answer must be recorded against the prompt, not as a free entry. */
export async function forgetFreeEntry(activityId: string): Promise<void> {
  await clearCachedFreeActivity(activityId);
}

export async function cachedActivityForPrompt(
  promptId: string,
): Promise<PromptActivity | null> {
  return getCachedActivityByPrompt(promptId);
}

/**
 * Used when a notification arrives before this session refreshed the prompt cache. Returns the
 * prompts of the refresh so the caller can open one even if the local cache write failed, and
 * tells whether every study answered, so a missing prompt is only reported as closed when the
 * API was actually reached.
 */
export async function refreshPromptCache(): Promise<{
  online: boolean;
  prompts: PromptActivity[];
}> {
  const result = await loadTodayPrompts();
  return { online: !result.offline, prompts: result.activities };
}
