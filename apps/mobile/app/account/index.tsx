import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deviceClient } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Note } from '@/components/account/Note';
import { ToggleSwitch } from '@/components/account/ToggleSwitch';
import { accountHref } from '@/components/account/navigation';
import { ta } from '@/i18n/ta';
import {
  clearAccountToken,
  clearPoolCredential,
  createRecoveryAccount,
  deleteAccount,
  getAccount,
  getAccountToken,
  linkAccount,
  linkableCredentials,
  saveAccountToken,
  setErasureDue,
  setPendingRecoveryCode,
  type AccountOut,
  type ParticipantStatus,
} from '@/state/actions';
import {
  getDeviceToken,
  listParticipations,
  saveParticipation,
} from '@/state/participations';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const gives: { icon: IoniconName; key: Parameters<typeof ta>[0] }[] = [
  { icon: 'phone-portrait-outline', key: 'account.give1' },
  { icon: 'shield-checkmark-outline', key: 'account.give2' },
  { icon: 'eye-outline', key: 'account.give3' },
  { icon: 'people-outline', key: 'account.give4' },
];

function statusLabel(status: ParticipantStatus): string {
  switch (status) {
    case 'pending_approval':
      return ta('account.pending');
    case 'withdrawn':
      return ta('account.withdrawn');
    case 'removed':
      return ta('account.removed');
    case 'erasure_scheduled':
      return ta('account.erasing');
    case 'declined':
      return ta('account.declined');
    default:
      return ta('account.active');
  }
}

export default function AccountScreen() {
  const [account, setAccount] = useState<AccountOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'create' | 'link' | 'delete' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [eraseStudies, setEraseStudies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const stored = await getAccountToken().catch(() => null);
    setToken(stored);
    if (!stored) {
      setAccount(null);
      setLoading(false);
      return;
    }

    const { data, error: apiError } = await getAccount(stored);
    if (data) {
      setAccount(data);
      setError(null);
    } else {
      setError(apiErrorMessage(apiError));
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    setBusy('create');
    setError(null);
    const { data, error: apiError } = await createRecoveryAccount();
    if (!data) {
      setError(apiErrorMessage(apiError));
      setBusy(null);
      return;
    }

    await saveAccountToken(data.account_token);
    setPendingRecoveryCode(data.recovery_code);
    setBusy(null);
    router.push(accountHref('/account/code'));
  };

  const link = async () => {
    if (!token) {
      return;
    }

    setBusy('link');
    setError(null);
    setNotice(null);
    const credentials = await linkableCredentials();
    const { data, error: apiError } = await linkAccount(token, credentials);
    setBusy(null);
    if (!data) {
      setError(apiErrorMessage(apiError));
      return;
    }

    setAccount(data);
    setNotice(ta('account.linkDone'));
  };

  const refreshAfterDelete = async () => {
    const rows = await listParticipations().catch(() => []);
    for (const row of rows) {
      const deviceToken = await getDeviceToken(row.studyId).catch(() => null);
      if (!deviceToken) {
        continue;
      }

      try {
        const { data } = await deviceClient(deviceToken).GET(
          '/api/v1/participation/me',
        );
        if (data) {
          await saveParticipation({
            studyId: data.study.id,
            title: data.study.title,
            status: data.status,
            alias: data.alias,
            startsOn: data.study.starts_on,
            endsOn: data.study.ends_on,
            timezone: data.study.timezone,
          }).catch(() => undefined);
          await setErasureDue(data.study.id, data.erasure_due_at).catch(
            () => undefined,
          );
        }
      } catch {
        // The local cards stay as they were when the API is offline.
      }
    }
  };

  const remove = async () => {
    if (!token) {
      return;
    }

    setBusy('delete');
    setError(null);
    const { error: apiError } = await deleteAccount(token, eraseStudies);
    if (apiError !== null) {
      setBusy(null);
      setError(apiErrorMessage(apiError));
      return;
    }

    if (eraseStudies) {
      await clearPoolCredential().catch(() => undefined);
    }
    await clearAccountToken().catch(() => undefined);
    await refreshAfterDelete();
    setAccount(null);
    setToken(null);
    setDeleting(false);
    setBusy(null);
    router.replace(accountHref('/settings'));
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={ta('common.back')} onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={typography.title}>
          {account ? ta('account.manageTitle') : ta('account.title')}
        </Text>
        <Text style={styles.introBody}>
          {account ? ta('account.manageBody') : ta('account.body')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{ta('account.loading')}</Text>
        </View>
      ) : null}

      {!loading && account ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ta('account.methodsTitle')}</Text>
            <View style={styles.methodRow}>
              <Ionicons name="key-outline" size={20} color={colors.primary} />
              <Text style={styles.methodLabel}>
                {ta('account.recoveryMethod')}
              </Text>
              <Ionicons
                name={
                  account.methods.recovery_code
                    ? 'checkmark-circle'
                    : 'ellipse-outline'
                }
                size={22}
                color={
                  account.methods.recovery_code
                    ? colors.successText
                    : colors.textMuted
                }
              />
            </View>
            <View style={styles.methodRow}>
              <Ionicons name="mail-outline" size={20} color={colors.primary} />
              <Text style={styles.methodLabel}>{ta('account.emailMethod')}</Text>
              <Text style={styles.methodValue}>
                {account.methods.email_masked ?? ta('account.emailNone')}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{ta('account.linkedTitle')}</Text>
            <Text style={styles.cardBody}>
              {ta('account.linkedCount', {
                count: account.participations.length,
              })}
            </Text>
            {account.participations.length === 0 ? (
              <Text style={styles.cardBody}>{ta('account.noStudies')}</Text>
            ) : (
              account.participations.map((item) => (
                <View key={item.participant_id} style={styles.studyRow}>
                  <Text style={styles.studyTitle}>{item.study.title}</Text>
                  <Text style={styles.studyStatus}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              ))
            )}
            {account.pool_linked ? (
              <View style={styles.methodRow}>
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.methodLabel}>
                  {ta('account.poolLinked')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null }}
              disabled={busy !== null}
              onPress={() => {
                void link();
              }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="link-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>
                  {busy === 'link' ? ta('account.busy') : ta('account.link')}
                </Text>
                <Text style={styles.actionBody}>{ta('account.linkBody')}</Text>
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
                <Text style={styles.actionTitle}>{ta('account.addEmail')}</Text>
                <Text style={styles.actionBody}>
                  {ta('account.addEmailBody')}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleting(true)}
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color="#9B1C1C" />
            <Text style={styles.deleteLabel}>{ta('account.delete')}</Text>
          </Pressable>
          <Text style={styles.deleteBody}>{ta('account.deleteBody')}</Text>
        </>
      ) : null}

      {!loading && !account ? (
        <>
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
              accessibilityState={{ disabled: busy !== null }}
              disabled={busy !== null}
              onPress={() => {
                void create();
              }}
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
                <Text style={styles.actionTitle}>
                  {busy === 'create'
                    ? ta('account.busy')
                    : ta('account.createCode')}
                </Text>
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
              accessibilityRole="button"
              onPress={() => router.push(accountHref('/account/restore'))}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name="log-in-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>
                  {ta('account.restoreLink')}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setDeleting(false)}
        transparent
        visible={deleting}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={ta('common.cancel')}
            accessibilityRole="button"
            onPress={() => setDeleting(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>{ta('account.deleteTitle')}</Text>
            <Text style={styles.dialogBody}>{ta('account.deleteBody')}</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{ta('account.deleteErase')}</Text>
              <ToggleSwitch
                label={ta('account.deleteErase')}
                onChange={setEraseStudies}
                value={eraseStudies}
              />
            </View>
            <Text style={styles.dialogBody}>
              {eraseStudies
                ? ta('account.deleteEraseBody')
                : ta('account.deleteKeepBody')}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy === 'delete' }}
                disabled={busy === 'delete'}
                onPress={() => {
                  void remove();
                }}
                style={({ pressed }) => [
                  styles.dangerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dangerLabel}>
                  {busy === 'delete'
                    ? ta('account.deleting')
                    : ta('account.deleteConfirm')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDeleting(false)}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelLabel}>{ta('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
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
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  methodRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  methodLabel: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  methodValue: {
    maxWidth: '55%',
    textAlign: 'right',
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  studyTitle: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  studyStatus: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
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
  delete: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: '#9B1C1C',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  deleteLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: '#9B1C1C',
  },
  deleteBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  dialog: {
    gap: spacing.md,
    borderRadius: radii.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  dialogTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  dialogBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  dialogActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dangerButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: '#9B1C1C',
  },
  dangerLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
});
