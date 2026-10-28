import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/daily/SyncStatus';
import { captureTypeIcons, captureTypeLabelKeys } from '@/components/daily/captureType';
import {
  clockOf,
  longDateToday,
} from '@/components/daily/entryFormat';
import { td } from '@/i18n/td';
import { startNotifications } from '@/notifications';
import { startQueue } from '@/queue';
import { loadTodayPrompts } from '@/queue/prompts';
import type { PromptActivity } from '@/queue/types';
import type { Participation } from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

function utcDate(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function studyLine(participation: Participation | undefined, active: boolean): string {
  if (!participation) {
    return td('today.studyLine', { study: '' });
  }
  if (!active) {
    return td('today.studyPending', { study: participation.title });
  }

  const start = utcDate(participation.startsOn);
  const end = utcDate(participation.endsOn);
  if (start === null || end === null || end < start) {
    return td('today.studyLine', { study: participation.title });
  }

  const total = Math.round((end - start) / 86_400_000) + 1;
  const day = Math.min(
    Math.max(Math.floor((todayUtc() - start) / 86_400_000) + 1, 1),
    total,
  );
  return td('today.studyDay', {
    study: participation.title,
    day,
    total,
  });
}

function requestedAt(activity: PromptActivity): string {
  if (activity.sentAt) {
    return td('today.requestAsked', { time: clockOf(activity.sentAt) });
  }
  if (activity.scheduledAt) {
    return td('today.requestScheduled', {
      time: clockOf(activity.scheduledAt),
    });
  }
  return td('today.requestOpen');
}

function typeLabels(activity: PromptActivity): string {
  if (activity.captureTypes.length === 0) {
    return td('today.unsupportedTypes');
  }
  return activity.captureTypes
    .map((type) => td(captureTypeLabelKeys[type]))
    .join(td('common.listOr'));
}

export default function TodayScreen() {
  const [activities, setActivities] = useState<PromptActivity[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await loadTodayPrompts();
      setActivities(result.activities);
      setParticipations(result.participations);
      setOffline(result.offline);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startQueue();
    startNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const active = participations.filter(
    (participation) => participation.status === 'active',
  );
  const primaryParticipation = active[0] ?? participations[0];
  const primary = activities[0];
  const others = activities.slice(1);

  const openActivity = (activity: PromptActivity) => {
    if (activity.captureTypes.length === 0) {
      return;
    }
    router.push({
      pathname: '/record/[activityId]',
      params: { activityId: activity.id },
    });
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.studyLine}>
            {studyLine(primaryParticipation, active.length > 0)}
          </Text>
          <Text style={styles.title}>{td('today.title')}</Text>
          <Text style={styles.date}>{longDateToday()}</Text>
        </View>
        <SyncStatus />
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.loadingText}>{td('today.loading')}</Text>
        </View>
      ) : null}

      {!loading && participations.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf-outline" size={28} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>{td('today.noStudyTitle')}</Text>
          <Text style={styles.emptyBody}>{td('today.noStudyBody')}</Text>
          <Button
            label={td('today.enterStudy')}
            onPress={() => router.push('/join/code')}
          />
        </View>
      ) : null}

      {!loading && participations.length > 0 && !primary ? (
        <View style={styles.noRequestCard}>
          <View style={styles.noRequestIcon}>
            <Ionicons
              name={
                active.length > 0
                  ? 'notifications-outline'
                  : 'hourglass-outline'
              }
              size={24}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.noRequestText}>
            <Text style={styles.noRequestTitle}>
              {active.length > 0
                ? td('today.noRequestTitle')
                : td('today.pendingTitle')}
            </Text>
            <Text style={styles.noRequestBody}>
              {active.length > 0
                ? td('today.noRequestBody')
                : td('today.pendingBody')}
            </Text>
          </View>
        </View>
      ) : null}

      {primary ? (
        <>
          <View style={styles.requestCard}>
            <Text style={styles.asked}>{requestedAt(primary)}</Text>
            <Text style={styles.requestTitle}>{primary.title}</Text>
            <Text style={styles.requestBody}>
              {primary.instructions || td('record.noInstructions')}
            </Text>

            <View style={styles.spacer} />

            <View style={styles.meta}>
              <View style={styles.metaRow}>
                <Ionicons
                  name={
                    primary.captureTypes[0]
                      ? captureTypeIcons[primary.captureTypes[0]]
                      : 'help-circle-outline'
                  }
                  size={20}
                  color={colors.white}
                />
                <Text style={styles.metaText}>
                  {td('today.requestMeta', {
                    types: typeLabels(primary),
                    minutes: primary.expectedMinutes,
                  })}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={20} color={colors.white} />
                <Text style={[styles.metaText, styles.metaTextStrong]}>
                  {td('today.closesAt', { time: clockOf(primary.closesAt) })}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: primary.captureTypes.length === 0,
              }}
              disabled={primary.captureTypes.length === 0}
              onPress={() => openActivity(primary)}
              style={({ pressed }) => [
                styles.answerButton,
                primary.captureTypes.length === 0 && styles.answerDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.answerLabel}>
                {primary.captureTypes.length === 0
                  ? td('today.unsupportedAnswer')
                  : td('today.answerNow')}
              </Text>
              <Ionicons name="arrow-forward" size={22} color={colors.text} />
            </Pressable>
          </View>

          {others.length > 0 ? (
            <View style={styles.otherCard}>
              <Text style={styles.otherTitle}>
                {td('today.otherPrompts', { count: others.length })}
              </Text>
              {others.map((activity) => (
                <Pressable
                  accessibilityRole="button"
                  key={activity.promptId}
                  onPress={() => openActivity(activity)}
                  style={({ pressed }) => [
                    styles.otherRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.otherText}>
                    <Text numberOfLines={1} style={styles.otherName}>
                      {activity.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.otherStudy}>
                      {td('today.fromStudy', {
                        study: activity.studyTitle,
                        types: typeLabels(activity),
                      })}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {offline ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void load();
          }}
          style={({ pressed }) => [styles.offlineCard, pressed && styles.pressed]}
        >
          <Ionicons name="cloud-offline-outline" size={20} color={colors.textBody} />
          <Text style={styles.offlineText}>{td('today.offline')}</Text>
          <Text style={styles.offlineRetry}>{td('today.retry')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  studyLine: {
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
  date: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  loadingCard: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  requestCard: {
    minHeight: 360,
    paddingTop: spacing.xxl,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderRadius: radii.hero,
    backgroundColor: colors.primaryDark,
  },
  asked: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
    opacity: 0.85,
  },
  requestTitle: {
    marginTop: 14,
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: colors.white,
  },
  requestBody: {
    marginTop: 14,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 27,
    color: colors.white,
    opacity: 0.95,
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing.xl,
  },
  meta: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
    opacity: 0.95,
  },
  metaTextStrong: {
    fontFamily: fonts.bold,
  },
  answerButton: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
  },
  answerDisabled: {
    opacity: 0.5,
  },
  answerLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  otherCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  otherTitle: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  otherRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  otherText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  otherName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  otherStudy: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  noRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.primarySoft,
  },
  noRequestIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  noRequestText: {
    flex: 1,
    gap: 2,
  },
  noRequestTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  noRequestBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textBody,
  },
  emptyCard: {
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  offlineText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textBody,
  },
  offlineRetry: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.82,
  },
});
