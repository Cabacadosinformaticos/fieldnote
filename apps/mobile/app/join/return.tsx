import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { accountClient, api, deviceClient } from '@/api/client';
import { getAndroidId } from '@/api/device';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { formatDate, formatPeriod, formatTeam } from '@/components/join/format';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { getAccountToken } from '@/state/actions';
import { useJoinSession } from '@/state/join';
import {
  getDeviceToken,
  saveDeviceToken,
  saveParticipation,
} from '@/state/participations';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function ReturnScreen() {
  const { answers, code, lookup, reset } = useJoinSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const study = lookup?.study;
  const existing = lookup?.existing_participation;

  useEffect(() => {
    if (!lookup) {
      router.replace('/');
    }
  }, [lookup]);

  const confirm = async () => {
    if (!lookup) {
      router.replace('/');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const storedToken = await getDeviceToken(lookup.study.id);
      const accountToken = lookup.requires_account
        ? await getAccountToken().catch(() => null)
        : null;
      const client = accountToken
        ? accountClient(accountToken)
        : storedToken
          ? deviceClient(storedToken)
          : api;
      const accepted = await client.POST(
        '/api/v1/participation/invitations/accept',
        {
          body: {
            code: code ?? '',
            android_id: getAndroidId(),
            locale: 'pt',
            consent_version: lookup.consent_version,
            answers,
          },
        },
      );

      if (!accepted.data) {
        setError(apiErrorMessage(accepted.error));
        return;
      }

      if (accepted.data.device_token) {
        await saveDeviceToken(lookup.study.id, accepted.data.device_token);
      }

      await saveParticipation({
        studyId: lookup.study.id,
        title: lookup.study.title,
        status: accepted.data.participant.status,
        alias: accepted.data.participant.alias,
        startsOn: lookup.study.starts_on,
        endsOn: lookup.study.ends_on,
        timezone: lookup.study.timezone,
      });

      const status = accepted.data.participant.status;
      if (status !== 'pending_approval' && status !== 'active') {
        setError(tj('error.generic'));
        return;
      }

      const studyId = lookup.study.id;
      // Unmount the join stack before leaving, so its screens stop reacting to
      // the session while we navigate to the study.
      router.dismissAll();

      if (status === 'pending_approval') {
        router.replace({ pathname: '/join/waiting', params: { studyId } });
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setError(networkErrorMessage());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={typography.title}>
        {existing?.decided_at
          ? tj('return.title', { date: formatDate(existing.decided_at) })
          : tj('return.titleUnknown')}
      </Text>

      <Card style={styles.studyCard}>
        <View style={styles.studyIntro}>
          <Text style={styles.studyTitle}>
            {tj('study.title', { title: study?.title ?? '' })}
          </Text>
          <Text style={styles.studyPeriod}>
            {tj('study.period', {
              period: formatPeriod(study?.starts_on, study?.ends_on),
            })}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{tj('study.teamLabel')}</Text>
            <Text style={styles.rowValue}>
              {tj('study.team', { team: formatTeam(study?.team ?? []) })}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.infoNote}>
        <Ionicons name="book-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.infoNoteText}>{tj('return.info')}</Text>
      </View>

      <View style={styles.codeNote}>
        <Ionicons name="checkmark" size={20} color={colors.successText} />
        <Text style={styles.codeNoteText}>{tj('code.note')}</Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          disabled={submitting}
          label={submitting ? tj('return.confirming') : tj('return.confirm')}
          onPress={() => {
            void confirm();
          }}
        />
        <Button
          label={tj('return.decline')}
          onPress={() => {
            reset();
            router.replace('/');
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
  studyCard: {
    gap: spacing.lg,
    borderRadius: radii.card,
    padding: spacing.xl,
  },
  studyIntro: {
    gap: 4,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    color: colors.text,
  },
  studyPeriod: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  rowText: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  rowValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  codeNote: {
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
  codeNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textBody,
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
