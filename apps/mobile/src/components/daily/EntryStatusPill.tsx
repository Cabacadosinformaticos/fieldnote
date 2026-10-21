import { StyleSheet, Text, View } from 'react-native';

import type { EntryStatus } from '@/fake/daily';
import { td, type DailyTranslationKey } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const presentation: Record<
  EntryStatus,
  { labelKey: DailyTranslationKey; background: string; color: string }
> = {
  sent: {
    labelKey: 'entry.status.sent',
    background: colors.successBackground,
    color: colors.successText,
  },
  waiting: {
    labelKey: 'entry.status.waiting',
    background: '#FFF3D6',
    color: '#5C3900',
  },
  failed: {
    labelKey: 'entry.status.failed',
    background: '#FDECEC',
    color: '#9B1C1C',
  },
};

type EntryStatusPillProps = {
  status: EntryStatus;
};

export function EntryStatusPill({ status }: EntryStatusPillProps) {
  const item = presentation[status];

  return (
    <View style={[styles.pill, { backgroundColor: item.background }]}>
      <Text style={[styles.label, { color: item.color }]}>{td(item.labelKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
  },
});
