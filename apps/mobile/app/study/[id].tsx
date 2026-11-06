import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deviceClient, type components } from '@/api/client';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Bullets } from '@/components/more/Bullets';
import { SettingsRow } from '@/components/more/SettingsRow';
import { StatusPill, type StatusTone } from '@/components/more/StatusPill';
import { moreHref } from '@/components/more/navigation';
import { formatDate, formatPeriod, formatTeam } from '@/components/join/format';
import { tm } from '@/i18n/tm';
import { setErasureDue } from '@/state/actions';
import {
  getDeviceToken,
  saveParticipation,
  type ParticipationInput,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

type ParticipantMe = components['schemas']['ParticipantMeOut'];

type StatusView = { label: string; tone: StatusTone };

function statusView(me: ParticipantMe): StatusView {
  switch (me.status) {
    case 'pending_approval':
      return { label: tm('studies.pending'), tone: 'now' };
    case 'withdrawn':
      return { label: tm('studies.withdrawn'), tone: 'ended' };
    case 'removed':
      return { label: tm('studies.removed'), tone: 'erasing' };
    case 'declined':
      return { label: tm('studies.declined'), tone: 'ended' };
    case 'erasure_scheduled':
      return {
        label: tm('studies.erasing', {
          date: formatDate(me.erasure_due_at),
        }),
        tone: 'erasing',
      };
    default:
      return { label: tm('studies.active'), tone: 'active' };
  }
}

function isEnded(me: ParticipantMe): boolean {
  if (me.study.status === 'closed') {
    return true;
  }

  if (!me.study.ends_on) {
    return false;
  }

  const end = new Date(`${me.study.ends_on}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

function rowModel(me: ParticipantMe): ParticipationInput {
  return {
    studyId: me.study.id,
    title: me.study.title,
    description: me.study.description,
    consentText: me.study.consent_text,
    team: me.study.team,
    maxPromptsPerDay: me.study.max_prompts_per_day,
    status: me.status,
    alias: me.alias,
    startsOn: me.study.starts_on,
    endsOn: me.study.ends_on,
    timezone: me.study.timezone,
  };
}

export default function StudyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [me, setMe] = useState<ParticipantMe | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    const deviceToken = await getDeviceToken(id).catch(() => null);
    setToken(deviceToken);
    if (!deviceToken) {
      setError(tm('study.loadError'));
      setLoading(false);
      return;
    }

    try {
      const { data } = await deviceClient(deviceToken).GET(
        '/api/v1/participation/me',
      );
      if (!data) {
        setError(tm('study.loadError'));
        return;
      }

      setMe(data);
      setError(null);
      await saveParticipation(rowModel(data)).catch(() => undefined);
      await setErasureDue(data.study.id, data.erasure_due_at).catch(
        () => undefined,
      );
    } catch {
      setError(networkErrorMessage());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const apply = async (next: ParticipantMe) => {
    setMe(next);
    await saveParticipation(rowModel(next)).catch(() => undefined);
    await setErasureDue(next.study.id, next.erasure_due_at).catch(
      () => undefined,
    );
  };

  const leave = async () => {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data, error: apiError } = await deviceClient(token).POST(
        '/api/v1/participation/me/leave',
      );
      if (!data) {
        setError(apiErrorMessage(apiError));
        return;
      }

      await apply(data);
      setLeaving(false);
    } catch {
      setError(tm('study.leaveError'));
    } finally {
      setBusy(false);
    }
  };

  const returnToStudy = async () => {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data, error: apiError } = await deviceClient(token).POST(
        '/api/v1/participation/me/return',
      );
      if (!data) {
        setError(apiErrorMessage(apiError));
        return;
      }

      await apply(data);
    } catch {
      setError(tm('study.returnError'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen contentStyle={styles.loadingContent}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>{tm('study.loading')}</Text>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen contentStyle={styles.content}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackLink label={tm('study.back')} onPress={() => router.back()} />
          <Text style={styles.title}>{tm('study.title')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.body}>{error ?? tm('study.loadError')}</Text>
        </View>
      </Screen>
    );
  }

  const status = statusView(me);
  const ended = isEnded(me);
  const canLeave =
    (me.status === 'active' || me.status === 'pending_approval') && !ended;
  const canReturn = me.status === 'withdrawn' && !ended;
  const erasureAllowed =
    me.status !== 'declined' &&
    me.status !== 'pending_approval' &&
    me.status !== 'erasure_scheduled';

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={tm('study.back')} onPress={() => router.back()} />
        <Text style={styles.title}>{tm('study.title')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.studyTop}>
          <Text style={styles.studyName}>{me.study.title}</Text>
          <StatusPill label={status.label} tone={status.tone} />
        </View>
        {me.study.description ? (
          <Text style={styles.body}>{me.study.description}</Text>
        ) : null}
        <Text style={styles.period}>
          {formatPeriod(me.study.starts_on, me.study.ends_on)}
        </Text>
        {me.status === 'pending_approval' ? (
          <Text style={styles.body}>{tm('study.pendingBody')}</Text>
        ) : null}
      </View>

      <View style={styles.teamSection}>
        <Text style={styles.sectionLabel}>{tm('study.team')}</Text>
        <View style={styles.teamCard}>
          <Text style={styles.teamValue}>
            {formatTeam(me.study.team)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/join/consent-text',
            params: { studyId: me.study.id },
          })
        }
        style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
      >
        <Ionicons
          name="document-text-outline"
          size={20}
          color={colors.textMuted}
        />
        <Text style={styles.consentLabel}>{tm('study.rereadConsent')}</Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      <View style={styles.leaveSection}>
        <Text style={styles.sectionLabel}>{tm('study.leaveOrErase')}</Text>
        <View style={styles.actionsCard}>
          {canReturn ? (
            <SettingsRow
              divider={erasureAllowed}
              icon="return-down-back-outline"
              onPress={() => {
                void returnToStudy();
              }}
              subtitle={
                busy ? tm('study.returning') : tm('study.returnBody')
              }
              title={tm('study.return')}
            />
          ) : null}

          {canLeave ? (
            <SettingsRow
              divider={erasureAllowed}
              icon="log-out-outline"
              onPress={() => setLeaving(true)}
              subtitle={tm('study.leaveBody')}
              title={tm('study.leave')}
            />
          ) : null}

          {me.status === 'erasure_scheduled' ? (
            <SettingsRow
              icon="refresh-outline"
              onPress={() =>
                router.push({
                  pathname: '/erase/scheduled',
                  params: {
                    scope: 'study',
                    studyId: me.study.id,
                    study: me.study.title,
                    due: me.erasure_due_at ?? '',
                    requested: me.erasure_requested_at ?? '',
                  },
                })
              }
              subtitle={tm('study.cancelErasureBody')}
              title={tm('study.cancelErasure')}
            />
          ) : null}

          {erasureAllowed ? (
            <SettingsRow
              danger
              icon="trash-outline"
              onPress={() => router.push(moreHref(`/erase/${me.study.id}`))}
              subtitle={tm('study.eraseBody')}
              title={tm('study.erase')}
            />
          ) : null}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.version}>{tm('settings.version')}</Text>

      <Modal
        animationType="fade"
        onRequestClose={() => setLeaving(false)}
        transparent
        visible={leaving}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={tm('common.cancel')}
            accessibilityRole="button"
            onPress={() => setLeaving(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>{tm('study.leaveTitle')}</Text>
            <Bullets
              items={[
                tm('study.leaveB1'),
                tm('study.leaveB2'),
                tm('study.leaveB3'),
              ]}
            />
            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => {
                  void leave();
                }}
                style={({ pressed }) => [
                  styles.leaveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.leaveLabel}>
                  {busy ? tm('study.leaving') : tm('study.leaveConfirm')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLeaving(false)}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelLabel}>{tm('common.cancel')}</Text>
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
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  card: {
    gap: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  studyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  studyName: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  period: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  teamSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  teamCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  teamValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  sectionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  consentRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  consentLabel: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  leaveSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
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
  dialogActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  leaveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: '#9B1C1C',
  },
  leaveLabel: {
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
