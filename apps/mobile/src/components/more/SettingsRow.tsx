import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type SettingsRowProps = {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  divider?: boolean;
  trailing?: ReactNode;
};

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  divider = false,
  trailing,
}: SettingsRowProps) {
  const content = (
    <>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? '#9B1C1C' : colors.textMuted}
      />
      <View style={styles.text}>
        <Text style={[styles.title, danger && styles.titleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={danger ? '#9B1C1C' : colors.textMuted}
        />
      )}
    </>
  );

  const rowStyle = [styles.row, divider && styles.divider];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  titleDanger: {
    color: '#9B1C1C',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
