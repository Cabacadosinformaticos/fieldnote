import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
  applySignIn,
  linkableCredentials,
  requestEmailCode,
  signInWithRecovery,
  verifyEmailCode,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

type SignInMethod = 'code' | 'mail' | 'google';

function maskEmail(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) {
    return '•••';
  }
  return `${address.charAt(0)}•••${address.slice(at)}`;
}

export default function RestoreAccountScreen() {
  const [method, setMethod] = useState<SignInMethod>('code');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCode = method === 'code';
  const isMail = method === 'mail';
  const isGoogle = method === 'google';

  const choose = (next: SignInMethod) => {
    setMethod(next);
    setStep('email');
    setCode('');
    setError(null);
  };

  const signIn = async () => {
    const value = recoveryCode.trim();
    if (!value) {
      setError(ta('restore.error'));
      return;
    }

    setBusy(true);
    setError(null);
    const credentials = await linkableCredentials();
    const { data, error: apiError } = await signInWithRecovery(value, credentials);
    setBusy(false);
    if (!data) {
      setError(apiErrorMessage(apiError));
      return;
    }

    await applySignIn(data);
    router.replace(accountHref('/account/restored'));
  };

  const sendCode = async () => {
    const address = email.trim();
    if (!address.includes('@')) {
      setError(ta('restore.error'));
      return;
    }

    setBusy(true);
    setError(null);
    const { error: apiError } = await requestEmailCode(address);
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

    setError(ta('restore.error'));
  };

  const submit = () => {
    if (isCode) {
      void signIn();
      return;
    }
    if (isMail && step === 'email') {
      void sendCode();
      return;
    }
    if (isMail) {
      void verify();
    }
  };

  const submitLabel = isCode
    ? ta('restore.enter')
    : isMail && step === 'code'
      ? ta('restore.verify')
      : ta('restore.continue');

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton
          onPress={() => {
            if (isMail && step === 'code') {
              setStep('email');
              setError(null);
            } else {
              router.back();
            }
          }}
        />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{ta('restore.title')}</Text>
        <Text style={styles.body}>{ta('restore.body')}</Text>
      </View>

      <View accessibilityLabel={ta('restore.how')} accessibilityRole="radiogroup">
        <View style={styles.methods}>
          <View style={[styles.method, isCode ? styles.methodOn : styles.methodOff]}>
            <Pressable
              accessibilityLabel={ta('restore.code')}
              accessibilityRole="radio"
              accessibilityState={{ checked: isCode }}
              onPress={() => choose('code')}
              style={styles.methodHeader}
            >
              <Radio checked={isCode} />
              <View style={styles.methodIcon}>
                <Ionicons name="key-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.methodTitle}>{ta('restore.code')}</Text>
            </Pressable>
            {isCode ? (
              <View style={styles.methodField}>
                <Text style={styles.fieldLabel}>{ta('restore.codeLabel')}</Text>
                <TextInput
                  accessibilityLabel={ta('restore.codeLabel')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onChangeText={setRecoveryCode}
                  style={[styles.input, styles.codeInput]}
                  value={recoveryCode}
                />
              </View>
            ) : null}
          </View>

          <View style={[styles.method, isMail ? styles.methodOn : styles.methodOff]}>
            <Pressable
              accessibilityLabel={ta('restore.email')}
              accessibilityRole="radio"
              accessibilityState={{ checked: isMail }}
              onPress={() => choose('mail')}
              style={styles.methodHeader}
            >
              <Radio checked={isMail} />
              <View style={styles.methodIcon}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.methodTitle}>{ta('restore.email')}</Text>
            </Pressable>
            {isMail && step === 'email' ? (
              <View style={styles.methodField}>
                <Text style={styles.fieldLabel}>{ta('restore.emailLabel')}</Text>
                <TextInput
                  accessibilityLabel={ta('restore.emailLabel')}
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
                <Text style={styles.fieldHelp}>{ta('restore.emailHelp')}</Text>
              </View>
            ) : null}
            {isMail && step === 'code' ? (
              <View style={styles.methodField}>
                <Text style={styles.fieldHelp}>
                  {ta('accountEmail.codeBodyBefore')}
                  {maskEmail(email)}
                  {ta('accountEmail.codeBodyAfter')}
                </Text>
                <CodeInput
                  label={ta('restore.codeField')}
                  onChange={setCode}
                  value={code}
                />
                <Text style={styles.fieldHelp}>{ta('restore.codeHelp')}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.method, styles.methodOff]}>
            <Pressable
              accessibilityLabel={ta('restore.google')}
              accessibilityRole="radio"
              accessibilityState={{ checked: isGoogle, disabled: true }}
              disabled
              onPress={() => choose('google')}
              style={styles.methodHeader}
            >
              <Radio checked={false} />
              <View style={styles.googleIcon}>
                <Text style={styles.googleLetter}>G</Text>
              </View>
              <Text style={styles.methodTitle}>{ta('restore.google')}</Text>
            </Pressable>
            <Text style={styles.googleHelp}>{ta('restore.googleHelp')}</Text>
          </View>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Note
        body={ta('restore.warning')}
        icon="warning-outline"
        tone="warning"
      />

      <View style={styles.spacer} />

      <Button
        disabled={busy || (!isCode && !isMail)}
        label={busy ? ta('restore.busy') : submitLabel}
        onPress={submit}
      />
    </Screen>
  );
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.radio, checked && styles.radioOn]}>
      <View style={[styles.radioDot, checked && styles.radioDotOn]} />
    </View>
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
    gap: 6,
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
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  methods: {
    gap: spacing.sm,
  },
  method: {
    gap: spacing.md,
    borderRadius: radii.xl,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.surface,
  },
  methodOn: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  methodOff: {
    borderWidth: 1,
    borderColor: colors.divider,
  },
  methodHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8A93A8',
    borderRadius: 11,
  },
  radioOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioDotOn: {
    backgroundColor: colors.primary,
  },
  methodIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  methodTitle: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  methodField: {
    gap: 6,
    paddingBottom: 4,
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
  codeInput: {
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.mono,
    fontSize: 18,
    letterSpacing: 0.72,
    color: '#131A2A',
  },
  fieldHelp: {
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
  googleHelp: {
    paddingBottom: 4,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
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
