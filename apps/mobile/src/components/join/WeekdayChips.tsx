import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { JoinKey } from '@/i18n/join';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii } from '@/theme';

const SHORT_KEYS = [
  'weekday.mon',
  'weekday.tue',
  'weekday.wed',
  'weekday.thu',
  'weekday.fri',
  'weekday.sat',
  'weekday.sun',
] as const satisfies readonly JoinKey[];

const FULL_KEYS = [
  'weekday.monFull',
  'weekday.tueFull',
  'weekday.wedFull',
  'weekday.thuFull',
  'weekday.friFull',
  'weekday.satFull',
  'weekday.sunFull',
] as const satisfies readonly JoinKey[];

export function formatDays(days: readonly boolean[]): string {
  const key = days.map((day) => (day ? '1' : '0')).join('');

  if (key === '1111111') {
    return tj('availability.daysEvery');
  }
  if (key === '1111100') {
    return tj('availability.daysWeekdays');
  }
  if (key === '0000011') {
    return tj('availability.daysWeekend');
  }

  const names = FULL_KEYS.flatMap((weekday, index) =>
    days[index] ? [tj(weekday)] : [],
  );

  return names.length > 0 ? names.join(', ') : tj('availability.daysNone');
}

type WeekdayChipsProps = {
  days: readonly boolean[];
  onToggle?: (index: number) => void;
  variant?: 'display' | 'input';
};

export function WeekdayChips({
  days,
  onToggle,
  variant = 'display',
}: WeekdayChipsProps) {
  const chipStyle = variant === 'input' ? styles.chipInput : styles.chipDisplay;

  if (!onToggle) {
    return (
      <View
        accessible
        accessibilityLabel={formatDays(days)}
        accessibilityRole="text"
        style={styles.row}
      >
        {SHORT_KEYS.map((key, index) => (
          <View
            key={key}
            style={[styles.chip, chipStyle, days[index] ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.label, days[index] && styles.labelOn]}>{tj(key)}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {SHORT_KEYS.map((key, index) => (
        <Pressable
          key={key}
          accessibilityLabel={tj(FULL_KEYS[index])}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: days[index] }}
          onPress={() => onToggle(index)}
          style={[styles.chip, chipStyle, days[index] ? styles.chipOn : styles.chipOff]}
        >
          <Text style={[styles.label, days[index] && styles.labelOn]}>{tj(key)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  chipDisplay: {
    height: 40,
  },
  chipInput: {
    height: 48,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipOff: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  labelOn: {
    color: colors.white,
  },
});
