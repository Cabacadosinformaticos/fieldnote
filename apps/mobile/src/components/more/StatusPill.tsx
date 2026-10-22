import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

export type StatusTone = 'now' | 'active' | 'ended' | 'erasing';

const tones: Record<StatusTone, { background: string; color: string }> = {
  now: { background: colors.primarySoft, color: colors.primaryDark },
  active: { background: colors.successBackground, color: colors.successText },
  ended: { background: colors.disabledBackground, color: colors.textBody },
  erasing: { background: '#FDECEC', color: '#9B1C1C' },
};

type StatusPillProps = {
  tone: StatusTone;
  label: string;
};

export function StatusPill({ tone, label }: StatusPillProps) {
  const palette = tones[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
  },
});
