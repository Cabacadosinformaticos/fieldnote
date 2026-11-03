import NetInfo from '@react-native-community/netinfo';
import { File, UploadType } from 'expo-file-system';

import { deviceClientForStudy } from '@/api/client';

import {
  listPendingEntries,
  markEntryFailed,
  markEntryRetry,
  markEntrySending,
  markEntrySent,
  resetInterruptedEntries,
  updateEntryMedia,
} from './outbox';
import { sendPendingPromptEvents } from './promptEvents';
import { backoffMs } from './stable';
import type { MediaAttachment, OutboxEntry } from './types';

type DeviceClient = NonNullable<
  Awaited<ReturnType<typeof deviceClientForStudy>>
>;

type FlushReport = {
  sent: number;
  failed: number;
  offline: boolean;
};

class SendError extends Error {
  readonly permanent: boolean;

  constructor(code: string, permanent: boolean) {
    super(code);
    this.name = 'SendError';
    this.permanent = permanent;
  }
}

function apiErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return null;
  }
  const body = (error as { error?: unknown }).error;
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return null;
  }
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function permanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function responseError(status: number | undefined, error: unknown): SendError {
  const code = apiErrorCode(error) ?? (status ? `http_${status}` : 'network');
  return new SendError(code, status !== undefined && permanentStatus(status));
}

function uploadMethod(value: string): 'PUT' | 'POST' | 'PATCH' {
  return value === 'POST' || value === 'PATCH' ? value : 'PUT';
}

async function uploadMedia(
  client: DeviceClient,
  entry: OutboxEntry,
  media: MediaAttachment,
): Promise<MediaAttachment> {
  if (media.mediaObjectId) {
    return media;
  }

  let ticket;
  try {
    const result = await client.POST('/api/v1/media/upload-url', {
      body: {
        entry_id: entry.id,
        mime_type: media.mimeType,
        size_bytes: media.sizeBytes,
        sha256: media.sha256,
      },
    });
    ticket = result.data;
    if (!ticket) {
      throw responseError(result.response?.status, result.error);
    }
  } catch (error) {
    if (error instanceof SendError) {
      throw error;
    }
    throw new SendError('network', false);
  }

  const file = new File(media.localPath);
  if (!file.exists) {
    throw new SendError('media_missing', true);
  }

  try {
    const uploaded = await file.upload(ticket.upload_url, {
      httpMethod: uploadMethod(ticket.method),
      uploadType: UploadType.BINARY_CONTENT,
      headers: ticket.headers,
      mimeType: media.mimeType,
    });
    if (uploaded.status < 200 || uploaded.status >= 300) {
      throw new SendError(`upload_http_${uploaded.status}`, false);
    }
  } catch (error) {
    if (error instanceof SendError) {
      throw error;
    }
    throw new SendError('upload_failed', false);
  }

  return { ...media, mediaObjectId: ticket.media_object_id };
}

async function sendEntry(
  client: DeviceClient,
  entry: OutboxEntry,
): Promise<string> {
  const media = [...entry.media];
  for (let index = 0; index < media.length; index += 1) {
    const uploaded = await uploadMedia(client, entry, media[index]);
    if (uploaded.mediaObjectId !== media[index].mediaObjectId) {
      media[index] = uploaded;
      await updateEntryMedia(entry.id, media);
    }
  }

  let result;
  try {
    result = await client.POST('/api/v1/entries', {
      body: {
        activity_id: entry.payload.activityId,
        body: entry.payload.body,
        choice: entry.payload.choice,
        content_sha256: entry.contentSha256,
        entry_type: entry.payload.entryType,
        id: entry.id,
        media_object_ids: media
          .map((item) => item.mediaObjectId)
          .filter((id): id is string => Boolean(id)),
        prompt_id: entry.payload.promptId,
        recorded_at: entry.payload.recordedAt,
        scale_shown: entry.payload.scaleShown as Record<string, unknown> | null,
        value: entry.payload.value,
      },
    });
  } catch {
    throw new SendError('network', false);
  }

  const status = result.response?.status;
  if (status === 200 || status === 201) {
    const data = result.data as
      | { received_at?: string }
      | null
      | undefined;
    return data?.received_at ?? new Date().toISOString();
  }

  throw responseError(status, result.error);
}

async function deleteLocalMedia(entry: OutboxEntry): Promise<void> {
  for (const media of entry.media) {
    try {
      const file = new File(media.localPath);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // A file that was already removed does not block the entry from being marked as sent.
    }
  }
}

async function runFlush(includeBackoff: boolean): Promise<FlushReport> {
  await resetInterruptedEntries();

  const network = await NetInfo.fetch().catch(() => null);
  if (
    network &&
    (!network.isConnected || network.isInternetReachable === false)
  ) {
    return { sent: 0, failed: 0, offline: true };
  }

  const pending = await listPendingEntries(includeBackoff);
  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    const client = await deviceClientForStudy(entry.studyId).catch(() => null);
    if (!client) {
      await markEntryFailed(entry.id, 'device_token_missing');
      failed += 1;
      continue;
    }

    await markEntrySending(entry.id);

    try {
      const receivedAt = await sendEntry(client, entry);
      await markEntrySent(entry.id, receivedAt);
      await deleteLocalMedia(entry);
      sent += 1;
    } catch (error) {
      const failure =
        error instanceof SendError
          ? error
          : new SendError('unexpected', false);
      if (failure.permanent) {
        await markEntryFailed(entry.id, failure.message);
        failed += 1;
      } else {
        const wait = backoffMs(entry.attempts + 1);
        await markEntryRetry(
          entry.id,
          failure.message,
          new Date(Date.now() + wait).toISOString(),
        );
      }
    }
  }

  // Prompt reports share the flush triggers of the outbox but never delay its entries: a
  // failure here is simply retried on the next flush.
  await sendPendingPromptEvents().catch(() => undefined);

  return { sent, failed, offline: false };
}

let activeFlush: Promise<FlushReport> | null = null;

export function flushOutbox(includeBackoff = false): Promise<FlushReport> {
  if (!activeFlush) {
    activeFlush = runFlush(includeBackoff).finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
}

/** Runs now, ignoring the retry backoff. Used when the network comes back. */
export function retryOutbox(): Promise<FlushReport> {
  return flushOutbox(true);
}
