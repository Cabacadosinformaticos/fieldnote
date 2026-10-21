import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { EntryStatusPill } from '@/components/daily/EntryStatusPill';
import { GardenScene } from '@/components/daily/GardenScene';
import { captureTypeLabelKeys } from '@/components/daily/captureType';
import { dailyLocation, getEntry, type DailyEntry } from '@/fake/daily';
import { td, type DailyTranslationKey } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

function contentLabelKey(type: DailyEntry['type']): DailyTranslationKey {
  if (type === 'photo') {
    return 'entry.phrase';
  }
  if (type === 'audio' || type === 'video') {
    return 'entry.recording';
  }
  return 'entry.answer';
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = getEntry(id);

  if (!entry) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.body}>
          <Text style={styles.notFound}>{td('entry.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const recorded = entry.recordedDate
    ? td('entries.recordedOn', {
        date: entry.recordedDate,
        time: entry.recordedTime,
      })
    : td('entries.recordedAt', { time: entry.recordedTime });

  const received = entry.receivedTime
    ? entry.recordedDate
      ? td('entry.receivedOn', {
          date: entry.recordedDate,
          time: entry.receivedTime,
        })
      : td('entry.receivedToday', { time: entry.receivedTime })
    : td('entry.notReceived');

  const content =
    entry.type === 'scale'
      ? td('entry.scaleValue', {
          value: entry.scaleValue ?? '',
          max: entry.scaleMax ?? '',
        })
      : entry.contentKey
        ? td(entry.contentKey)
        : '';

  const rows: { label: string; value: string }[] = [
    { label: td('entry.activity'), value: td(entry.titleKey) },
    { label: td('entry.recorded'), value: recorded },
    { label: td('entry.received'), value: received },
  ];

  if (entry.hasLocation) {
    rows.push({ label: td('entry.location'), value: dailyLocation });
  }

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.eyebrow}>
            {td('entry.kind', { type: td(captureTypeLabelKeys[entry.type]) })}
          </Text>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {td(entry.titleKey)}
          </Text>
        </View>
        <EntryStatusPill status={entry.status} />
      </View>

      <View style={styles.body}>
        {entry.type === 'photo' ? (
          <GardenScene height={300} label={td('entry.photoLabel')} />
        ) : null}

        <View style={styles.contentCard}>
          <Text style={styles.contentLabel}>
            {td(contentLabelKey(entry.type))}
          </Text>
          <Text style={styles.contentValue}>{content}</Text>
        </View>

        <View style={styles.metaCard}>
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.metaRow, index > 0 && styles.metaRowDivided]}
            >
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.lockRow}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.textMuted}
          />
          <Text style={styles.lockText}>{td('entry.lock')}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  headerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  notFound: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  contentCard: {
    gap: spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  contentLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  contentValue: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  metaCard: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  metaRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  metaRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  metaLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  metaValue: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
    color: colors.text,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.xs,
  },
  lockText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
