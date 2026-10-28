import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { ToggleSwitch } from '@/components/account/ToggleSwitch';
import { accountHref } from '@/components/account/navigation';
import {
  ageLabel,
  genderLabel,
  languageLabels,
  situationLabel,
  transportLabel,
} from '@/components/account/poolOptions';
import { formatDate } from '@/components/join/format';
import { ta } from '@/i18n/ta';
import {
  clearPoolCredential,
  getPoolCredential,
  getPoolMember,
  leavePool,
  listPoolInvitations,
  updatePoolMember,
  type PoolInvitation,
  type PoolMember,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

export default function PoolSettingsScreen() {
  const [credential, setCredential] = useState<string | null>(null);
  const [member, setMember] = useState<PoolMember | null>(null);
  const [invitations, setInvitations] = useState<PoolInvitation[]>([]);
  const [receiving, setReceiving] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await getPoolCredential().catch(() => null);
      if (!stored) {
        router.replace(accountHref('/pool'));
        return;
      }

      const [{ data }, invites] = await Promise.all([
        getPoolMember(stored),
        listPoolInvitations(stored),
      ]);
      setLoading(false);
      if (!data) {
        setError(ta('account.error'));
        return;
      }

      setCredential(stored);
      setMember(data);
      setReceiving(!data.invitations_paused);
      if (invites.data) {
        setInvitations(invites.data.filter((item) => item.status === 'sent'));
      }
    };

    void load();
  }, []);

  const toggleReceiving = async (value: boolean) => {
    if (!credential) {
      return;
    }

    setReceiving(value);
    setError(null);
    const { data, error: apiError } = await updatePoolMember(credential, {
      invitations_paused: !value,
    });
    if (!data) {
      setReceiving(!value);
      setError(apiErrorMessage(apiError));
      return;
    }

    setMember(data);
  };

  const leave = async () => {
    if (!credential) {
      return;
    }

    setBusy(true);
    setError(null);
    const { error: apiError } = await leavePool(credential);
    setBusy(false);
    if (apiError !== null) {
      setError(apiErrorMessage(apiError));
      return;
    }

    await clearPoolCredential();
    router.replace(accountHref('/settings'));
  };

  if (loading || !member) {
    return (
      <Screen contentStyle={styles.loading}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.loadingText}>
          {error ?? ta('account.loading')}
        </Text>
      </Screen>
    );
  }

  const preferNot = ta('poolProfile.preferNot');
  const profileRows = [
    { label: ta('poolSettings.concelho'), value: member.concelho },
    { label: ta('poolSettings.freguesia'), value: member.freguesia ?? preferNot },
    { label: ta('poolSettings.age'), value: ageLabel(member.age_band) || preferNot },
    { label: ta('poolSettings.gender'), value: genderLabel(member.gender) || preferNot },
    {
      label: ta('poolSettings.situation'),
      value: situationLabel(member.occupation) || preferNot,
    },
    {
      label: ta('poolSettings.transport'),
      value: transportLabel(member.usual_transport) || preferNot,
    },
    {
      label: ta('poolSettings.languages'),
      value: languageLabels(member.languages).join(', ') || preferNot,
    },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{ta('poolSettings.title')}</Text>
        <Text style={styles.memberSince}>
          {ta('poolSettings.memberSince', {
            date: formatDate(member.joined_at),
          })}
        </Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Text style={styles.profileTitle}>
            {ta('poolSettings.profileTitle')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(accountHref('/pool/profile'))}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.editLabel}>{ta('poolSettings.edit')}</Text>
          </Pressable>
        </View>

        <View>
          {profileRows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.row,
                index < profileRows.length - 1 && styles.rowDivider,
              ]}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{ta('poolSettings.receive')}</Text>
          <ToggleSwitch
            label={ta('poolSettings.receive')}
            onChange={(value) => {
              void toggleReceiving(value);
            }}
            value={receiving}
          />
        </View>
        <Text style={styles.toggleBody}>
          {ta('poolSettings.receiveBody')}
        </Text>
      </View>

      <View style={styles.invitesCard}>
        <Text style={styles.profileTitle}>
          {ta('poolSettings.invitesTitle')}
        </Text>
        {invitations.length === 0 ? (
          <Text style={styles.toggleBody}>{ta('poolSettings.noInvites')}</Text>
        ) : (
          invitations.map((invitation) => (
            <Pressable
              key={invitation.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/pool/invite',
                  params: { id: invitation.id },
                })
              }
              style={({ pressed }) => [
                styles.inviteRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.inviteText}>
                <Text style={styles.inviteTitle}>{invitation.study.title}</Text>
                <Text style={styles.toggleBody}>
                  {ta('poolInvite.expiry', {
                    received: formatDate(invitation.sent_at),
                    expires: formatDate(invitation.expires_at),
                  })}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ))
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => setShowLeave(true)}
        style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={18} color="#9B1C1C" />
        <Text style={styles.leaveLabel}>
          {busy ? ta('account.busy') : ta('poolSettings.leave')}
        </Text>
      </Pressable>
      <Text style={styles.leaveNote}>{ta('poolSettings.leaveNote')}</Text>

      <ConfirmSheet
        body={ta('poolSettings.leaveBody')}
        cancelLabel={ta('poolSettings.leaveCancel')}
        confirmLabel={ta('poolSettings.leaveConfirm')}
        onCancel={() => setShowLeave(false)}
        onConfirm={() => {
          setShowLeave(false);
          void leave();
        }}
        title={ta('poolSettings.leaveTitle')}
        tone="danger"
        visible={showLeave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  content: {
    gap: spacing.md,
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
  memberSince: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  profileHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  edit: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  editLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  rowValue: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
    color: colors.text,
  },
  toggleCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  toggleBody: {
    paddingBottom: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  invitesCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  inviteRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.sm,
  },
  inviteText: {
    minWidth: 0,
    flex: 1,
  },
  inviteTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
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
  leave: {
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
  leaveLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: '#9B1C1C',
  },
  leaveNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
