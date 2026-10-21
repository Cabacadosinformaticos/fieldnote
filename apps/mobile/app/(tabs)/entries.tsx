import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EntryRow } from '@/components/daily/EntryRow';
import {
  dailyEntries,
  dailyEntryGroups,
  dailyStudy,
  dailyWaitingCount,
} from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

export default function EntriesScreen() {
  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.studyLine}>
          {td('today.studyDay', {
            study: dailyStudy.name,
            day: dailyStudy.day,
            total: dailyStudy.totalDays,
          })}
        </Text>
        <Text style={styles.title}>{td('entries.title')}</Text>
        <Text style={styles.subtitle}>
          {td('entries.subtitle', { count: dailyEntries.length })}
        </Text>
      </View>

      {dailyWaitingCount > 0 ? (
        <View style={styles.waitingBanner}>
          <Ionicons name="cloud-upload-outline" size={20} color={waitingColors.text} />
          <View style={styles.waitingText}>
            <Text style={styles.waitingTitle}>
              {td('entries.waitingTitle', { count: dailyWaitingCount })}
            </Text>
            <Text style={styles.waitingBody}>{td('entries.waitingBody')}</Text>
          </View>
        </View>
      ) : null}

      {dailyEntryGroups.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupLabel}>{td(group.labelKey)}</Text>
          {group.entries.map((entry) => (
            <EntryRow entry={entry} key={entry.id} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.sm,
  },
  studyLine: {
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
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
  },
  waitingText: {
    flex: 1,
    gap: 2,
  },
  waitingTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: waitingColors.text,
  },
  waitingBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: waitingColors.text,
  },
  group: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  groupLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
