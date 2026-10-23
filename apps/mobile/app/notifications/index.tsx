import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { StepProgress } from '@/components/join/StepProgress';
import { moreHref } from '@/components/more/navigation';
import { moreNotification } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export default function NotificationsScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <StepProgress filled={4} label={tm('notifications.step')} />

      <Text style={styles.title}>{tm('notifications.title')}</Text>

      <View style={styles.preview}>
        <Pressable
          accessibilityLabel={tm('notifications.sampleBody')}
          accessibilityRole="button"
          onPress={() =>
            router.push(moreHref(`/notifications/${moreNotification.id}`))
          }
          style={({ pressed }) => [
            styles.notification,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.notificationIcon}>
            <Ionicons name="leaf" size={18} color={colors.white} />
          </View>
          <View style={styles.notificationText}>
            <Text style={styles.notificationMeta}>
              {tm('notifications.sampleBrand')} · {tm('notifications.sampleWhen')}
            </Text>
            <Text style={styles.notificationBody}>
              {tm('notifications.sampleBody')}
            </Text>
          </View>
        </Pressable>
        <Text style={styles.caption}>{tm('notifications.sampleCaption')}</Text>
      </View>

      <View style={styles.reasons}>
        <InfoRow
          body={tm('notifications.reason1')}
          icon="shield-checkmark-outline"
        />
        <InfoRow body={tm('notifications.reason2')} icon="time-outline" />
        <InfoRow body={tm('notifications.reason3')} icon="notifications-outline" />
      </View>

      <View style={styles.spacer} />

      <Text style={styles.androidNote}>{tm('notifications.androidNote')}</Text>

      <View style={styles.actions}>
        <Button
          icon={
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.white}
            />
          }
          label={tm('notifications.allow')}
          onPress={() => router.replace('/(tabs)')}
        />
        <Button
          label={tm('notifications.notNow')}
          onPress={() => router.replace('/(tabs)')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  preview: {
    gap: spacing.md,
    borderRadius: radii.card,
    paddingVertical: 22,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primarySoft,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  pressed: {
    opacity: 0.8,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  notificationText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  notificationMeta: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  notificationBody: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textBody,
  },
  reasons: {
    gap: 14,
  },
  androidNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  actions: {
    gap: 10,
  },
  spacer: {
    flexGrow: 1,
  },
});
