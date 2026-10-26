import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { getAndroidId } from '@/api/device';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import {
  formatEntryTypes,
  formatPeriod,
  formatTeam,
} from '@/components/join/format';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/pt';
import { tj } from '@/i18n/tj';
import { useJoinSession } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Status = 'loading' | 'ready' | 'error';

export default function InvitationScreen() {
  const { code, lookup, reset, setLookup } = useJoinSession();
  const [status, setStatus] = useState<Status>(lookup ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lookup) {
      return;
    }

    if (!code) {
      router.replace('/join/code');
      return;
    }

    let active = true;

    const lookupCode = async () => {
      setStatus('loading');
      setError('');

      try {
        const result = await api.POST('/api/v1/participation/invitations/lookup', {
          body: { code, android_id: getAndroidId() },
        });

        if (!active) {
          return;
        }

        if (result.error || !result.data) {
          setError(apiErrorMessage(result.error));
          setStatus('error');
          return;
        }

        if (result.data.requires_account) {
          setError(tj('error.accountRequired'));
          setStatus('error');
          return;
        }

        const existing = result.data.existing_participation;
        if (existing) {
          switch (existing.status) {
            case 'active':
              setLookup(result.data);
              router.replace('/join/already');
              return;
            case 'pending_approval':
              setLookup(result.data);
              router.replace({
                pathname: '/join/waiting',
                params: { studyId: result.data.study.id },
              });
              return;
            case 'withdrawn':
              setLookup(result.data);
              router.replace('/join/return');
              return;
            case 'declined':
              setError(tj('error.entryDeclined'));
              setStatus('error');
              return;
            case 'removed':
              setError(tj('error.participationRemoved'));
              setStatus('error');
              return;
            case 'erasure_scheduled':
              setError(tj('error.erasureScheduled'));
              setStatus('error');
              return;
          }
        }

        setLookup(result.data);
        setStatus('ready');
      } catch {
        if (active) {
          setError(networkErrorMessage());
          setStatus('error');
        }
      }
    };

    void lookupCode();

    return () => {
      active = false;
    };
  }, [attempt, code, lookup, setLookup]);

  const study = lookup?.study;

  const details: { icon: IoniconName; label: string; value: string }[] =
    study && lookup
      ? [
          {
            icon: 'people-outline',
            label: t('invitation.teamLabel'),
            value: formatTeam(study.team),
          },
          {
            icon: 'calendar-outline',
            label: t('invitation.durationLabel'),
            value: formatPeriod(study.starts_on, study.ends_on),
          },
          {
            icon: 'notifications-outline',
            label: t('invitation.requestsLabel'),
            value: tj('invitation.requestsValue', {
              count: study.requests_per_day,
              minutes: study.expected_minutes_per_day,
            }),
          },
          {
            icon: 'camera-outline',
            label: t('invitation.recordsLabel'),
            value: formatEntryTypes(study.entry_types),
          },
          {
            icon: 'location-outline',
            label: t('invitation.locationLabel'),
            value: study.captures_location
              ? tj('invitation.locationValue')
              : tj('invitation.locationNone'),
          },
        ]
      : [];

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={typography.title}>{t('invitation.title')}</Text>

      {status === 'ready' && study ? (
        <>
          <Card style={styles.studyCard}>
            <View style={styles.studyIntro}>
              <Text style={typography.heading}>{study.title}</Text>
              {study.description ? (
                <Text style={styles.description}>{study.description}</Text>
              ) : null}
              {lookup?.code_kind === 'study' ? (
                <Text style={styles.codeKind}>{tj('invitation.studyCodeNote')}</Text>
              ) : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.details}>
              {details.map((detail) => (
                <View key={detail.label} style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name={detail.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>{detail.label}</Text>
                    <Text style={styles.detailValue}>{detail.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.actions}>
            <Button
              label={t('invitation.accept')}
              onPress={() => router.push('/join/consent')}
            />
            <Button
              label={t('invitation.decline')}
              variant="secondary"
              onPress={() => {
                reset();
                router.replace('/');
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Card style={styles.stateCard}>
            {status === 'loading' ? (
              <>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.stateText}>{tj('invitation.loading')}</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={colors.primaryDark}
                />
                <Text style={styles.stateTitle}>{tj('invitation.loadErrorTitle')}</Text>
                <Text style={styles.stateText}>{error}</Text>
              </>
            )}
          </Card>

          <View style={styles.spacer} />

          <View style={styles.actions}>
            <Button
              label={tj('invitation.retry')}
              onPress={() => setAttempt((value) => value + 1)}
            />
            <Button
              label={t('common.back')}
              variant="secondary"
              onPress={() => {
                reset();
                router.replace('/');
              }}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  studyCard: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  studyIntro: {
    gap: 6,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  codeKind: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  details: {
    gap: 14,
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
  stateCard: {
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.card,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.text,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textBody,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: 10,
  },
});
