import { StyleSheet, Text, View } from 'react-native';

import { ChoiceChip } from '@/components/account/ChoiceChip';
import { FieldLabel } from '@/components/account/FieldLabel';
import { colors, fonts, spacing } from '@/theme';

type ChoiceGroupProps = {
  label: string;
  onChange: (option: string) => void;
  options: readonly string[];
  value: string | readonly string[];
  hint?: string;
};

export function ChoiceGroup({
  label,
  onChange,
  options,
  value,
  hint,
}: ChoiceGroupProps) {
  return (
    <View style={styles.group}>
      <FieldLabel label={label} optional />
      <View style={styles.chips}>
        {options.map((option) => {
          const selected =
            typeof value === 'string'
              ? value === option
              : value.includes(option);

          return (
            <ChoiceChip
              key={option}
              label={option}
              onPress={() => onChange(option)}
              selected={selected}
            />
          );
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
