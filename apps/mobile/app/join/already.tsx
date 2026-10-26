import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { formatDate, formatPeriod, formatTeam } from '@/components/join/format';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { useJoinSession } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function AlreadyScreen() {
  const { lookup } = useJoinSession();
  const study = lookup?.study;
  const existing = lookup?.existing_participation;

  useEffect(() => {
    if (!lookup) {
      router.replace('/');
    }
  }, [lookup]);

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={typography.title}>{tj('already.title')}</Text>
      <Text style={styles.body}>{tj('already.body')}</Text>

      <Card style={styles.studyCard}>
        <View style={styles.studyIntro}>
          <Text style={styles.studyTitle}>
            {tj('study.title', { title: study?.title ?? '' })}
          </Text>
          <Text style={styles.studyPeriod}>
            {tj('study.period', {
              period: formatPeriod(study?.starts_on, study?.ends_on),
            })}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{tj('study.teamLabel')}</Text>
              <Text style={styles.rowValue}>
                {tj('study.team', { team: formatTeam(study?.team ?? []) })}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{tj('already.enteredLabel')}</Text>
              <Text style={styles.rowValue}>
                {existing?.decided_at
                  ? tj('already.entered', {
                      date: formatDate(existing.decided_at),
                    })
                  : tj('already.enteredUnknown')}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.codeNote}>
        <Ionicons name="checkmark" size={20} color={colors.successText} />
        <Text style={styles.codeNoteText}>{tj('code.note')}</Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={tj('already.open')}
          onPress={() => router.replace('/(tabs)')}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/')}
          style={styles.homeLink}
        >
          <Text style={styles.homeLinkText}>{tj('already.backHome')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  studyCard: {
    gap: spacing.lg,
    borderRadius: radii.card,
    padding: spacing.xl,
  },
  studyIntro: {
    gap: 4,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    color: colors.text,
  },
  studyPeriod: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  details: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  rowText: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  rowValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  codeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  codeNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textBody,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: 10,
  },
  homeLink: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeLinkText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
    color: colors.primaryDark,
  },
});
