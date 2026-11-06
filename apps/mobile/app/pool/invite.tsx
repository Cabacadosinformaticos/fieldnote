import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { ConsentText } from '@/components/join/ConsentText';
import {
  formatDate,
  formatEntryTypes,
  formatPeriod,
  formatTeam,
} from '@/components/join/format';
import { ta } from '@/i18n/ta';
import { tj } from '@/i18n/tj';
import {
  acceptPoolInvitation,
  declinePoolInvitation,
  getPoolCredential,
  getPoolInvitation,
  type PoolInvitation,
} from '@/state/actions';
import {
  saveDeviceToken,
  saveParticipation,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function PoolInviteScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const invitationId = typeof params.id === 'string' ? params.id : '';
  const [credential, setCredential] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<PoolInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [showLater, setShowLater] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await getPoolCredential().catch(() => null);
      if (!stored || !invitationId) {
        setError(ta('poolInvite.loadError'));
        return;
      }

      setCredential(stored);
      const { data } = await getPoolInvitation(stored, invitationId);
      if (!data) {
        setError(ta('poolInvite.loadError'));
        return;
      }

      setInvitation(data);
    };

    void load();
  }, [invitationId]);

  const accept = async () => {
    if (!credential || !invitation) {
      return;
    }

    setBusy(true);
    setError(null);
    const { data, error: apiError } = await acceptPoolInvitation(
      credential,
      invitation.id,
      {
        consent_version: invitation.consent_version,
        locale: 'pt',
        android_id: null,
      },
    );
    setBusy(false);

    if (!data) {
      setError(apiErrorMessage(apiError));
      return;
    }

    const study = data.participant.study;
    await saveDeviceToken(study.id, data.device_token);
    await saveParticipation({
      studyId: study.id,
      title: study.title,
      description: study.description,
      team: study.team,
      maxPromptsPerDay: study.max_prompts_per_day,
      status: data.participant.status,
      alias: data.participant.alias,
      startsOn: study.starts_on,
      endsOn: study.ends_on,
      timezone: study.timezone,
    });
    router.replace(accountHref(`/study/${study.id}`));
  };

  const decline = async () => {
    if (!credential || !invitation) {
      return;
    }

    setShowDecline(false);
    setBusy(true);
    setError(null);
    const { error: apiError } = await declinePoolInvitation(
      credential,
      invitation.id,
    );
    setBusy(false);

    if (apiError !== null) {
      setError(apiErrorMessage(apiError));
      return;
    }

    router.replace(accountHref('/pool/settings'));
  };

  if (!invitation) {
    return (
      <Screen contentStyle={styles.content}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.body}>
          {error ?? ta('account.loading')}
        </Text>
      </Screen>
    );
  }

  const study = invitation.study;
  const details: { icon: IoniconName; label: string; value: string }[] = [
    {
      icon: 'person-outline',
      label: ta('poolInvite.team'),
      value: formatTeam(study.team),
    },
    {
      icon: 'calendar-outline',
      label: ta('poolInvite.duration'),
      value: formatPeriod(study.starts_on, study.ends_on),
    },
    {
      icon: 'notifications-outline',
      label: ta('poolInvite.requests'),
      value: ta('poolInvite.requestsFormat', {
        perDay: study.requests_per_day,
        minutes: study.expected_minutes_per_day,
      }),
    },
    {
      icon: 'camera-outline',
      label: ta('poolInvite.records'),
      value: formatEntryTypes(study.entry_types),
    },
    {
      icon: 'location-outline',
      label: ta('poolInvite.location'),
      value: ta(
        study.captures_location
          ? 'poolInvite.locationYes'
          : 'poolInvite.locationNo',
      ),
    },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={styles.title}>{ta('poolInvite.title')}</Text>

      <Note body={invitation.reason} icon="information-circle-outline" tone="info" />

      <View style={styles.card}>
        <View style={styles.studyIntro}>
          <Text style={styles.studyTitle}>{study.title}</Text>
          {study.description ? (
            <Text style={styles.studyBody}>{study.description}</Text>
          ) : null}
          <Text style={styles.expiry}>
            {ta('poolInvite.expiry', {
              received: formatDate(invitation.sent_at),
              expires: formatDate(invitation.expires_at),
            })}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons
                  name={detail.icon}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue}>{detail.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.consentCard}>
        <Text style={styles.consentTitle}>{tj('consent.title')}</Text>
        <Text style={styles.consentMeta}>
          {tj('consent.subtitle', {
            title: study.title,
            version: invitation.consent_version,
          })}
        </Text>
        <ConsentText study={study} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          disabled={busy}
          label={busy ? ta('poolInvite.acceptBusy') : ta('poolInvite.accept')}
          onPress={() => {
            void accept();
          }}
        />
        <Button
          disabled={busy}
          label={ta('poolInvite.decline')}
          onPress={() => setShowDecline(true)}
          variant="secondary"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowLater(true)}
          style={({ pressed }) => [styles.later, pressed && styles.pressed]}
        >
          <Text style={styles.laterLabel}>{ta('poolInvite.later')}</Text>
        </Pressable>
      </View>

      <ConfirmSheet
        body={ta('poolInvite.declineBody')}
        cancelLabel={ta('poolInvite.declineBack')}
        confirmLabel={ta('poolInvite.declineConfirm')}
        onCancel={() => setShowDecline(false)}
        onConfirm={() => {
          void decline();
        }}
        title={ta('poolInvite.declineTitle')}
        tone="dark"
        visible={showDecline}
      />

      <ConfirmSheet
        body={ta('poolInvite.laterBody', {
          date: formatDate(invitation.expires_at),
        })}
        confirmLabel={ta('poolInvite.laterOk')}
        onCancel={() => setShowLater(false)}
        onConfirm={() => setShowLater(false)}
        title={ta('poolInvite.laterTitle')}
        visible={showLater}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
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
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  studyIntro: {
    gap: 6,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    color: colors.text,
  },
  studyBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  expiry: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  consentCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  consentTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  consentMeta: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  details: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  detailIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  detailText: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  detailLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  detailValue: {
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
  actions: {
    gap: 10,
  },
  later: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterLabel: {
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
