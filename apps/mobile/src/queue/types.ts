export type CaptureType = 'text' | 'photo' | 'video' | 'audio' | 'scale';
export type ScaleType = 'numbers' | 'faces' | 'text' | 'slider';
export type WarningId = 'privacy' | 'locationOn' | 'locationOff';

export type ScaleConfig = {
  type: ScaleType;
  points: number | null;
  startLabel: string | null;
  middleLabel: string | null;
  endLabel: string | null;
};

export type ScaleShown = {
  scale_type: ScaleType;
  points?: number;
  start_label?: string;
  middle_label?: string;
  end_label?: string;
  labels?: string[];
};

export type PromptActivity = {
  id: string;
  promptId: string | null;
  studyId: string;
  studyTitle: string;
  title: string;
  instructions: string;
  captureTypes: CaptureType[];
  warnings: WarningId[];
  expectedMinutes: number;
  captureLocation: boolean;
  scale: ScaleConfig | null;
  scheduledAt: string | null;
  sentAt: string | null;
  closesAt: string;
};

/** An activity the study lets participants use without a request (FR-13). */
export type FreeEntryActivity = {
  id: string;
  studyId: string;
  studyTitle: string;
  title: string;
  instructions: string;
  captureTypes: CaptureType[];
  warnings: WarningId[];
  captureLocation: boolean;
  scale: ScaleConfig | null;
  maxFreeEntriesPerDay: number | null;
  freeEntriesUsedToday: number;
};

export type EntryPayload = {
  activityId: string;
  promptId: string | null;
  entryType: CaptureType;
  recordedAt: string;
  body: string | null;
  value: number | null;
  scaleShown: ScaleShown | null;
  choice: string | null;
};

export type MediaAttachment = {
  localPath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  mediaObjectId?: string;
};

export type OutboxState = 'queued' | 'sending' | 'sent' | 'failed';

export type OutboxEntry = {
  id: string;
  studyId: string;
  activityId: string;
  activityTitle: string;
  promptId: string | null;
  entryType: CaptureType;
  recordedAt: string;
  payload: EntryPayload;
  media: MediaAttachment[];
  contentSha256: string;
  state: OutboxState;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
  sentAt: string | null;
  serverReceivedAt: string | null;
};

export type NewOutboxEntry = {
  id: string;
  studyId: string;
  activityId: string;
  activityTitle: string;
  promptId: string | null;
  entryType: CaptureType;
  recordedAt: string;
  payload: EntryPayload;
  media: MediaAttachment[];
  contentSha256: string;
  createdAt: string;
};

export type OutboxSummary = {
  waiting: number;
  failed: number;
};

export function summaryOf(entries: OutboxEntry[]): OutboxSummary {
  let waiting = 0;
  let failed = 0;

  for (const entry of entries) {
    if (entry.state === 'queued' || entry.state === 'sending') {
      waiting += 1;
    } else if (entry.state === 'failed') {
      failed += 1;
    }
  }

  return { waiting, failed };
}
