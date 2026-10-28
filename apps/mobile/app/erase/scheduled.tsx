import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { formatDate } from '@/components/join/format';
import { tm } from '@/i18n/tm';
import { erasureDues, setErasureDue } from '@/state/actions';
import {
  getDeviceToken,
  listParticipations,
  saveParticipation,
  type Participation,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

function timeOf(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function EraseScheduledScreen() {
  const { scope, studyId, study, due, requested } = useLocalSearchParams<{
    scope?: string;
    studyId?: string;
    study?: string;
    due?: string;
    requested?: string;
  }>();
  const isAll = scope === 'all';
  const [rows, setRows] = useState<Participation[]>([]);
  const [dueAt, setDueAt] = useState(due ?? '');
  const [requestedAt] = useState(requested ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const cached = await listParticipations().catch(() => []);
      const dues = await erasureDues().catch(
        () => ({} as Record<string, string>),
      );
      const scheduled = cached.filter((row) => Boolean(dues[row.studyId]));
      if (!active) {
        return;
      }

      setRows(scheduled);
      if (isAll) {
        const earliest = scheduled
          .map((row) => dues[row.studyId])
          .filter((value): value is string => Boolean(value))
          .sort()[0];
        if (earliest) {
          setDueAt(earliest);
        }
      } else if (studyId) {
        if (!dueAt && dues[studyId]) {
          setDueAt(dues[studyId]);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [dueAt, isAll, studyId]);

  const cancelOne = async (id: string): Promise<boolean> => {
    const token = await getDeviceToken(id).catch(() => null);
    if (!token) {
      return false;
    }

    try {
      const { data, error: apiError } = await deviceClient(token).POST(
        '/api/v1/participation/me/erasure/cancel',
      );
      if (!data) {
        setError(apiErrorMessage(apiError));
        return false;
      }

      await saveParticipation({
        studyId: data.study.id,
        title: data.study.title,
        status: data.status,
        alias: data.alias,
        startsOn: data.study.starts_on,
        endsOn: data.study.ends_on,
        timezone: data.study.timezone,
      }).catch(() => undefined);
      await setErasureDue(data.study.id, null).catch(() => undefined);
      return true;
    } catch {
      setError(networkErrorMessage());
      return false;
    }
  };

  const cancel = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const ids = isAll
      ? rows.map((row) => row.studyId)
      : studyId
        ? [studyId]
        : [];

    for (const id of ids) {
      const ok = await cancelOne(id);
      if (!ok) {
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    router.replace(isAll ? '/(tabs)' : '/(tabs)/studies');
  };

  const dateLabel = dueAt ? formatDate(dueAt) : '';
  const timeLabel = dueAt ? timeOf(dueAt) : '';
  const requestedLabel = requestedAt
    ? tm('scheduled.requestedAtDate', {
        date: formatDate(requestedAt),
        time: timeOf(requestedAt),
      })
    : tm('scheduled.requestedAt', { time: timeOf(new Date().toISOString()) });

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {isAll
            ? tm('scheduled.eyebrowAll')
            : tm('scheduled.eyebrow', {
                study: study ?? '',
              })}
        </Text>
        <Text style={styles.title}>{tm('scheduled.title')}</Text>
      </View>

      <View style={styles.alertCard}>
        <Text style={styles.requested}>
          <Ionicons name="trash-outline" size={18} color="#9B1C1C" />{' '}
          {requestedLabel}
        </Text>
        <Text style={styles.alertTitle}>
          {isAll
            ? tm('scheduled.headingAll', {
                date: dateLabel,
                time: timeLabel,
              })
            : tm('scheduled.heading', {
                date: dateLabel,
                time: timeLabel,
              })}
        </Text>
        <Text style={styles.alertBody}>{tm('scheduled.body')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm('scheduled.whatTitle')}</Text>
        <InfoRow
          body={tm('scheduled.whatB1')}
          icon="eye-off-outline"
          title={tm('scheduled.what1Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB2', {
            date: dateLabel,
            time: timeLabel,
          })}
          icon="calendar-outline"
          title={tm('scheduled.what2Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB3')}
          icon="cube-outline"
          title={tm('scheduled.what3Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB4')}
          icon="cloud-upload-outline"
          title={tm('scheduled.what4Title')}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => {
            void cancel();
          }}
          style={({ pressed }) => [
            styles.cancelButton,
            busy && styles.cancelButtonBusy,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.cancelLabel}>
            {busy ? tm('scheduled.cancelling') : tm('scheduled.cancel')}
          </Text>
        </Pressable>
        <Text style={styles.cancelNote}>{tm('scheduled.cancelNote')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  alertCard: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#EDB4B4',
    padding: 18,
    backgroundColor: '#FDECEC',
  },
  requested: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: '#9B1C1C',
  },
  alertTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  alertBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  card: {
    gap: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  actions: {
    gap: spacing.sm,
  },
  cancelButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  cancelButtonBusy: {
    opacity: 0.7,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.white,
  },
  cancelNote: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
