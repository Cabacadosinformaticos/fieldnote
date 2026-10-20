import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

type PillProps = PropsWithChildren<{
  tone?: 'neutral' | 'primary' | 'onDark' | 'success';
  icon?: ReactNode;
}>;

const toneStyles = {
  neutral: {
    backgroundColor: colors.surface,
    color: colors.textMuted,
  },
  primary: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
  onDark: {
    backgroundColor: colors.scanPill,
    color: colors.white,
  },
  success: {
    backgroundColor: colors.successBackground,
    color: colors.successText,
  },
} as const;

export function Pill({ children, tone = 'neutral', icon }: PillProps) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }]}>
      {icon}
      <Text style={[styles.label, { color: palette.color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
});
