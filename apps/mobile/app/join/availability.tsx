import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, deviceClient } from '@/api/client';
import { getAndroidId } from '@/api/device';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import {
  AvailabilitySheet,
  type AvailabilityDraft,
} from '@/components/join/AvailabilitySheet';
import { StepProgress } from '@/components/join/StepProgress';
import { formatTime } from '@/components/join/TimeWheel';
import { WeekdayChips } from '@/components/join/WeekdayChips';
import { Screen } from '@/components/Screen';
import type { JoinKey } from '@/i18n/join';
import { t } from '@/i18n/pt';
import { tj } from '@/i18n/tj';
import { useJoinSession, type AvailabilityInput } from '@/state/join';
import {
  getDeviceToken,
  saveDeviceToken,
  saveParticipation,
} from '@/state/participations';
import { colors, fonts, radii, spacing, typography } from '@/theme';

const WEEKDAY_DAYS = [true, true, true, true, true, false, false];
const ALL_DAYS = [true, true, true, true, true, true, true];

const QUICK_ADDS: { label: JoinKey; from: number; to: number }[] = [
  { label: 'availability.quickMorning', from: 16, to: 24 },
  { label: 'availability.quickAfternoon', from: 24, to: 36 },
  { label: 'availability.quickEvening', from: 36, to: 44 },
];

type Interval = {
  id: number;
  from: number;
  to: number;
  days: boolean[];
};

type SheetState = {
  id: number | null;
  initial: AvailabilityDraft;
};

function rangeLabel(from: number, to: number): string {
  return tj('availability.range', {
    from: formatTime(from),
    to: formatTime(to),
  });
}

function slotToTime(index: number): string {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}:00`;
}

export default function AvailabilityScreen() {
  const { answers, code, lookup } = useJoinSession();
  const [anyTime, setAnyTime] = useState(false);
  const [intervals, setIntervals] = useState<Interval[]>([
    { id: 1, from: 18, to: 22, days: [...WEEKDAY_DAYS] },
    { id: 2, from: 37, to: 43, days: [...WEEKDAY_DAYS] },
  ]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nextId = useRef(3);

  const addInterval = (from: number, to: number, days: boolean[]) => {
    const id = nextId.current;
    nextId.current += 1;
    setIntervals((current) => [...current, { id, from, to, days }]);
  };

  const removeInterval = (id: number) => {
    setIntervals((current) => current.filter((interval) => interval.id !== id));
  };

  const saveInterval = (draft: AvailabilityDraft) => {
    if (!sheet) {
      return;
    }

    if (sheet.id === null) {
      addInterval(draft.from, draft.to, draft.days);
    } else {
      const id = sheet.id;
      setIntervals((current) =>
        current.map((interval) =>
          interval.id === id ? { ...interval, ...draft } : interval,
        ),
      );
    }

    setSheet(null);
  };

  const openNewInterval = () => {
    setSheet({
      id: null,
      initial: { from: 30, to: 34, days: [...WEEKDAY_DAYS] },
    });
  };

  const openEditInterval = (interval: Interval) => {
    setSheet({
      id: interval.id,
      initial: {
        from: interval.from,
        to: interval.to,
        days: [...interval.days],
      },
    });
  };

  const submit = async () => {
    if (!lookup) {
      router.replace('/join/code');
      return;
    }

    if (!anyTime) {
      if (intervals.length === 0) {
        setSubmitError(tj('availability.emptyError'));
        return;
      }
      if (intervals.some((interval) => interval.from >= interval.to)) {
        setSubmitError(tj('availability.invalidInterval'));
        return;
      }
      if (intervals.some((interval) => !interval.days.some(Boolean))) {
        setSubmitError(tj('availability.noDays'));
        return;
      }
    }

    const availability: AvailabilityInput = anyTime
      ? { any_time: true, intervals: [] }
      : {
          any_time: false,
          intervals: intervals.map((interval) => ({
            start_time: slotToTime(interval.from),
            end_time: slotToTime(interval.to),
            weekdays: interval.days.flatMap((enabled, index) =>
              enabled ? [index + 1] : [],
            ),
          })),
        };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const storedToken = await getDeviceToken(lookup.study.id);
      const client = storedToken ? deviceClient(storedToken) : api;
      const accepted = await client.POST(
        '/api/v1/participation/invitations/accept',
        {
          body: {
            code: code ?? '',
            android_id: getAndroidId(),
            locale: 'pt',
            consent_version: lookup.consent_version,
            answers,
          },
        },
      );

      if (!accepted.data) {
        setSubmitError(apiErrorMessage(accepted.error));
        return;
      }

      if (accepted.data.device_token) {
        await saveDeviceToken(lookup.study.id, accepted.data.device_token);
      }

      const deviceToken = accepted.data.device_token ?? storedToken;
      if (!deviceToken) {
        setSubmitError(tj('error.generic'));
        return;
      }

      await saveParticipation({
        studyId: lookup.study.id,
        title: lookup.study.title,
        status: accepted.data.participant.status,
        alias: accepted.data.participant.alias,
        startsOn: lookup.study.starts_on,
        endsOn: lookup.study.ends_on,
        timezone: lookup.study.timezone,
      });

      const saved = await deviceClient(deviceToken).PUT(
        '/api/v1/participation/me/availability',
        { body: availability },
      );

      if (!saved.data) {
        setSubmitError(apiErrorMessage(saved.error));
        return;
      }

      const status = accepted.data.participant.status;
      if (status !== 'pending_approval' && status !== 'active') {
        setSubmitError(tj('error.generic'));
        return;
      }

      const studyId = lookup.study.id;
      // Unmount the join stack before leaving, so its screens stop reacting to
      // the session while we navigate to the study.
      router.dismissAll();

      if (status === 'pending_approval') {
        router.replace({ pathname: '/join/waiting', params: { studyId } });
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setSubmitError(networkErrorMessage());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <StepProgress filled={3} label={tj('availability.step')} />

      <Text style={typography.title}>{tj('availability.title')}</Text>
      <Text style={styles.body}>{tj('availability.body')}</Text>

      <View style={styles.anyCard}>
        <View style={styles.anyHeader}>
          <Text style={styles.anyLabel}>{tj('availability.any')}</Text>
          <Pressable
            accessibilityLabel={tj('availability.any')}
            accessibilityRole="switch"
            accessibilityState={{ checked: anyTime }}
            onPress={() => setAnyTime((value) => !value)}
            style={styles.switchButton}
          >
            <View
              style={[
                styles.switchTrack,
                anyTime ? styles.switchTrackOn : styles.switchTrackOff,
              ]}
            >
              <View style={[styles.switchKnob, anyTime && styles.switchKnobOn]} />
            </View>
          </Pressable>
        </View>
        <Text style={styles.anyBody}>{tj('availability.anyBody')}</Text>
      </View>

      {anyTime ? null : (
        <>
          {intervals.length === 0 ? (
            <Text style={styles.empty}>{tj('availability.empty')}</Text>
          ) : (
            <View style={styles.list}>
              {intervals.map((interval) => {
                const range = rangeLabel(interval.from, interval.to);
                return (
                  <View key={interval.id} style={styles.item}>
                    <View style={styles.itemTop}>
                      <Pressable
                        accessibilityLabel={tj('availability.editRange', { range })}
                        accessibilityRole="button"
                        onPress={() => openEditInterval(interval)}
                        style={styles.rangeButton}
                      >
                        <Text style={styles.range}>{range}</Text>
                        <Ionicons
                          name="pencil-outline"
                          size={16}
                          color={colors.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={tj('availability.removeRange', { range })}
                        accessibilityRole="button"
                        onPress={() => removeInterval(interval.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.text}
                        />
                      </Pressable>
                    </View>
                    <WeekdayChips days={interval.days} />
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.quickBlock}>
            <Text style={styles.quickLabel}>{tj('availability.quickLabel')}</Text>
            <View style={styles.quickRow}>
              {QUICK_ADDS.map((quick) => (
                <Pressable
                  key={quick.label}
                  accessibilityLabel={tj('availability.addQuick', {
                    label: tj(quick.label),
                    range: rangeLabel(quick.from, quick.to),
                  })}
                  accessibilityRole="button"
                  onPress={() => addInterval(quick.from, quick.to, [...ALL_DAYS])}
                  style={styles.quickChip}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                  <Text style={styles.quickText}>{tj(quick.label)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={openNewInterval}
            style={styles.addButton}
          >
            <Ionicons name="add" size={18} color={colors.primaryDark} />
            <Text style={styles.addLabel}>{tj('availability.addInterval')}</Text>
          </Pressable>
        </>
      )}

      <View style={styles.noteRow}>
        <Ionicons name="time-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.noteText}>{tj('availability.dailyNote')}</Text>
      </View>

      <Text style={styles.caption}>{tj('availability.caption')}</Text>

      <View style={styles.spacer} />

      {submitError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <Button
        disabled={submitting}
        label={submitting ? tj('availability.saving') : t('common.continue')}
        onPress={() => {
          void submit();
        }}
      />

      {sheet ? (
        <AvailabilitySheet
          initial={sheet.initial}
          mode={sheet.id === null ? 'new' : 'edit'}
          onClose={() => setSheet(null)}
          onSave={saveInterval}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  anyCard: {
    gap: 2,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  anyHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  anyLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  anyBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  switchButton: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTrack: {
    width: 56,
    height: 32,
    borderRadius: 16,
  },
  switchTrackOn: {
    backgroundColor: colors.primary,
  },
  switchTrackOff: {
    backgroundColor: '#8A93A8',
  },
  switchKnob: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  switchKnobOn: {
    left: 28,
  },
  list: {
    gap: 10,
  },
  item: {
    gap: 2,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingTop: spacing.xs,
    paddingHorizontal: 10,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rangeButton: {
    minWidth: 0,
    height: 52,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
  },
  range: {
    fontFamily: fonts.mono,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  removeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textMuted,
    backgroundColor: colors.surface,
  },
  quickBlock: {
    gap: spacing.sm,
  },
  quickLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
  },
  quickText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  addButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  addLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primaryDark,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
});
