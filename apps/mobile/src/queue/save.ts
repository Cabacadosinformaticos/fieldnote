import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { insertOutboxEntry } from './outbox';
import { flushOutbox } from './sender';
import { canonicalContent } from './stable';
import type {
  CaptureType,
  EntryPayload,
  MediaAttachment,
  PromptActivity,
  ScaleShown,
} from './types';

const MEDIA_DIRECTORY = 'fieldnote-entries';

export type MediaSource = {
  uri: string;
  mimeType: string;
};

export type SaveEntryInput = {
  activity: PromptActivity;
  type: CaptureType;
  body?: string;
  value?: number;
  scaleShown?: ScaleShown;
  mediaUris?: MediaSource[];
};

export function mimeTypeForUri(uri: string, type: CaptureType): string {
  const lower = uri.split('?')[0].toLowerCase();
  if (lower.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (lower.endsWith('.3gp')) {
    return type === 'audio' ? 'audio/3gpp' : 'video/3gpp';
  }
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) {
    return type === 'audio' ? 'audio/mp4' : 'video/mp4';
  }
  if (lower.endsWith('.aac')) {
    return 'audio/aac';
  }
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lower.endsWith('.webm')) {
    return type === 'audio' ? 'audio/webm' : 'video/webm';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.heic')) {
    return 'image/heic';
  }

  switch (type) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/heic':
      return '.heic';
    case 'video/quicktime':
      return '.mov';
    case 'video/3gpp':
      return '.3gp';
    case 'video/webm':
      return '.webm';
    case 'audio/3gpp':
      return '.3gp';
    case 'audio/aac':
      return '.aac';
    case 'audio/wav':
      return '.wav';
    case 'audio/webm':
      return '.webm';
    case 'audio/mp4':
      return '.m4a';
    default:
      return '.mp4';
  }
}

async function prepareMedia(
  entryId: string,
  source: MediaSource,
): Promise<MediaAttachment> {
  const folder = new Directory(Paths.document, MEDIA_DIRECTORY);
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }

  const original = new File(source.uri);
  if (!original.exists) {
    throw new Error('media_missing');
  }

  const extension =
    original.extension.length > 0
      ? original.extension
      : extensionForMime(source.mimeType);
  const target = new File(
    folder,
    `${entryId}-${Crypto.randomUUID()}${extension}`,
  );

  await original.copy(target);
  if (!target.exists) {
    throw new Error('media_copy_failed');
  }

  const sizeBytes = target.info().size ?? target.size;
  if (sizeBytes <= 0) {
    target.delete();
    throw new Error('media_empty');
  }

  try {
    const sha256 = await target.digest('SHA-256');
    return {
      localPath: target.uri,
      mimeType: source.mimeType,
      sizeBytes,
      sha256,
    };
  } catch (error) {
    target.delete();
    throw error;
  }
}

async function prepareAllMedia(
  entryId: string,
  sources: MediaSource[],
): Promise<MediaAttachment[]> {
  const prepared: MediaAttachment[] = [];
  try {
    for (const source of sources) {
      prepared.push(await prepareMedia(entryId, source));
    }
    return prepared;
  } catch (error) {
    for (const media of prepared) {
      try {
        const file = new File(media.localPath);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Best effort cleanup for a partial copy.
      }
    }
    throw error;
  }
}

export async function saveEntry(input: SaveEntryInput): Promise<string> {
  const { activity, type } = input;
  if (!activity.captureTypes.includes(type)) {
    throw new Error('entry_type_not_allowed');
  }

  const body = input.body?.trim() ? input.body.trim() : null;
  if (type === 'text' && !body) {
    throw new Error('body_required');
  }
  if (type === 'scale' && input.value === undefined) {
    throw new Error('value_required');
  }

  const sources = input.mediaUris ?? [];
  if (
    (type === 'photo' || type === 'video' || type === 'audio') &&
    sources.length === 0
  ) {
    throw new Error('media_required');
  }

  const id = Crypto.randomUUID();
  const recordedAt = new Date().toISOString();
  const media =
    sources.length > 0 ? await prepareAllMedia(id, sources) : [];

  try {
    const payload: EntryPayload = {
      activityId: activity.id,
      promptId: activity.promptId,
      entryType: type,
      recordedAt,
      body,
      value: type === 'scale' ? (input.value ?? null) : null,
      scaleShown: type === 'scale' ? (input.scaleShown ?? null) : null,
      choice: null,
    };
    const contentSha256 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      canonicalContent(
        payload,
        media.map((item) => item.sha256),
      ),
    );

    await insertOutboxEntry({
      id,
      studyId: activity.studyId,
      activityId: activity.id,
      activityTitle: activity.title,
      promptId: activity.promptId,
      entryType: type,
      recordedAt,
      payload,
      media,
      contentSha256,
      createdAt: recordedAt,
    });
  } catch (error) {
    for (const item of media) {
      try {
        const file = new File(item.localPath);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // The entry was not queued, so a leftover local file is only wasted space.
      }
    }
    throw error;
  }

  void flushOutbox().catch(() => undefined);
  return id;
}
