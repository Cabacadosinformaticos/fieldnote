import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EntryStatusPill } from '@/components/daily/EntryStatusPill';
import { captureTypeIcons } from '@/components/daily/captureType';
import { formatRecorded } from '@/components/daily/entryFormat';
import { td } from '@/i18n/td';
import type { OutboxEntry } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

type EntryRowProps = {
  entry: OutboxEntry;
};

export function EntryRow({ entry }: EntryRowProps) {
  const isPhoto = entry.entryType === 'photo';
  const failed = entry.state === 'failed';
  const scaleValue = entry.payload.value;

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
          {entry.entryType === 'scale' ? (
            <Text style={styles.scaleValue}>{scaleValue ?? '–'}</Text>
          ) : (
            <Ionicons
              name={captureTypeIcons[entry.entryType]}
              size={22}
              color={isPhoto ? colors.white : colors.primaryDark}
            />
          )}
        </View>

        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {entry.activityTitle}
          </Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.when}>
              {formatRecorded(entry.recordedAt)}
            </Text>
            <EntryStatusPill state={entry.state} />
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {failed ? (
        <View style={styles.failure}>
          <Ionicons name="warning-outline" size={18} color="#9B1C1C" />
          <Text style={styles.failureText}>{td('entries.failed')}</Text>
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
