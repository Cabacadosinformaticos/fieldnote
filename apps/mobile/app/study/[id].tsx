import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Bullets } from '@/components/more/Bullets';
import { LanguageToggle } from '@/components/more/LanguageToggle';
import { SettingsRow } from '@/components/more/SettingsRow';
import { StatusPill } from '@/components/more/StatusPill';
import { moreHref } from '@/components/more/navigation';
import { getStudy, moreStudies } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export default function StudyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const study = getStudy(id) ?? moreStudies[0];
  const [leaving, setLeaving] = useState(false);

  const statusLabel =
    study.status === 'erasing' && study.eraseDate
      ? tm('studies.erasing', { date: study.eraseDate })
      : study.status === 'ended'
        ? tm('studies.ended')
        : tm('studies.active');

  const leave = () => {
    setLeaving(false);
    router.replace('/(tabs)/studies');
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={tm('study.back')} onPress={() => router.back()} />
        <Text style={styles.title}>{tm('study.title')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.studyTop}>
          <Text style={styles.studyName}>{study.name}</Text>
          <StatusPill
            label={statusLabel}
            tone={
              study.status === 'erasing'
                ? 'erasing'
                : study.status === 'ended'
                  ? 'ended'
                  : 'active'
            }
          />
        </View>
        <Text style={styles.description}>{study.description}</Text>
        <Text style={styles.period}>
          {tm('study.period', {
            period: study.period,
            day: study.day,
            total: study.totalDays,
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{tm('study.team')}</Text>
        <Text style={styles.team}>{study.team}</Text>
        <Text style={styles.email}>{study.email}</Text>
      </View>

      <View style={styles.languageCard}>
        <View style={styles.languageLabel}>
          <Ionicons name="globe-outline" size={20} color={colors.textMuted} />
          <Text style={styles.languageText}>{tm('study.language')}</Text>
        </View>
        <LanguageToggle />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/join/consent-text')}
        style={({ pressed }) => [
          styles.consentRow,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="document-text-outline"
          size={20}
          color={colors.textMuted}
        />
        <Text style={styles.consentLabel}>{tm('study.rereadConsent')}</Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      <View style={styles.leaveSection}>
        <Text style={styles.sectionLabel}>{tm('study.leaveOrErase')}</Text>
        <View style={styles.actionsCard}>
          <SettingsRow
            divider
            icon="log-out-outline"
            onPress={() => setLeaving(true)}
            subtitle={tm('study.leaveBody')}
            title={tm('study.leave')}
          />
          <SettingsRow
            danger
            icon="trash-outline"
            onPress={() => router.push(moreHref(`/erase/${study.id}`))}
            subtitle={tm('study.eraseBody')}
            title={tm('study.erase')}
          />
        </View>
      </View>

      <Text style={styles.version}>{tm('settings.version')}</Text>

      <Modal
        animationType="fade"
        onRequestClose={() => setLeaving(false)}
        transparent
        visible={leaving}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={tm('common.cancel')}
            accessibilityRole="button"
            onPress={() => setLeaving(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>{tm('study.leaveTitle')}</Text>
            <Bullets
              items={[
                tm('study.leaveB1'),
                tm('study.leaveB2'),
                tm('study.leaveB3'),
              ]}
            />
            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                onPress={leave}
                style={({ pressed }) => [
                  styles.leaveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.leaveLabel}>
                  {tm('study.leaveConfirm')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLeaving(false)}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelLabel}>{tm('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  card: {
    gap: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  studyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  studyName: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  period: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  sectionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  team: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 22,
    color: colors.primaryDark,
  },
  languageCard: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  languageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  consentRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  consentLabel: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  leaveSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  version: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  dialog: {
    gap: spacing.md,
    borderRadius: radii.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  dialogTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  dialogActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  leaveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: '#9B1C1C',
  },
  leaveLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
});
