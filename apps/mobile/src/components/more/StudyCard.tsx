import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/more/StatusPill';
import type { Study } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

type StudyCardProps = {
  study: Study;
  onOpen: () => void;
  onDetails: () => void;
};

export function StudyCard({ study, onOpen, onDetails }: StudyCardProps) {
  const meta =
    study.status === 'erasing'
      ? tm('studies.erasingNote')
      : study.openUntil
        ? tm('studies.openRequestUntil', { time: study.openUntil })
        : tm('studies.openRequest');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={study.name}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={styles.title}>{study.name}</Text>

          <View style={styles.pills}>
            {study.isNow ? (
              <StatusPill label={tm('studies.now')} tone="now" />
            ) : null}
            {study.status === 'active' ? (
              <StatusPill label={tm('studies.active')} tone="active" />
            ) : null}
            {study.status === 'ended' || study.status === 'erasing' ? (
              <StatusPill label={tm('studies.ended')} tone="ended" />
            ) : null}
            {study.status === 'erasing' && study.eraseDate ? (
              <StatusPill
                label={tm('studies.erasing', { date: study.eraseDate })}
                tone="erasing"
              />
            ) : null}
          </View>

          <View style={styles.meta}>
            {study.status === 'active' ? <View style={styles.dot} /> : null}
            <Text
              numberOfLines={2}
              style={[
                styles.metaText,
                study.status === 'erasing' && styles.metaTextMuted,
              ]}
            >
              {meta}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable
        accessibilityLabel={tm('studies.details')}
        accessibilityRole="button"
        onPress={onDetails}
        style={({ pressed }) => [styles.details, pressed && styles.pressed]}
      >
        <Text style={styles.detailsLabel}>{tm('studies.details')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: 14,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    minWidth: 0,
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  meta: {
    minHeight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  metaText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  metaTextMuted: {
    color: colors.textMuted,
  },
  details: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  detailsLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.primaryDark,
  },
});
