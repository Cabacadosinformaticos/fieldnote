import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { accountHref } from '@/components/account/navigation';
import { tj } from '@/i18n/tj';
import { getAccountToken } from '@/state/actions';
import { useJoinSession } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function JoinAccountScreen() {
  const { lookup, reset } = useJoinSession();
  const [missing, setMissing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getAccountToken()
        .then((token) => {
          if (active && token) {
            router.replace(accountHref('/join/invitation'));
          }
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }, []),
  );

  const continueJoining = async () => {
    const token = await getAccountToken().catch(() => null);
    if (!token) {
      setMissing(true);
      return;
    }

    router.replace(accountHref('/join/invitation'));
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton
          onPress={() => {
            reset();
            router.replace(accountHref('/join/code'));
          }}
        />
      </View>

      <Text style={typography.title}>{tj('joinAccount.title')}</Text>
      <Text style={styles.body}>{tj('joinAccount.body')}</Text>

      {lookup ? (
        <Text style={styles.study}>
          {tj('joinAccount.study', { title: lookup.study.title })}
        </Text>
      ) : null}

      <Card style={styles.hintCard}>
        <View style={styles.icon}>
          <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
        </View>
        <Text style={styles.hint}>{tj('joinAccount.hint')}</Text>
      </Card>

      {missing ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.errorText}>{tj('joinAccount.missing')}</Text>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={tj('joinAccount.create')}
          onPress={() => router.push(accountHref('/account'))}
        />
        <Button
          label={tj('joinAccount.restore')}
          onPress={() => router.push(accountHref('/account/restore'))}
          variant="secondary"
        />
        <Button
          label={tj('joinAccount.continue')}
          onPress={() => {
            void continueJoining();
          }}
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
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  study: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  hint: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  errorCard: {
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
  errorText: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: 10,
  },
});
