import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function ReturnScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={typography.title}>{tj('return.title')}</Text>

      <Card style={styles.studyCard}>
        <View style={styles.studyIntro}>
          <Text style={styles.studyTitle}>{tj('study.title')}</Text>
          <Text style={styles.studyPeriod}>{tj('study.period')}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{tj('study.teamLabel')}</Text>
            <Text style={styles.rowValue}>{tj('study.team')}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.infoNote}>
        <Ionicons name="book-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.infoNoteText}>{tj('return.info')}</Text>
      </View>

      <View style={styles.codeNote}>
        <Ionicons name="checkmark" size={20} color={colors.successText} />
        <Text style={styles.codeNoteText}>{tj('code.note')}</Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={tj('return.confirm')}
          onPress={() => router.replace('/')}
        />
        <Button
          label={tj('return.decline')}
          onPress={() => router.replace('/')}
          variant="secondary"
        />
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
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
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
});
