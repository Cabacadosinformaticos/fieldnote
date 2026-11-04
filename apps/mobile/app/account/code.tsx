import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { ta } from '@/i18n/ta';
import {
  clearPendingRecoveryCode,
  confirmAccount,
  getAccountToken,
  getPendingRecoveryCode,
  linkableCredentials,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

const tips = ['accountCode.tip1', 'accountCode.tip2', 'accountCode.tip3'] as const;

export default function RecoveryCodeScreen() {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = getPendingRecoveryCode();

  const copy = async () => {
    if (!code) {
      return;
    }

    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
    } catch {
      setError(ta('account.error'));
    }
  };

  const saveAsFile = async () => {
    if (!code) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const file = new File(Paths.cache, 'fieldnote-codigo-recuperacao.txt');
      await file.write(`${ta('accountCode.label')}: ${code}\n`);

      if (!(await Sharing.isAvailableAsync())) {
        setError(ta('account.error'));
        return;
      }

      await Sharing.shareAsync(file.uri, {
        dialogTitle: ta('accountCode.save'),
        mimeType: 'text/plain',
      });
    } catch {
      setError(ta('account.error'));
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    const token = await getAccountToken().catch(() => null);
    if (!token) {
      setError(ta('accountCode.confirmError'));
      return;
    }

    setBusy(true);
    setError(null);
    const credentials = await linkableCredentials();
    const { data, error: apiError } = await confirmAccount(token, credentials);
    setBusy(false);
    if (!data) {
      setError(apiErrorMessage(apiError));
      return;
    }

    clearPendingRecoveryCode();
    router.replace(accountHref('/settings'));
  };

  if (!code) {
    return (
      <Screen contentStyle={styles.content}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.title}>{ta('accountCode.title')}</Text>
        <Text style={styles.body}>{ta('accountCode.missing')}</Text>
        <View style={styles.spacer} />
        <Button
          label={ta('common.back')}
          onPress={() => router.replace(accountHref('/account'))}
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

      <Text style={styles.title}>{ta('accountCode.title')}</Text>
      <Text style={styles.body}>{ta('accountCode.body')}</Text>

      <View style={styles.codeCard}>
        <View style={styles.codeBlock}>
          <Text style={styles.codeLabel}>{ta('accountCode.label')}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            selectable
            style={styles.code}
          >
            {code}
          </Text>
        </View>
        <View style={styles.codeActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void copy();
            }}
            style={({ pressed }) => [
              styles.codeButton,
              styles.copyButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={20}
              color={colors.text}
            />
            <Text style={styles.codeButtonLabel}>
              {copied ? ta('accountCode.copied') : ta('accountCode.copy')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => {
              void saveAsFile();
            }}
            style={({ pressed }) => [
              styles.codeButton,
              styles.saveButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={saving ? 'hourglass-outline' : 'download-outline'}
              size={20}
              color={colors.text}
            />
            <Text style={styles.codeButtonLabel}>{ta('accountCode.save')}</Text>
          </Pressable>
        </View>
      </View>

      <Note
        body={ta('accountCode.warningRest')}
        icon="warning-outline"
        strong={ta('accountCode.warningStrong')}
        tone="warning"
      />

      <View style={styles.tips}>
        {tips.map((key) => (
          <View key={key} style={styles.tipRow}>
            <Ionicons
              name="checkmark"
              size={18}
              color={colors.successText}
              style={styles.tipIcon}
            />
            <Text style={styles.tipText}>{ta(key)}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <Pressable
        accessibilityLabel={ta('accountCode.saved')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saved }}
        onPress={() => setSaved((value) => !value)}
        style={styles.checkRow}
      >
        <View style={[styles.checkBox, saved && styles.checkBoxOn]}>
          {saved ? (
            <Ionicons name="checkmark" size={18} color={colors.white} />
          ) : null}
        </View>
        <Text style={styles.checkLabel}>{ta('accountCode.saved')}</Text>
      </Pressable>

      <Button
        disabled={!saved || busy}
        label={busy ? ta('accountCode.confirming') : ta('accountCode.finish')}
        onPress={() => {
          void finish();
        }}
      />
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
  codeCard: {
    gap: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.card,
    paddingTop: 18,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  codeBlock: {
    gap: 6,
  },
  codeLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0.96,
    color: '#131A2A',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  codeButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  copyButton: {
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
  },
  saveButton: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: spacing.md,
  },
  codeButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
  tips: {
    gap: 6,
    paddingHorizontal: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
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
  checkRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  checkBoxOn: {
    backgroundColor: colors.primary,
  },
  checkLabel: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
});
