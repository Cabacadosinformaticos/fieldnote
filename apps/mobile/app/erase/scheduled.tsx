import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { moreErasures } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export default function EraseScheduledScreen() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const isAll = scope === 'all';
  const erasure = moreErasures[isAll ? 'all' : 'study'];

  const cancel = () => {
    router.replace(isAll ? '/(tabs)' : '/(tabs)/studies');
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {isAll
            ? tm('scheduled.eyebrowAll')
            : tm('scheduled.eyebrow', {
                study: erasure.studyName ?? '',
              })}
        </Text>
        <Text style={styles.title}>{tm('scheduled.title')}</Text>
      </View>

      <View style={styles.alertCard}>
        <Text style={styles.requested}>
          <Ionicons name="trash-outline" size={18} color="#9B1C1C" />{' '}
          {tm('scheduled.requestedAt', { time: erasure.requestedTime })}
        </Text>
        <Text style={styles.alertTitle}>
          {isAll
            ? tm('scheduled.headingAll', {
                date: erasure.date,
                time: erasure.time,
              })
            : tm('scheduled.heading', {
                date: erasure.date,
                time: erasure.time,
              })}
        </Text>
        <Text style={styles.alertBody}>{tm('scheduled.body')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm('scheduled.whatTitle')}</Text>
        <InfoRow
          body={tm('scheduled.whatB1')}
          icon="eye-off-outline"
          title={tm('scheduled.what1Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB2', {
            date: erasure.date,
            time: erasure.time,
          })}
          icon="calendar-outline"
          title={tm('scheduled.what2Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB3')}
          icon="cube-outline"
          title={tm('scheduled.what3Title')}
        />
        <InfoRow
          body={tm('scheduled.whatB4')}
          icon="cloud-upload-outline"
          title={tm('scheduled.what4Title')}
        />
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={cancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cancelLabel}>{tm('scheduled.cancel')}</Text>
        </Pressable>
        <Text style={styles.cancelNote}>{tm('scheduled.cancelNote')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  alertCard: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#EDB4B4',
    padding: 18,
    backgroundColor: '#FDECEC',
  },
  requested: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: '#9B1C1C',
  },
  alertTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  alertBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  card: {
    gap: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  cancelButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.white,
  },
  cancelNote: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
