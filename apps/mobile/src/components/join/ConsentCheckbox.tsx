import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

type ConsentCheckboxProps = {
  checked: boolean;
  label: string;
  onToggle: () => void;
};

export function ConsentCheckbox({ checked, label, onToggle }: ConsentCheckboxProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm - 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  label: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
});
