import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const gives: { icon: IoniconName; key: Parameters<typeof ta>[0] }[] = [
  { icon: 'phone-portrait-outline', key: 'account.give1' },
  { icon: 'shield-checkmark-outline', key: 'account.give2' },
  { icon: 'eye-outline', key: 'account.give3' },
  { icon: 'people-outline', key: 'account.give4' },
];

export default function AccountScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={ta('common.back')} onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={typography.title}>{ta('account.title')}</Text>
        <Text style={styles.introBody}>{ta('account.body')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{ta('account.givesTitle')}</Text>
        {gives.map((item) => (
          <View key={item.key} style={styles.giveRow}>
            <View style={styles.giveIcon}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.giveText}>{ta(item.key)}</Text>
          </View>
        ))}
      </View>

      <Note body={ta('account.privacy')} icon="eye-off-outline" />

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(accountHref('/account/code'))}
          style={({ pressed }) => [
            styles.recommended,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.recommendedIcon}>
            <Ionicons name="key-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.recommendedText}>
            <Text style={styles.recommendedPill}>
              {ta('account.recommended')}
            </Text>
            <Text style={styles.actionTitle}>{ta('account.createCode')}</Text>
            <Text style={styles.actionBody}>
              {ta('account.createCodeBody')}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(accountHref('/account/email'))}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>{ta('account.useEmail')}</Text>
            <Text style={styles.actionBody}>
              {ta('account.useEmailBody')}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        <Pressable
          accessibilityState={{ disabled: true }}
          accessibilityRole="button"
          disabled
          style={styles.action}
        >
          <View style={styles.googleIcon}>
            <Text style={styles.googleLetter}>G</Text>
          </View>
          <Text style={[styles.actionTitle, styles.googleTitle]}>
            {ta('account.google')}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    minHeight: 48,
    justifyContent: 'center',
  },
  intro: {
    gap: 6,
  },
  introBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  giveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  giveIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  giveText: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: spacing.sm,
  },
  recommended: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  recommendedIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  recommendedText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  recommendedPill: {
    alignSelf: 'flex-start',
    marginBottom: 2,
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  action: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  actionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  actionText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  actionBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  googleIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.disabledBackground,
  },
  googleLetter: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textBody,
  },
  googleTitle: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
