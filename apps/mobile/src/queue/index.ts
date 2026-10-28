import NetInfo from '@react-native-community/netinfo';

import { flushOutbox, retryOutbox } from './sender';

let started = false;

/**
 * Starts the outbox at app start: retries pending entries and retries immediately when the
 * network comes back. Safe to call from more than one screen.
 */
export function startQueue(): void {
  if (started) {
    return;
  }
  started = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void retryOutbox().catch(() => undefined);
    }
  });

  void flushOutbox(true).catch(() => undefined);
}

export { flushOutbox, retryOutbox } from './sender';
export { useCachedActivity, useOutboxEntries, useOutboxEntry, useOutboxSummary } from './hooks';
export { loadTodayPrompts } from './prompts';
export { saveEntry, type MediaSource, type SaveEntryInput } from './save';
export { scaleShownFor } from './scale';
export type {
  CaptureType,
  OutboxEntry,
  OutboxState,
  PromptActivity,
  ScaleConfig,
  ScaleShown,
  ScaleType,
  WarningId,
} from './types';
