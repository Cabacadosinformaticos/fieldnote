import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/daily/SyncStatus';
import { captureTypeIcons, captureTypeLabelKeys } from '@/components/daily/captureType';
import { dailyStudy, dailyToday, getActivity } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

export default function TodayScreen() {
  const request = dailyToday.request;
  const requestActivity = request ? getActivity(request.activityId) : undefined;
  const freeActivity = getActivity('moment');
  const freeCapped = dailyToday.freeEntry.used >= dailyToday.freeEntry.cap;

  const requestTypes = requestActivity
    ? requestActivity.captureTypes
        .map((type) => td(captureTypeLabelKeys[type]))
        .join(td('common.listOr'))
    : '';

  const openFreeEntry = () => {
    if (freeActivity) {
      router.push({
        pathname: '/record/[activityId]',
        params: { activityId: freeActivity.id },
      });
    }
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']} scroll={false}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.studyLine}>
            {td('today.studyDay', {
              study: dailyStudy.name,
              day: dailyStudy.day,
              total: dailyStudy.totalDays,
            })}
          </Text>
          <Text style={styles.title}>{td('today.title')}</Text>
          <Text style={styles.date}>{td('today.date')}</Text>
        </View>
        <SyncStatus />
      </View>

      <View style={styles.main}>
        {request && requestActivity ? (
          <>
            <View style={styles.requestCard}>
              <Text style={styles.asked}>
                {td('today.requestAsked', { time: request.askedAt })}
              </Text>
              <Text style={styles.requestTitle}>{td(requestActivity.titleKey)}</Text>
              <Text style={styles.requestBody}>{td(requestActivity.instructionKey)}</Text>

              <View style={styles.spacer} />

              <View style={styles.meta}>
                <View style={styles.metaRow}>
                  <Ionicons
                    name={captureTypeIcons[requestActivity.captureTypes[0]]}
                    size={20}
                    color={colors.white}
                  />
                  <Text style={styles.metaText}>
                    {td('today.requestMeta', {
                      types: requestTypes,
                      minutes: requestActivity.expectedMinutes,
                    })}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={20} color={colors.white} />
                  <Text style={[styles.metaText, styles.metaTextStrong]}>
                    {td('today.closesAt', { time: requestActivity.closesAt })}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/record/[activityId]',
                    params: { activityId: requestActivity.id },
                  })
                }
                style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
              >
                <Text style={styles.answerLabel}>{td('today.answerNow')}</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.freeCard}>
              <View style={styles.freeHeader}>
                <Text style={styles.freeTitle}>{td('today.freeTitle')}</Text>
                <Text style={styles.freeCount}>
                  {td('today.freeUsed', {
                    used: dailyToday.freeEntry.used,
                    cap: dailyToday.freeEntry.cap,
                  })}
                </Text>
              </View>

              <Button
                disabled={freeCapped}
                icon={
                  <Ionicons
                    name="add"
                    size={20}
                    color={freeCapped ? colors.disabledText : colors.text}
                  />
                }
                label={td('today.newFreeEntry')}
                onPress={openFreeEntry}
                variant="secondary"
              />

              <Text style={styles.freeNote}>
                {freeCapped
                  ? td('today.freeCapped', { cap: dailyToday.freeEntry.cap })
                  : td('today.freeAvailable', { cap: dailyToday.freeEntry.cap })}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.freeHero}>
              <View style={styles.freeHeroIcon}>
                <Ionicons name="pencil-outline" size={28} color={colors.primaryDark} />
              </View>
              <Text style={styles.freeHeroTitle}>{td('today.freeTitle')}</Text>
              <Text style={styles.freeHeroBody}>{td('today.freeBody')}</Text>

              <View style={styles.spacer} />

              <Text style={styles.freeHeroCount}>
                {td('today.freeUsed', {
                  used: dailyToday.freeEntry.used,
                  cap: dailyToday.freeEntry.cap,
                })}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={openFreeEntry}
                style={({ pressed }) => [styles.freeHeroButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={22} color={colors.white} />
                <Text style={styles.freeHeroButtonLabel}>{td('today.newFreeEntry')}</Text>
              </Pressable>
            </View>

            <View style={styles.noRequestCard}>
              <View style={styles.noRequestIcon}>
                <Ionicons name="notifications-outline" size={24} color={colors.primaryDark} />
              </View>
              <View style={styles.noRequestText}>
                <Text style={styles.noRequestTitle}>{td('today.noRequestTitle')}</Text>
                <Text style={styles.noRequestBody}>
                  {td('today.nextRequest', {
                    from: dailyToday.nextRequest.from,
                    to: dailyToday.nextRequest.to,
                  })}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
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
  main: {
    flex: 1,
    minHeight: 0,
    gap: spacing.md,
  },
  requestCard: {
    flex: 7,
    minHeight: 0,
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
  answerLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  freeCard: {
    flex: 3,
    minHeight: 0,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  freeHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  freeTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  freeCount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  freeNote: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  freeHero: {
    flex: 7,
    minHeight: 0,
    paddingTop: spacing.xxl,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderRadius: radii.hero,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  freeHeroIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
  },
  freeHeroTitle: {
    marginTop: 14,
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: colors.text,
  },
  freeHeroBody: {
    marginTop: 14,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 27,
    color: colors.textBody,
  },
  freeHeroCount: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  freeHeroButton: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  freeHeroButtonLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.white,
  },
  noRequestCard: {
    flex: 3,
    minHeight: 0,
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
  pressed: {
    opacity: 0.82,
  },
});
