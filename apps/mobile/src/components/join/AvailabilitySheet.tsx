import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TimeWheel } from '@/components/join/TimeWheel';
import { WeekdayChips } from '@/components/join/WeekdayChips';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing } from '@/theme';

export type AvailabilityDraft = {
  from: number;
  to: number;
  days: boolean[];
};

type AvailabilitySheetProps = {
  mode: 'new' | 'edit';
  initial: AvailabilityDraft;
  onClose: () => void;
  onSave: (draft: AvailabilityDraft) => void;
};

export function AvailabilitySheet({
  mode,
  initial,
  onClose,
  onSave,
}: AvailabilitySheetProps) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [days, setDays] = useState(initial.days);

  const toggleDay = (index: number) => {
    setDays((current) =>
      current.map((day, position) => (position === index ? !day : day)),
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={tj('availability.closeSheet')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel={
            mode === 'new' ? tj('availability.sheetNew') : tj('availability.sheetEdit')
          }
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'new'
                ? tj('availability.sheetNew')
                : tj('availability.sheetEdit')}
            </Text>
            <Pressable
              accessibilityLabel={tj('availability.closeSheet')}
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.wheels}>
            <View style={styles.wheelColumn}>
              <Text style={styles.wheelLabel}>{tj('availability.start')}</Text>
              <TimeWheel
                accessibilityLabel={tj('availability.start')}
                onChange={setFrom}
                value={from}
              />
            </View>
            <View style={styles.wheelColumn}>
              <Text style={styles.wheelLabel}>{tj('availability.end')}</Text>
              <TimeWheel
                accessibilityLabel={tj('availability.end')}
                onChange={setTo}
                value={to}
              />
            </View>
          </View>

          <View style={styles.daysBlock}>
            <Text style={styles.daysLabel}>{tj('availability.weekdays')}</Text>
            <WeekdayChips days={days} onToggle={toggleDay} variant="input" />
          </View>

          <Button
            label={tj('availability.save')}
            onPress={() => onSave({ from, to, days })}
            style={styles.save}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    gap: spacing.lg,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    paddingTop: 10,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  wheelColumn: {
    flex: 1,
    gap: 6,
  },
  wheelLabel: {
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  daysBlock: {
    gap: spacing.sm,
  },
  daysLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  save: {
    width: '100%',
  },
});
