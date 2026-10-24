import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLabel } from '@/components/account/FieldLabel';
import { colors, fonts, radii } from '@/theme';

type FieldSelectProps = {
  label: string;
  onPress: () => void;
  value: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  required?: boolean;
};

export function FieldSelect({
  label,
  onPress,
  value,
  hint,
  optional = false,
  placeholder,
  required = false,
}: FieldSelectProps) {
  return (
    <View style={styles.group}>
      <FieldLabel label={label} optional={optional} required={required} />
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityValue={{ text: value }}
        onPress={onPress}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || placeholder || ''}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.text} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  field: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  value: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
