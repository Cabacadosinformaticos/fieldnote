import { StyleSheet, Text, View } from 'react-native';

import type { DailyTranslationKey } from '@/i18n/daily';
import { td } from '@/i18n/td';
import type { OutboxState } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

type DisplayStatus = 'sent' | 'waiting' | 'failed';

const presentation: Record<
  DisplayStatus,
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

function displayStatus(state: OutboxState): DisplayStatus {
  if (state === 'sent') {
    return 'sent';
  }
  if (state === 'failed') {
    return 'failed';
  }
  return 'waiting';
}

type EntryStatusPillProps = {
  state: OutboxState;
};

export function EntryStatusPill({ state }: EntryStatusPillProps) {
  const item = presentation[displayStatus(state)];

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
