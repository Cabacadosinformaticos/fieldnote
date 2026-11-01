import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deviceClientForStudy } from '@/api/client';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { formatDateTime } from '@/components/join/format';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { useJoinSession } from '@/state/join';
import {
  getParticipation,
  updateParticipationStatus,
  type Participation,
} from '@/state/participations';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const WAITING_ICON_BACKGROUND = '#FFF3D6';
const WAITING_ICON_COLOR = '#5C3900';
const POLL_INTERVAL_MS = 5000;

const NEXT_STEPS: { icon: IoniconName; title: string; body: string }[] = [
  {
    icon: 'notifications-outline',
    title: tj('waiting.acceptTitle'),
    body: tj('waiting.acceptBody'),
  },
  {
    icon: 'close-circle-outline',
    title: tj('waiting.declineTitle'),
    body: tj('waiting.declineBody'),
  },
  {
    icon: 'lock-closed-outline',
    title: tj('waiting.untilTitle'),
    body: tj('waiting.untilBody'),
  },
];

export default function WaitingScreen() {
  const { lookup } = useJoinSession();
  const params = useLocalSearchParams<{ studyId?: string }>();
  const studyId = params.studyId ?? lookup?.study.id ?? null;
  const [cached, setCached] = useState<Participation | null>(null);
  const [declined, setDeclined] = useState(false);
  const [offline, setOffline] = useState(false);
  const [missingToken, setMissingToken] = useState(false);

  useEffect(() => {
    if (!studyId) {
      router.replace('/');
      return;
    }

    let active = true;

    getParticipation(studyId)
      .then((row) => {
        if (active) {
          setCached(row);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [studyId]);

  useEffect(() => {
    if (!studyId) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const client = await deviceClientForStudy(studyId);
        if (!client) {
          if (active) {
            setMissingToken(true);
          }
          return;
        }

        if (active) {
          setMissingToken(false);
        }

        const { data } = await client.GET('/api/v1/participation/me/approval');
        if (!active) {
          return;
        }

        if (!data) {
          setOffline(true);
        } else {
          setOffline(false);

          if (data.status === 'active') {
            await updateParticipationStatus(studyId, data.status, data.alias).catch(
              () => undefined,
            );
            if (active) {
              active = false;
              router.replace('/(tabs)');
            }
            return;
          }

          if (
            data.status === 'declined' ||
            data.status === 'removed' ||
            data.status === 'erasure_scheduled'
          ) {
            setDeclined(true);
            return;
          }
        }
      } catch {
        if (active) {
          setOffline(true);
        }
      }

      if (active) {
        timer = setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [studyId]);

  const studyTitle = lookup?.study.title ?? cached?.title ?? '';
  const entryNote = cached
    ? lookup
      ? tj('waiting.entryNote', {
          kind:
            lookup.code_kind === 'study'
              ? tj('waiting.kindStudy')
              : tj('waiting.kindPersonal'),
          date: formatDateTime(cached.updatedAt),
        })
      : tj('waiting.entryNoteDate', { date: formatDateTime(cached.updatedAt) })
    : null;

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons name="time-outline" size={32} color={WAITING_ICON_COLOR} />
        </View>
        <Text style={typography.title}>
          {declined ? tj('waiting.declinedTitle') : tj('waiting.title')}
        </Text>
        <Text style={styles.body}>
          {declined ? tj('waiting.declinedBody') : tj('waiting.body')}
        </Text>
      </View>

      {studyTitle ? (
        <Card style={styles.studyCard}>
          <Text style={styles.studyLabel}>{tj('waiting.studyLabel')}</Text>
          <Text style={styles.studyTitle}>{studyTitle}</Text>
          {entryNote && !declined ? (
            <Text style={styles.studyNote}>{entryNote}</Text>
          ) : null}
        </Card>
      ) : null}

      {declined ? null : (
        <Card style={styles.nextCard}>
          <Text style={styles.nextTitle}>{tj('waiting.nextTitle')}</Text>
          <View style={styles.rows}>
            {NEXT_STEPS.map((step) => (
              <View key={step.title} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name={step.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{step.title}</Text>
                  <Text style={styles.rowBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {offline || missingToken ? (
        <Text style={styles.status}>
          {missingToken ? tj('waiting.noToken') : tj('waiting.offline')}
        </Text>
      ) : null}

      <Text style={styles.note}>{tj('waiting.note')}</Text>

      <View style={styles.spacer} />

      <Button
        label={tj('waiting.openStudies')}
        onPress={() => router.replace('/(tabs)/studies')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  intro: {
    alignItems: 'flex-start',
    gap: 14,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    backgroundColor: WAITING_ICON_BACKGROUND,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  studyCard: {
    gap: 4,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  studyLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text,
  },
  studyNote: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  nextCard: {
    gap: 14,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  nextTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  rows: {
    gap: 14,
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
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  rowBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textBody,
  },
  status: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
});
