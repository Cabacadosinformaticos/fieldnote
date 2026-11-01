import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sparkles } from '@/components/daily/Sparkles';
import { td } from '@/i18n/td';
import { useOutboxEntries, useOutboxEntry } from '@/queue/hooks';
import { summaryOf } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

export default function SavedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const progress = useAnimatedValue(0);
  const { entries, loading: listLoading } = useOutboxEntries();
  const { entry: savedEntry, loading: entryLoading } = useOutboxEntry(id);
  const summary = summaryOf(entries);
  // The record just saved is identified by id: the newest queued entry is not necessarily it.
  const latest = id ? savedEntry : entries[0];
  const ready = id ? !entryLoading : !listLoading;
  const failed = latest?.state === 'failed';
  const sent =
    ready &&
    (latest?.state === 'sent' || (!latest && !id && summary.waiting === 0));

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) {
          return;
        }

        if (reduceMotion) {
          progress.setValue(1);
          return;
        }

        Animated.timing(progress, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => progress.setValue(1));

    return () => {
      mounted = false;
    };
  }, [progress]);

  const heroStyle = {
    opacity: progress,
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.main}>
        <Animated.View
          accessibilityLabel={td('saved.celebrationLabel')}
          accessibilityRole="image"
          style={[styles.hero, heroStyle]}
        >
          <Sparkles />
          <View style={styles.check}>
            <Ionicons name="checkmark" size={44} color={colors.successText} />
          </View>
        </Animated.View>

        {ready ? (
          <>
            <Text style={styles.title}>
              {failed
                ? td('saved.failedTitle')
                : sent
                  ? td('saved.sentTitle')
                  : td('saved.title')}
            </Text>
            <Text style={styles.body}>
              {failed
                ? td('saved.failedBody')
                : sent
                  ? td('saved.sentBody')
                  : td('saved.body')}
            </Text>

            {failed ? (
              <View style={styles.failedCard}>
                <Ionicons name="warning-outline" size={22} color="#9B1C1C" />
                <Text style={styles.failedText}>{td('saved.failedBody')}</Text>
              </View>
            ) : sent ? (
              <View style={styles.sentCard}>
                <Ionicons
                  name="cloud-done-outline"
                  size={22}
                  color={colors.successText}
                />
                <Text style={styles.sentText}>{td('saved.sentBody')}</Text>
              </View>
            ) : (
              <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                  <View style={styles.statusIcon}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={24}
                      color={waitingColors.text}
                    />
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{summary.waiting}</Text>
                    </View>
                  </View>
                  <Text style={styles.statusTitle}>
                    {td('saved.waiting', { count: summary.waiting })}
                  </Text>
                </View>

                <Text style={styles.warningText}>{td('saved.warning')}</Text>
                <Text style={styles.statusNote}>{td('saved.note')}</Text>
              </View>
            )}
          </>
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          label={td('saved.seeEntries')}
          onPress={() => router.replace('/(tabs)/entries')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.backToday, pressed && styles.pressed]}
        >
          <Text style={styles.backTodayLabel}>{td('saved.backToday')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.huge,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  main: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  hero: {
    width: 280,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.lg,
    marginBottom: -spacing.xs,
  },
  check: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    backgroundColor: colors.successBackground,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.text,
  },
  body: {
    marginTop: -spacing.md,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.text,
  },
  statusCard: {
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
  },
  statusBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.accent,
  },
  statusBadgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
    color: '#131A2A',
  },
  statusTitle: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  warningText: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: waitingColors.text,
  },
  statusNote: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  failedCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EDB4B4',
    backgroundColor: '#FDECEC',
  },
  failedText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#7A1A1A',
  },
  sentCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.successBackground,
    backgroundColor: colors.successBackground,
  },
  sentText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.successText,
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    gap: spacing.sm,
  },
  backToday: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTodayLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.7,
  },
});
