import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { td } from '@/i18n/td';
import type { FreeEntryActivity } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

type FreeEntrySectionProps = {
  activities: FreeEntryActivity[];
  main: boolean;
  onOpen: (activity: FreeEntryActivity) => void;
};

type Availability = {
  disabled: boolean;
  reason: string | null;
};

function availabilityOf(activity: FreeEntryActivity): Availability {
  const capReached =
    activity.maxFreeEntriesPerDay !== null &&
    activity.freeEntriesUsedToday >= activity.maxFreeEntriesPerDay;

  if (capReached) {
    return { disabled: true, reason: td('today.freeLimitReached') };
  }
  if (activity.captureTypes.length === 0) {
    return { disabled: true, reason: td('today.freeUnsupported') };
  }

  return { disabled: false, reason: null };
}

function usedLabel(activity: FreeEntryActivity): string {
  if (activity.maxFreeEntriesPerDay === null) {
    return td('today.freeNoLimit');
  }

  return td('today.freeUsed', {
    used: activity.freeEntriesUsedToday,
    max: activity.maxFreeEntriesPerDay,
  });
}

export function FreeEntrySection({ activities, main, onOpen }: FreeEntrySectionProps) {
  const activity =
    activities.find((item) => !availabilityOf(item).disabled) ?? activities[0];

  if (!activity) {
    return null;
  }

  const { disabled, reason } = availabilityOf(activity);

  if (main) {
    return (
      <View style={[styles.card, styles.cardMain]}>
        <View style={styles.iconMain}>
          <Ionicons name="create-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.titleMain}>{td('today.freeTitle')}</Text>
        <Text style={styles.bodyMain}>{td('today.freeBody')}</Text>
        <View style={styles.spacer} />
        <Text style={styles.usedMain}>{usedLabel(activity)}</Text>
        <Pressable
          accessibilityLabel={`${td('today.freeAction')}: ${activity.title}`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onOpen(activity)}
          style={({ pressed }) => [
            styles.actionMain,
            disabled && styles.actionDisabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Ionicons
            name="add"
            size={22}
            color={disabled ? colors.disabledText : colors.white}
          />
          <Text
            style={[
              styles.actionMainLabel,
              disabled && styles.actionLabelDisabled,
            ]}
          >
            {td('today.freeAction')}
          </Text>
        </Pressable>
        {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.cardSecondary]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{td('today.freeTitle')}</Text>
        <Text style={styles.used}>{usedLabel(activity)}</Text>
      </View>
      <Pressable
        accessibilityLabel={`${td('today.freeAction')}: ${activity.title}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onOpen(activity)}
        style={({ pressed }) => [
          styles.action,
          disabled && styles.actionDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Ionicons
          name="add"
          size={20}
          color={disabled ? colors.disabledText : colors.white}
        />
        <Text
          style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}
        >
          {td('today.freeAction')}
        </Text>
      </Pressable>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  // The 30 of the 70/30 share with the open request on Today.
  cardSecondary: {
    flexGrow: 3,
    flexBasis: 0,
    minHeight: 150,
    justifyContent: 'center',
  },
  cardMain: {
    gap: 14,
    paddingVertical: spacing.xxl,
    paddingHorizontal: 22,
    borderRadius: radii.hero,
  },
  iconMain: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  titleMain: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: colors.text,
  },
  bodyMain: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 27,
    color: colors.textBody,
  },
  used: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  usedMain: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  reason: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: '#9B1C1C',
  },
  action: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  actionMain: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  actionDisabled: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.disabledBackground,
  },
  actionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  actionMainLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.white,
  },
  actionLabelDisabled: {
    color: colors.disabledText,
  },
  pressed: {
    opacity: 0.82,
  },
});
