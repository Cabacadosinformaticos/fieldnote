import { StyleSheet, Text, View } from 'react-native';

import { tj } from '@/i18n/tj';
import { colors, fonts } from '@/theme';

type StepProgressProps = {
  filled: number;
  total?: number;
  label: string;
};

export function StepProgress({ filled, total = 4, label }: StepProgressProps) {
  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={tj('step.accessibility', { step: filled, total })}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: filled }}
        style={styles.bars}
      >
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.bar, index < filled && styles.barFilled]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  barFilled: {
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
