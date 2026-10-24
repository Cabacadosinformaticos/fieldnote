import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { accountRecoveryCode } from '@/fake/account';
import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

type SignInMethod = 'code' | 'mail' | 'google';

export default function RestoreAccountScreen() {
  const [method, setMethod] = useState<SignInMethod>('code');
  const [recoveryCode, setRecoveryCode] = useState(accountRecoveryCode);
  const [email, setEmail] = useState('');

  const isCode = method === 'code';
  const isMail = method === 'mail';
  const isGoogle = method === 'google';

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
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
              onPress={() => setMethod('code')}
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
              onPress={() => setMethod('mail')}
              style={styles.methodHeader}
            >
              <Radio checked={isMail} />
              <View style={styles.methodIcon}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.methodTitle}>{ta('restore.email')}</Text>
            </Pressable>
            {isMail ? (
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
          </View>

          <View
            style={[styles.method, isGoogle ? styles.methodOn : styles.methodOff]}
          >
            <Pressable
              accessibilityLabel={ta('restore.google')}
              accessibilityRole="radio"
              accessibilityState={{ checked: isGoogle }}
              onPress={() => setMethod('google')}
              style={styles.methodHeader}
            >
              <Radio checked={isGoogle} />
              <View style={styles.googleIcon}>
                <Text style={styles.googleLetter}>G</Text>
              </View>
              <Text style={styles.methodTitle}>{ta('restore.google')}</Text>
            </Pressable>
            {isGoogle ? (
              <Text style={styles.googleHelp}>{ta('restore.googleHelp')}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <Note
        body={ta('restore.warning')}
        icon="warning-outline"
        tone="warning"
      />

      <View style={styles.spacer} />

      <Button
        label={isCode ? ta('restore.enter') : ta('restore.continue')}
        onPress={() => router.push(accountHref('/account/restored'))}
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
  spacer: {
    flexGrow: 1,
  },
});
