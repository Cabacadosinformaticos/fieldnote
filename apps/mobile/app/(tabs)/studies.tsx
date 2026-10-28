import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/more/SettingsRow';
import {
  StudyCard,
  type StudyCardModel,
  type StudyCardState,
} from '@/components/more/StudyCard';
import { moreHref } from '@/components/more/navigation';
import { tm } from '@/i18n/tm';
import { erasureDues, purgeExpiredErasures, setErasureDue } from '@/state/actions';
import {
  getDeviceToken,
  listParticipations,
  saveParticipation,
  type Participation,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

type StudyRow = StudyCardModel & {
  requestedAt?: string | null;
};

function stateOf(
  participation: Participation,
  studyStatus: string | undefined,
  now: Date,
): StudyCardState {
  switch (participation.status) {
    case 'pending_approval':
      return 'pending';
    case 'withdrawn':
      return 'withdrawn';
    case 'removed':
      return 'removed';
    case 'declined':
      return 'declined';
    case 'erasure_scheduled':
      return 'erasing';
    default:
      break;
  }

  if (studyStatus === 'closed') {
    return 'ended';
  }

  if (participation.endsOn) {
    const end = new Date(`${participation.endsOn}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
      return 'ended';
    }
  }

  return 'active';
}

function rowFromParticipation(
  participation: Participation,
  erasureDueAt: string | null,
  now: Date,
): StudyRow {
  return {
    id: participation.studyId,
    title: participation.title,
    state: stateOf(participation, undefined, now),
    erasureDueAt,
    endsOn: participation.endsOn,
  };
}

function openStudy(row: StudyRow) {
  switch (row.state) {
    case 'active':
      router.push('/(tabs)');
      return;
    case 'pending':
      router.push({ pathname: '/join/waiting', params: { studyId: row.id } });
      return;
    case 'erasing':
      router.push({
        pathname: '/erase/scheduled',
        params: {
          scope: 'study',
          studyId: row.id,
          study: row.title,
          due: row.erasureDueAt ?? '',
          requested: row.requestedAt ?? '',
        },
      });
      return;
    case 'removed':
      router.push({ pathname: '/study/removed', params: { id: row.id } });
      return;
    default:
      router.push({ pathname: '/study/[id]', params: { id: row.id } });
  }
}

export default function StudiesScreen() {
  const [rows, setRows] = useState<StudyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    await purgeExpiredErasures().catch(() => undefined);
    const cached = await listParticipations().catch(() => []);
    const dues = await erasureDues().catch(
      () => ({} as Record<string, string>),
    );
    const now = new Date();

    setRows(
      cached.map((participation) =>
        rowFromParticipation(participation, dues[participation.studyId] ?? null, now),
      ),
    );
    setLoading(false);

    let failed = false;
    const refreshed = await Promise.all(
      cached.map(async (participation): Promise<StudyRow> => {
        const token = await getDeviceToken(participation.studyId).catch(
          () => null,
        );
        if (!token) {
          return rowFromParticipation(
            participation,
            dues[participation.studyId] ?? null,
            now,
          );
        }

        try {
          const { data } = await deviceClient(token).GET(
            '/api/v1/participation/me',
          );
          if (!data) {
            failed = true;
            return rowFromParticipation(
              participation,
              dues[participation.studyId] ?? null,
              now,
            );
          }

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

          const updated: Participation = {
            ...participation,
            studyId: data.study.id,
            title: data.study.title,
            status: data.status,
            alias: data.alias,
            startsOn: data.study.starts_on,
            endsOn: data.study.ends_on,
            timezone: data.study.timezone,
          };

          return {
            id: data.study.id,
            title: data.study.title,
            state: stateOf(updated, data.study.status, now),
            erasureDueAt: data.erasure_due_at,
            requestedAt: data.erasure_requested_at,
            endsOn: data.study.ends_on,
          };
        } catch {
          failed = true;
          return rowFromParticipation(
            participation,
            dues[participation.studyId] ?? null,
            now,
          );
        }
      }),
    );

    setRows(refreshed);
    setOffline(failed);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>{tm('studies.title')}</Text>
        <Text style={styles.subtitle}>
          {tm('studies.count', { count: rows.length })}
        </Text>
      </View>

      {rows.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{tm('studies.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{tm('studies.emptyBody')}</Text>
        </View>
      ) : null}

      {rows.map((study) => (
        <StudyCard
          key={study.id}
          onDetails={() =>
            router.push({ pathname: '/study/[id]', params: { id: study.id } })
          }
          onOpen={() => openStudy(study)}
          study={study}
        />
      ))}

      {offline ? (
        <Text style={styles.offline}>{tm('studies.offline')}</Text>
      ) : null}

      <View style={styles.moreCard}>
        <SettingsRow
          divider
          icon="add"
          onPress={() => router.push('/join/code')}
          title={tm('studies.enterAnother')}
        />
        <SettingsRow
          icon="settings-outline"
          onPress={() => router.push(moreHref('/settings'))}
          title={tm('studies.settings')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 1,
    paddingVertical: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  emptyCard: {
    gap: 4,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  offline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  moreCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
