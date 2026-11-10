import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radii } from '@/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onDark?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Font size of the primary label; the record screens use 17. */
  labelSize?: number;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  onDark = false,
  icon,
  style,
  labelSize,
}: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        !isPrimary && onDark && styles.secondaryOnDark,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        numberOfLines={1}
        style={[
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          isPrimary && labelSize ? { fontSize: labelSize } : null,
          !isPrimary && onDark && styles.secondaryLabelOnDark,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  primary: {
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  secondary: {
    height: 52,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryOnDark: {
    backgroundColor: 'transparent',
    borderColor: colors.scanBorder,
  },
  disabled: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.82,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  secondaryLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  secondaryLabelOnDark: {
    color: colors.white,
  },
  disabledLabel: {
    color: colors.disabledText,
  },
});
