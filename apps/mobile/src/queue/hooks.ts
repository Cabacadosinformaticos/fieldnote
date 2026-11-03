import { useCallback, useEffect, useState } from 'react';

import { getOutboxEntry, listOutboxEntries, subscribeOutbox } from './outbox';
import { cachedActivity } from './prompts';
import { summaryOf } from './types';
import type { OutboxEntry, OutboxSummary, PromptActivity } from './types';

export function useOutboxEntries(): {
  entries: OutboxEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await listOutboxEntries();
      setEntries(next);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeOutbox(() => {
      if (mounted) {
        void load();
      }
    });
    const initial = setTimeout(() => {
      if (mounted) {
        void load();
      }
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(initial);
      unsubscribe();
    };
  }, [load]);

  return { entries, loading };
}

export function useOutboxSummary(): OutboxSummary {
  const { entries } = useOutboxEntries();
  return summaryOf(entries);
}

export function useOutboxEntry(id: string | undefined): {
  entry: OutboxEntry | null;
  loading: boolean;
} {
  const [entry, setEntry] = useState<OutboxEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setEntry(null);
      setLoading(false);
      return;
    }
    try {
      setEntry(await getOutboxEntry(id));
    } catch {
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeOutbox(() => {
      if (mounted) {
        void load();
      }
    });
    const initial = setTimeout(() => {
      if (mounted) {
        void load();
      }
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(initial);
      unsubscribe();
    };
  }, [load]);

  return { entry, loading };
}

export function useCachedActivity(
  activityId: string | undefined,
  promptId?: string | null,
): {
  activity: PromptActivity | null;
  loading: boolean;
} {
  const [activity, setActivity] = useState<PromptActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    cachedActivity(activityId, promptId)
      .then((next) => {
        if (mounted) {
          setActivity(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setActivity(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activityId, promptId]);

  return { activity, loading };
}
