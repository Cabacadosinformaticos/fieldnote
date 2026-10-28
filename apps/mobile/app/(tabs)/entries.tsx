import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EntryRow } from '@/components/daily/EntryRow';
import { groupIdOf, groupLabelOf } from '@/components/daily/entryFormat';
import { td } from '@/i18n/td';
import { useOutboxEntries } from '@/queue/hooks';
import { summaryOf, type OutboxEntry } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

function dateGroups(entries: OutboxEntry[]): { id: string; label: string; entries: OutboxEntry[] }[] {
  const groups = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    if (entry.state === 'failed') {
      continue;
    }
    const id = groupIdOf(entry.recordedAt);
    const group = groups.get(id);
    if (group) {
      group.push(entry);
    } else {
      groups.set(id, [entry]);
    }
  }

  return [...groups.values()].map((group) => ({
    id: groupIdOf(group[0].recordedAt),
    label: groupLabelOf(group[0].recordedAt),
    entries: group,
  }));
}

export default function EntriesScreen() {
  const { entries, loading } = useOutboxEntries();
  const summary = summaryOf(entries);
  const failed = entries.filter((entry) => entry.state === 'failed');
  const groups = dateGroups(entries);

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>{td('entries.title')}</Text>
        <Text style={styles.subtitle}>
          {td('entries.subtitle', { count: entries.length })}
        </Text>
      </View>

      {summary.waiting > 0 ? (
        <View style={styles.waitingBanner}>
          <Ionicons name="cloud-upload-outline" size={20} color={waitingColors.text} />
          <View style={styles.waitingText}>
            <Text style={styles.waitingTitle}>
              {td('entries.waitingTitle', { count: summary.waiting })}
            </Text>
            <Text style={styles.waitingBody}>{td('entries.waitingBody')}</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : null}

      {!loading && entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={28} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>{td('entries.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{td('entries.emptyBody')}</Text>
        </View>
      ) : null}

      {failed.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, styles.groupLabelAttention]}>
            {td('entries.group.attention')}
          </Text>
          {failed.map((entry) => (
            <EntryRow entry={entry} key={entry.id} />
          ))}
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
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
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
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
  groupLabelAttention: {
    color: '#9B1C1C',
  },
});
