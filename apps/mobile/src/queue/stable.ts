import type { EntryPayload } from './types';

type JsonObject = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (typeof value === 'object') {
    const source = value as JsonObject;
    const result: JsonObject = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) {
        result[key] = normalize(source[key]);
      }
    }
    return result;
  }
  return value;
}

/** JSON with object keys sorted, so the same entry always hashes the same way. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/**
 * The fields that identify what was recorded. Server-generated media ids are deliberately
 * excluded: a resend may request a new signed URL, but the participant's content is unchanged.
 */
export function contentDocument(payload: EntryPayload, mediaSha256: string[]): JsonObject {
  return {
    activity_id: payload.activityId,
    body: payload.body,
    choice: payload.choice,
    entry_type: payload.entryType,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    media_sha256: [...mediaSha256].sort(),
    prompt_id: payload.promptId,
    recorded_at: payload.recordedAt,
    scale_shown: payload.scaleShown,
    value: payload.value,
  };
}

export function canonicalContent(payload: EntryPayload, mediaSha256: string[]): string {
  return stableStringify(contentDocument(payload, mediaSha256));
}

export function backoffMs(attempts: number): number {
  const steps = [5_000, 15_000, 60_000, 300_000, 900_000, 3_600_000];
  const index = Math.min(Math.max(attempts - 1, 0), steps.length - 1);
  return steps[index];
}
