import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate } from '@/components/join/format';
import { StatusPill } from '@/components/more/StatusPill';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export type StudyCardState =
  | 'active'
  | 'pending'
  | 'withdrawn'
  | 'removed'
  | 'erasing'
  | 'ended'
  | 'declined';

export type StudyCardModel = {
  id: string;
  title: string;
  state: StudyCardState;
  erasureDueAt?: string | null;
  endsOn?: string | null;
};

type StudyCardProps = {
  study: StudyCardModel;
  onOpen: () => void;
  onDetails: () => void;
};

function metaFor(study: StudyCardModel): string {
  switch (study.state) {
    case 'erasing':
      return tm('studies.erasingNote');
    case 'ended':
      return study.endsOn
        ? tm('studies.endedOn', { date: formatDate(study.endsOn) })
        : tm('studies.ended');
    case 'pending':
      return tm('studies.pendingNote');
    case 'withdrawn':
      return tm('studies.withdrawnNote');
    case 'removed':
      return tm('studies.removedNote');
    case 'declined':
      return tm('studies.declinedNote');
    default:
      return tm('studies.activeNote');
  }
}

export function StudyCard({ study, onOpen, onDetails }: StudyCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={study.title}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={styles.title}>{study.title}</Text>

          <View style={styles.pills}>
            {study.state === 'active' ? (
              <StatusPill label={tm('studies.active')} tone="active" />
            ) : null}
            {study.state === 'pending' ? (
              <StatusPill label={tm('studies.pending')} tone="now" />
            ) : null}
            {study.state === 'withdrawn' ? (
              <StatusPill label={tm('studies.withdrawn')} tone="ended" />
            ) : null}
            {study.state === 'removed' ? (
              <StatusPill label={tm('studies.removed')} tone="erasing" />
            ) : null}
            {study.state === 'declined' ? (
              <StatusPill label={tm('studies.declined')} tone="ended" />
            ) : null}
            {study.state === 'ended' ? (
              <StatusPill label={tm('studies.ended')} tone="ended" />
            ) : null}
            {study.state === 'erasing' ? (
              <>
                <StatusPill label={tm('studies.ended')} tone="ended" />
                <StatusPill
                  label={tm('studies.erasing', {
                    date: study.erasureDueAt
                      ? formatDate(study.erasureDueAt)
                      : '',
                  })}
                  tone="erasing"
                />
              </>
            ) : null}
          </View>

          <View style={styles.meta}>
            {study.state === 'active' ? <View style={styles.dot} /> : null}
            <Text
              numberOfLines={2}
              style={[
                styles.metaText,
                study.state !== 'active' && styles.metaTextMuted,
              ]}
            >
              {metaFor(study)}
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
