import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { accountHref } from '@/components/account/navigation';
import { getPoolCredential } from '@/state/actions';
import { ta, type AccountKey } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const reasons: {
  icon: IoniconName;
  title: AccountKey;
  body: AccountKey;
}[] = [
  {
    icon: 'hand-left-outline',
    title: 'pool.voluntaryTitle',
    body: 'pool.voluntaryBody',
  },
  {
    icon: 'list-outline',
    title: 'pool.askTitle',
    body: 'pool.askBody',
  },
  {
    icon: 'eye-off-outline',
    title: 'pool.privacyTitle',
    body: 'pool.privacyBody',
  },
  {
    icon: 'log-out-outline',
    title: 'pool.exitTitle',
    body: 'pool.exitBody',
  },
];

export default function PoolIntroScreen() {
  useEffect(() => {
    void getPoolCredential()
      .then((credential) => {
        if (credential) {
          router.replace(accountHref('/pool/settings'));
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{ta('pool.title')}</Text>
        <Text style={styles.body}>{ta('pool.body')}</Text>
      </View>

      <View style={styles.card}>
        {reasons.map((reason) => (
          <View key={reason.title} style={styles.reason}>
            <View style={styles.reasonIcon}>
              <Ionicons
                name={reason.icon}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.reasonText}>
              <Text style={styles.reasonTitle}>{ta(reason.title)}</Text>
              <Text style={styles.reasonBody}>{ta(reason.body)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={ta('pool.join')}
          onPress={() => router.push(accountHref('/pool/profile'))}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
        >
          <Text style={styles.notNowLabel}>{ta('pool.notNow')}</Text>
        </Pressable>
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
  intro: {
    gap: 10,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  card: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  reasonIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  reasonText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  reasonTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  reasonBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: 10,
  },
  notNow: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.8,
  },
});
