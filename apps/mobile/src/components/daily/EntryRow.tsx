import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EntryStatusPill } from '@/components/daily/EntryStatusPill';
import { captureTypeIcons } from '@/components/daily/captureType';
import type { DailyEntry } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

type EntryRowProps = {
  entry: DailyEntry;
};

export function EntryRow({ entry }: EntryRowProps) {
  const when = entry.recordedDate
    ? td('entries.recordedOn', { date: entry.recordedDate, time: entry.recordedTime })
    : td('entries.recordedAt', { time: entry.recordedTime });

  const isPhoto = entry.type === 'photo';
  const failed = entry.status === 'failed';

  return (
    <View style={[styles.card, failed && styles.cardFailed]}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/entry/[id]', params: { id: entry.id } })
        }
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.tile, isPhoto ? styles.tilePhoto : styles.tileLight]}>
          {entry.type === 'scale' ? (
            <Text style={styles.scaleValue}>{entry.scaleValue}</Text>
          ) : (
            <Ionicons
              name={captureTypeIcons[entry.type]}
              size={22}
              color={isPhoto ? colors.white : colors.primaryDark}
            />
          )}
        </View>

        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {td(entry.titleKey)}
          </Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.when}>
              {when}
            </Text>
            <EntryStatusPill status={entry.status} />
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {failed && entry.failureKey ? (
        <View style={styles.failure}>
          <Ionicons name="warning-outline" size={18} color="#9B1C1C" />
          <Text style={styles.failureText}>{td(entry.failureKey)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  cardFailed: {
    borderColor: '#EDB4B4',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  tile: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  tilePhoto: {
    backgroundColor: '#2E6B4F',
  },
  tileLight: {
    backgroundColor: colors.primarySoft,
  },
  scaleValue: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.primaryDark,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  when: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  failure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: '#FDECEC',
  },
  failureText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: '#9B1C1C',
  },
});
