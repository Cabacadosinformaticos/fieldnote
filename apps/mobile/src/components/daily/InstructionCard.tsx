import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WarningSheet } from '@/components/daily/WarningSheet';
import { td } from '@/i18n/td';
import type { WarningId } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

type InstructionCardProps = {
  instruction: string;
  warnings: WarningId[];
};

export function InstructionCard({ instruction, warnings }: InstructionCardProps) {
  const [warningsOpen, setWarningsOpen] = useState(false);

  const warningsLabel =
    warnings.length === 1
      ? td('warning.countOne')
      : td('warning.count', { count: warnings.length });

  return (
    <View style={[styles.card, warnings.length === 0 && styles.cardNoWarnings]}>
      <Text style={styles.eyebrow}>{td('record.requested')}</Text>
      <Text style={styles.instruction}>{instruction}</Text>

      {warnings.length > 0 ? (
        <Pressable
          accessibilityLabel={warningsLabel}
          accessibilityRole="button"
          onPress={() => setWarningsOpen(true)}
          style={({ pressed }) => [styles.warningsRow, pressed && styles.pressed]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.warningsLabel}>{warningsLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
        </Pressable>
      ) : null}

      <WarningSheet
        onClose={() => setWarningsOpen(false)}
        visible={warningsOpen}
        warnings={warnings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    paddingTop: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  cardNoWarnings: {
    paddingBottom: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  instruction: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 29,
    color: colors.text,
  },
  warningsRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  warningsLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.7,
  },
});
