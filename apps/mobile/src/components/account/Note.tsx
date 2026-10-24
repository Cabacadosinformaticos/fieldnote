import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type NoteTone = 'default' | 'info' | 'warning';

const tones: Record<
  NoteTone,
  { background: string; border: string; color: string }
> = {
  default: {
    background: colors.surface,
    border: colors.divider,
    color: colors.textMuted,
  },
  info: {
    background: colors.primarySoft,
    border: colors.primarySoft,
    color: colors.primaryDark,
  },
  warning: {
    background: '#FFF3D6',
    border: '#F5D38A',
    color: '#5C3900',
  },
};

type NoteProps = {
  body: string;
  icon?: IoniconName;
  strong?: string;
  tone?: NoteTone;
};

export function Note({
  body,
  icon = 'eye-off-outline',
  strong,
  tone = 'default',
}: NoteProps) {
  const palette = tones[tone];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={palette.color}
        style={styles.icon}
      />
      <Text style={[styles.body, { color: palette.color }]}>
        {strong ? <Text style={styles.strong}>{strong}</Text> : null}
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
  },
  icon: {
    marginTop: 1,
  },
  body: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  strong: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
});
