import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { SelectSheet } from '@/components/account/SelectSheet';
import {
  AvailabilitySheet,
  type AvailabilityDraft,
} from '@/components/join/AvailabilitySheet';
import { formatTime } from '@/components/join/TimeWheel';
import { WeekdayChips } from '@/components/join/WeekdayChips';
import {
  fromApiInterval,
  toApiInterval,
  type AvailabilityIntervalView,
} from '@/components/more/availability';
import type { JoinKey } from '@/i18n/join';
import { tj } from '@/i18n/tj';
import { tm } from '@/i18n/tm';
import { getDeviceToken, listParticipations, type Participation } from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

const WEEKDAY_DAYS = [true, true, true, true, true, false, false];
const ALL_DAYS = [true, true, true, true, true, true, true];

const QUICK_ADDS: { label: JoinKey; from: number; to: number }[] = [
  { label: 'availability.quickMorning', from: 16, to: 24 },
  { label: 'availability.quickAfternoon', from: 24, to: 36 },
  { label: 'availability.quickEvening', from: 36, to: 44 },
];

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

function studyDay(participation: Participation | undefined): {
  day: number;
  total: number;
} | null {
  if (!participation?.startsOn || !participation.endsOn) {
    return null;
  }

  const start = new Date(`${participation.startsOn}T00:00:00`);
  const end = new Date(`${participation.endsOn}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const total = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const day = Math.max(
    1,
    Math.min(
      total,
      Math.round((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    ),
  );

  return { day, total };
}

export default function HoursScreen() {
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anyTime, setAnyTime] = useState(false);
  const [intervals, setIntervals] = useState<AvailabilityIntervalView[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);

  const selected = participations.find((item) => item.studyId === selectedId);
  const meta = studyDay(selected);

  const loadAvailability = useCallback(async (studyId: string) => {
    const token = await getDeviceToken(studyId);
    if (!token) {
      setAnyTime(false);
      setIntervals([]);
      return;
    }

    try {
      const { data } = await deviceClient(token).GET(
        '/api/v1/participation/me/availability',
      );
      if (!data) {
        setError(networkErrorMessage());
        return;
      }

      setAnyTime(data.any_time);
      setIntervals(
        data.intervals.map((interval, index) => fromApiInterval(interval, index + 1)),
      );
      nextId.current = data.intervals.length + 1;
      setError(null);
    } catch {
      setError(networkErrorMessage());
    }
  }, []);

  const load = useCallback(async () => {
    const rows = await listParticipations().catch(() => []);
    setParticipations(rows);
    setLoading(false);

    const next =
      rows.find(
        (row) =>
          row.status === 'active' ||
          row.status === 'pending_approval' ||
          row.status === 'withdrawn',
      ) ?? rows[0];

    const nextIdValue = next?.studyId ?? null;
    if (nextIdValue !== selectedId) {
      setSelectedId(nextIdValue);
    }
    if (nextIdValue) {
      await loadAvailability(nextIdValue);
    }
  }, [loadAvailability, selectedId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const markChanged = () => {
    setSaved(false);
    setError(null);
  };

  const addInterval = (from: number, to: number, days: boolean[]) => {
    const id = nextId.current;
    nextId.current += 1;
    setIntervals((current) => [...current, { id, from, to, days }]);
  };

  const removeInterval = (id: number) => {
    markChanged();
    setIntervals((current) => current.filter((interval) => interval.id !== id));
  };

  const saveInterval = (draft: AvailabilityDraft) => {
    if (!sheet) {
      return;
    }

    markChanged();
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

  const openEditInterval = (interval: AvailabilityIntervalView) => {
    setSheet({
      id: interval.id,
      initial: {
        from: interval.from,
        to: interval.to,
        days: [...interval.days],
      },
    });
  };

  const chooseStudy = async (studyId: string) => {
    setSelectedId(studyId);
    setSaved(false);
    setIntervals([]);
    setAnyTime(false);
    await loadAvailability(studyId);
  };

  const copyOtherStudy = async (studyId: string) => {
    setCopyOpen(false);
    const token = await getDeviceToken(studyId);
    if (!token) {
      return;
    }

    try {
      const { data } = await deviceClient(token).GET(
        '/api/v1/participation/me/availability',
      );
      if (!data) {
        setError(networkErrorMessage());
        return;
      }

      markChanged();
      setAnyTime(data.any_time);
      setIntervals(
        data.intervals.map((interval, index) =>
          fromApiInterval(interval, index + 1),
        ),
      );
      nextId.current = data.intervals.length + 1;
    } catch {
      setError(networkErrorMessage());
    }
  };

  const save = async () => {
    if (!selectedId) {
      return;
    }

    if (!anyTime) {
      if (intervals.length === 0) {
        setError(tj('availability.emptyError'));
        return;
      }
      if (intervals.some((interval) => interval.from >= interval.to)) {
        setError(tj('availability.invalidInterval'));
        return;
      }
      if (intervals.some((interval) => !interval.days.some(Boolean))) {
        setError(tj('availability.noDays'));
        return;
      }
    }

    const token = await getDeviceToken(selectedId);
    if (!token) {
      setError(tm('hours.noToken'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: apiError } = await deviceClient(token).PUT(
        '/api/v1/participation/me/availability',
        {
          body: anyTime
            ? { any_time: true, intervals: [] }
            : { any_time: false, intervals: intervals.map(toApiInterval) },
        },
      );

      if (!data) {
        setError(apiErrorMessage(apiError));
        return;
      }

      setSaved(true);
    } catch {
      setError(networkErrorMessage());
    } finally {
      setSaving(false);
    }
  };

  if (!loading && participations.length === 0) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{tm('hours.title')}</Text>
          <Text style={styles.body}>{tm('hours.noStudies')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {selected
            ? tm('hours.eyebrow', {
                study: selected.title,
                day: meta?.day ?? 1,
                total: meta?.total ?? 1,
              })
            : tm('hours.title')}
        </Text>
        <Text style={styles.title}>{tm('hours.title')}</Text>
        <Text style={styles.body}>{tm('hours.body')}</Text>
      </View>

      {participations.length > 1 ? (
        <View style={styles.studyPicker}>
          <Text style={styles.pickerLabel}>{tm('hours.pickStudy')}</Text>
          <View style={styles.pickerRow}>
            {participations.map((participation) => {
              const active = participation.studyId === selectedId;
              return (
                <Pressable
                  key={participation.studyId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void chooseStudy(participation.studyId);
                  }}
                  style={[
                    styles.studyChip,
                    active ? styles.studyChipOn : styles.studyChipOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.studyChipLabel,
                      active && styles.studyChipLabelOn,
                    ]}
                  >
                    {participation.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.anyCard}>
        <View style={styles.anyHeader}>
          <Text style={styles.anyLabel}>{tj('availability.any')}</Text>
          <Pressable
            accessibilityLabel={tj('availability.any')}
            accessibilityRole="switch"
            accessibilityState={{ checked: anyTime }}
            onPress={() => {
              markChanged();
              setAnyTime((value) => !value);
            }}
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
                  onPress={() => {
                    markChanged();
                    addInterval(quick.from, quick.to, [...ALL_DAYS]);
                  }}
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
        <Text style={styles.noteText}>{tj('availability.dailyNoteUnknown')}</Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={colors.primaryDark}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !selectedId }}
        disabled={saving || !selectedId}
        onPress={() => {
          void save();
        }}
        style={({ pressed }) => [
          styles.saveButton,
          saved ? styles.saveButtonSaved : styles.saveButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.saveLabel, saved && styles.saveLabelSaved]}>
          {saving ? tm('hours.saving') : saved ? tm('hours.saved') : tm('hours.save')}
        </Text>
      </Pressable>

      {participations.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCopyOpen(true)}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Ionicons name="copy-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.copyLabel}>{tm('hours.copy')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.infoCard}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.primaryDark}
        />
        <View style={styles.infoText}>
          <Text style={styles.infoLine}>{tm('hours.note1')}</Text>
          <Text style={styles.infoLine}>{tm('hours.note2')}</Text>
        </View>
      </View>

      {sheet ? (
        <AvailabilitySheet
          initial={sheet.initial}
          mode={sheet.id === null ? 'new' : 'edit'}
          onClose={() => setSheet(null)}
          onSave={saveInterval}
        />
      ) : null}

      <SelectSheet
        hint={tm('hours.copyHint')}
        onClose={() => setCopyOpen(false)}
        onSelect={(title) => {
          const source = participations.find((item) => item.title === title);
          if (source && source.studyId !== selectedId) {
            void copyOtherStudy(source.studyId);
          }
        }}
        options={participations
          .filter((item) => item.studyId !== selectedId)
          .map((item) => item.title)}
        selected={undefined}
        title={tm('hours.copy')}
        visible={copyOpen}
      />
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
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  studyPicker: {
    gap: 6,
  },
  pickerLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  studyChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  studyChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  studyChipOff: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  studyChipLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  studyChipLabelOn: {
    color: colors.white,
  },
  anyCard: {
    gap: 2,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
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
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
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
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  empty: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
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
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
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
  saveButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  saveButtonActive: {
    backgroundColor: colors.primary,
  },
  saveButtonSaved: {
    backgroundColor: colors.primarySoft,
  },
  saveLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  saveLabelSaved: {
    color: colors.primaryDark,
  },
  copyButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.lg,
  },
  copyLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: colors.primarySoft,
  },
  infoText: {
    minWidth: 0,
    flex: 1,
    gap: 6,
  },
  infoLine: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.primaryDark,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
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
  pressed: {
    opacity: 0.8,
  },
});
