import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { CodeInput } from '@/components/account/CodeInput';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { ta } from '@/i18n/ta';
import {
  applyAccountParticipations,
  applySignIn,
  getAccountToken,
  linkableCredentials,
  requestEmailCode,
  verifyEmailCode,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

function maskEmail(address: string): string {
  const at = address.indexOf('@');

  if (at <= 0) {
    return '•••';
  }

  return `${address.charAt(0)}•••${address.slice(at)}`;
}

export default function AccountEmailScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAccountToken().then(setToken).catch(() => undefined);
  }, []);

  const send = async () => {
    const address = email.trim();
    if (!address.includes('@')) {
      setError(ta('account.error'));
      return;
    }

    setBusy(true);
    setError(null);
    const { error: apiError } = await requestEmailCode(address, token);
    setBusy(false);
    if (apiError !== null) {
      setError(apiErrorMessage(apiError));
      return;
    }

    setCode('');
    setStep('code');
  };

  const verify = async () => {
    if (code.length !== 6) {
      return;
    }

    setBusy(true);
    setError(null);
    const credentials = await linkableCredentials();
    const { data, error: apiError } = await verifyEmailCode(
      email.trim(),
      code,
      credentials,
      token,
    );
    setBusy(false);
    if (!data) {
      setError(apiErrorMessage(apiError));
      return;
    }

    if ('account_token' in data) {
      await applySignIn(data);
      router.replace(accountHref('/account/restored'));
      return;
    }

    await applyAccountParticipations(data);
    router.replace(accountHref('/settings'));
  };

  if (step === 'code') {
    return (
      <Screen contentStyle={styles.content}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <BackButton onPress={() => setStep('email')} />
        </View>

        <Text style={styles.title}>{ta('accountEmail.codeTitle')}</Text>
        <Text style={styles.body}>
          {ta('accountEmail.codeBodyBefore')}
          <Text style={styles.strong}>{maskEmail(email)}</Text>
          {ta('accountEmail.codeBodyAfter')}
        </Text>

        <CodeInput
          label={ta('accountEmail.codeLabel')}
          onChange={setCode}
          value={code}
        />
        <Text style={styles.help}>{ta('accountEmail.codeHelp')}</Text>

        <View style={styles.resendRow}>
          <Text style={styles.resend}>{ta('accountEmail.resend')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            <Text style={styles.change}>{ta('accountEmail.change')}</Text>
          </Pressable>
        </View>

        <Note body={ta('accountEmail.spam')} icon="mail-outline" />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <Button
          disabled={code.length !== 6 || busy}
          label={ta('accountEmail.confirm')}
          onPress={() => {
            void verify();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={styles.title}>{ta('accountEmail.title')}</Text>
      <Text style={styles.body}>{ta('accountEmail.body')}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{ta('accountEmail.label')}</Text>
        <TextInput
          accessibilityLabel={ta('accountEmail.label')}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={ta('common.emailPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
        />
      </View>

      <Note body={ta('accountEmail.privacy')} icon="eye-off-outline" />
      <Note
        body={ta('accountEmail.warning')}
        icon="warning-outline"
        tone="warning"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <Button
        disabled={busy}
        label={ta('accountEmail.send')}
        onPress={() => {
          void send();
        }}
      />
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
  strong: {
    fontFamily: fonts.bold,
    color: colors.text,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: '#858EA1',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  help: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  resendRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resend: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  change: {
    paddingHorizontal: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    textDecorationLine: 'underline',
    color: colors.primaryDark,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  spacer: {
    flexGrow: 1,
  },
});
