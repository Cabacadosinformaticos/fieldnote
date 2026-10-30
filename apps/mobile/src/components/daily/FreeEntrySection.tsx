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
  return (
    <View style={[styles.card, main && styles.cardMain]}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{td('today.freeTitle')}</Text>
          <Text style={styles.body}>{td('today.freeBody')}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {activities.map((activity) => {
          const { disabled, reason } = availabilityOf(activity);

          return (
            <View key={activity.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.activity}>{activity.title}</Text>
                <Text style={styles.used}>{usedLabel(activity)}</Text>
                {reason ? <Text style={styles.reason}>{reason}</Text> : null}
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
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}
                >
                  {td('today.freeAction')}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={disabled ? colors.disabledText : colors.white}
                />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  cardMain: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },
  headerText: {
    minWidth: 0,
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowText: {
    gap: 2,
  },
  activity: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  used: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  reason: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: '#9B1C1C',
  },
  action: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  actionDisabled: {
    backgroundColor: colors.disabledBackground,
  },
  actionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.white,
  },
  actionLabelDisabled: {
    color: colors.disabledText,
  },
  pressed: {
    opacity: 0.82,
  },
});
