import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { deviceClient } from '@/api/client';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Bullets } from '@/components/more/Bullets';
import { SettingsRow } from '@/components/more/SettingsRow';
import { moreHref } from '@/components/more/navigation';
import { formatDate } from '@/components/join/format';
import { tm } from '@/i18n/tm';
import {
  clearAccountToken,
  clearPoolCredential,
  clearStudyQueue,
  deleteAccount,
  getAccount,
  getAccountToken,
  getErasureDue,
  getPoolCredential,
  getPoolMember,
  leavePool,
  setErasureDue,
  type AccountOut,
} from '@/state/actions';
import {
  getDeviceToken,
  listParticipations,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

export default function SettingsScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [count, setCount] = useState(0);
  const [consentStudyId, setConsentStudyId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountOut | null>(null);
  const [hasPool, setHasPool] = useState(false);
  const [poolSince, setPoolSince] = useState<string | null>(null);
  const [poolPaused, setPoolPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = confirmation.trim().toUpperCase() === 'APAGAR';

  const load = useCallback(async () => {
    const rows = await listParticipations().catch(() => []);
    setCount(rows.length);
    setConsentStudyId(rows[0]?.studyId ?? null);

    const accountToken = await getAccountToken().catch(() => null);
    if (accountToken) {
      const { data } = await getAccount(accountToken);
      setAccount(data);
    } else {
      setAccount(null);
    }

    const credential = await getPoolCredential().catch(() => null);
    setHasPool(Boolean(credential));
    if (credential) {
      const { data } = await getPoolMember(credential);
      if (data) {
        setPoolSince(formatDate(data.joined_at));
        setPoolPaused(data.invitations_paused);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const eraseAll = async () => {
    if (!ready || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const rows = await listParticipations().catch(() => []);
    let firstDue: string | null = null;

    for (const row of rows) {
      if (row.status === 'erasure_scheduled') {
        const due = await getErasureDue(row.studyId).catch(() => null);
        if (!firstDue && due) {
          firstDue = due;
        }
        try {
          await clearStudyQueue(row.studyId);
        } catch {
          setBusy(false);
          setError(tm('settings.eraseError'));
          return;
        }
        continue;
      }

      const token = await getDeviceToken(row.studyId).catch(() => null);
      if (!token) {
        continue;
      }

      try {
        const { data, error: apiError } = await deviceClient(token).POST(
          '/api/v1/participation/me/erasure',
          { body: { confirmation: 'APAGAR' } },
        );
        if (!data) {
          setBusy(false);
          setError(apiErrorMessage(apiError));
          return;
        }

        // Store the due date first: if the queue wipe fails now, the scheduled purge retries it.
        await setErasureDue(row.studyId, data.erasure_due_at).catch(
          () => undefined,
        );
        if (!firstDue && data.erasure_due_at) {
          firstDue = data.erasure_due_at;
        }

        try {
          await clearStudyQueue(row.studyId);
        } catch {
          setBusy(false);
          setError(tm('settings.eraseError'));
          return;
        }
      } catch {
        setBusy(false);
        setError(networkErrorMessage());
        return;
      }
    }

    const credential = await getPoolCredential().catch(() => null);
    if (credential) {
      const { error: apiError } = await leavePool(credential);
      if (apiError !== null) {
        setBusy(false);
        setError(apiErrorMessage(apiError));
        return;
      }
      await clearPoolCredential().catch(() => undefined);
    }

    const accountToken = await getAccountToken().catch(() => null);
    if (accountToken) {
      const { error: apiError } = await deleteAccount(accountToken, false);
      if (apiError !== null) {
        setBusy(false);
        setError(apiErrorMessage(apiError));
        return;
      }
      await clearAccountToken().catch(() => undefined);
    }

    setBusy(false);
    setConfirmation('');
    await load();

    if (rows.length === 0) {
      setNotice(tm('settings.eraseDone'));
      return;
    }

    router.push({
      pathname: '/erase/scheduled',
      params: {
        scope: 'all',
        due: firstDue ?? '',
        requested: new Date().toISOString(),
      },
    });
  };

  const accountSubtitle = account
    ? account.confirmed
      ? tm('settings.accountCreated')
      : tm('settings.accountPending')
    : tm('settings.accountBody');

  const poolSubtitle = poolSince
    ? tm('settings.poolMember', {
        date: poolSince,
        state: poolPaused ? tm('settings.poolPaused') : tm('settings.poolActive'),
      })
    : tm('settings.poolBody');

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={tm('common.back')} onPress={() => router.back()} />
        <Text style={styles.title}>{tm('settings.title')}</Text>
      </View>

      <View style={styles.preferencesCard}>
        <SettingsRow
          divider
          icon="person-outline"
          onPress={() => router.push(moreHref('/account'))}
          subtitle={accountSubtitle}
          title={tm('settings.account')}
        />
        {/* PT/EN selector removed until English exists. */}
        <SettingsRow
          divider
          icon="people-outline"
          onPress={() =>
            router.push(moreHref(hasPool ? '/pool/settings' : '/pool'))
          }
          subtitle={poolSubtitle}
          title={tm('settings.pool')}
        />
        <SettingsRow
          divider
          icon="notifications-outline"
          onPress={() => router.push(moreHref('/notifications'))}
          subtitle={tm('settings.notificationsBody')}
          title={tm('settings.notifications')}
        />
        <SettingsRow
          icon="shield-outline"
          onPress={() =>
            router.push(
              consentStudyId
                ? {
                    pathname: '/join/consent-text',
                    params: { studyId: consentStudyId },
                  }
                : '/join/consent-text',
            )
          }
          title={tm('settings.privacy')}
        />
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>
          <Ionicons name="trash-outline" size={20} color="#9B1C1C" />{' '}
          {tm('settings.myData')}
        </Text>
        <Bullets
          items={[
            tm('settings.eraseB1', { count }),
            tm('settings.eraseB2'),
            tm('settings.eraseB3'),
            tm('settings.eraseB4'),
          ]}
        />

        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>{tm('settings.confirmLabel')}</Text>
          <TextInput
            accessibilityLabel={tm('settings.confirmLabel')}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setConfirmation}
            placeholder={tm('settings.confirmPlaceholder')}
            placeholderTextColor={colors.textMuted}
            spellCheck={false}
            style={styles.input}
            value={confirmation}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || busy }}
          disabled={!ready || busy}
          onPress={() => {
            void eraseAll();
          }}
          style={({ pressed }) => [
            styles.eraseButton,
            ready ? styles.eraseButtonOn : styles.eraseButtonOff,
            pressed && ready && !busy && styles.pressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={ready ? colors.white : '#9B1C1C'}
          />
          <Text style={[styles.eraseLabel, ready && styles.eraseLabelOn]}>
            {busy ? tm('settings.erasing') : tm('settings.eraseCta')}
          </Text>
        </Pressable>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.spacer} />

      <Text style={styles.version}>{tm('settings.version')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  preferencesCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  dangerCard: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: '#9B1C1C',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  dangerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: '#9B1C1C',
  },
  confirmBlock: {
    gap: 6,
    marginTop: spacing.xs,
  },
  confirmLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#858EA1',
    paddingHorizontal: 14,
    fontFamily: fonts.mono,
    fontSize: 17,
    letterSpacing: 1.36,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  eraseButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.lg,
  },
  eraseButtonOn: {
    backgroundColor: '#9B1C1C',
  },
  eraseButtonOff: {
    backgroundColor: '#FDECEC',
    opacity: 0.6,
  },
  eraseLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: '#9B1C1C',
  },
  eraseLabelOn: {
    color: colors.white,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.successText,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  version: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
