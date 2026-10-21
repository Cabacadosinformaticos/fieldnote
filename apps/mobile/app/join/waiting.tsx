import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const WAITING_ICON_BACKGROUND = '#FFF3D6';
const WAITING_ICON_COLOR = '#5C3900';

const NEXT_STEPS: { icon: IoniconName; title: string; body: string }[] = [
  {
    icon: 'notifications-outline',
    title: tj('waiting.acceptTitle'),
    body: tj('waiting.acceptBody'),
  },
  {
    icon: 'close-circle-outline',
    title: tj('waiting.declineTitle'),
    body: tj('waiting.declineBody'),
  },
  {
    icon: 'lock-closed-outline',
    title: tj('waiting.untilTitle'),
    body: tj('waiting.untilBody'),
  },
];

export default function WaitingScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons name="time-outline" size={32} color={WAITING_ICON_COLOR} />
        </View>
        <Text style={typography.title}>{tj('waiting.title')}</Text>
        <Text style={styles.body}>{tj('waiting.body')}</Text>
      </View>

      <Card style={styles.studyCard}>
        <Text style={styles.studyLabel}>{tj('waiting.studyLabel')}</Text>
        <Text style={styles.studyTitle}>{tj('waiting.studyTitle')}</Text>
        <Text style={styles.studyNote}>{tj('waiting.entryNote')}</Text>
      </Card>

      <Card style={styles.nextCard}>
        <Text style={styles.nextTitle}>{tj('waiting.nextTitle')}</Text>
        <View style={styles.rows}>
          {NEXT_STEPS.map((step) => (
            <View key={step.title} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={step.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{step.title}</Text>
                <Text style={styles.rowBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Text style={styles.note}>{tj('waiting.note')}</Text>

      <View style={styles.spacer} />

      <Button
        label={tj('waiting.openStudies')}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  intro: {
    alignItems: 'flex-start',
    gap: 14,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    backgroundColor: WAITING_ICON_BACKGROUND,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  studyCard: {
    gap: 4,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  studyLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text,
  },
  studyNote: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  nextCard: {
    gap: 14,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  nextTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  rows: {
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
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  rowBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textBody,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
});
