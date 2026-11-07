import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { Screen } from '@/components/Screen';
import { clockOf } from '@/components/daily/entryFormat';
import { SettingsRow } from '@/components/more/SettingsRow';
import {
  StudyCard,
  type StudyCardModel,
  type StudyCardState,
} from '@/components/more/StudyCard';
import { moreHref } from '@/components/more/navigation';
import { tm } from '@/i18n/tm';
import { loadTodayPrompts } from '@/queue/prompts';
import type { PromptActivity } from '@/queue/types';
import { erasureDues, purgeExpiredErasures, setErasureDue } from '@/state/actions';
import {
  getDeviceToken,
  listParticipations,
  saveParticipation,
  type Participation,
} from '@/state/participations';
import { useStudyFocus } from '@/state/studyFocus';
import { colors, fonts, radii, spacing } from '@/theme';

type StudyRow = StudyCardModel & {
  requestedAt?: string | null;
};

type OpenRequests = {
  count: number;
  closesAt: string | null;
};

function stateOf(
  participation: Participation,
  studyStatus: string | undefined,
  now: Date,
  erasureDueAt: string | null = null,
): StudyCardState {
  // A pending erasure outranks the study ending: the card must offer the date and the cancel.
  if (erasureDueAt || participation.status === 'erasure_scheduled') {
    return 'erasing';
  }

  switch (participation.status) {
    case 'pending_approval':
      return 'pending';
    case 'withdrawn':
      return 'withdrawn';
    case 'removed':
      return 'removed';
    case 'declined':
      return 'declined';
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
    state: stateOf(participation, undefined, now, erasureDueAt),
    erasureDueAt,
    endsOn: participation.endsOn,
  };
}

function openRequestsOf(
  activities: PromptActivity[],
): Record<string, OpenRequests> {
  const result: Record<string, OpenRequests> = {};

  for (const activity of activities) {
    const closesAt = activity.closesAt || null;
    const current = result[activity.studyId];
    if (!current) {
      result[activity.studyId] = { count: 1, closesAt };
      continue;
    }

    current.count += 1;
    if (closesAt && (!current.closesAt || closesAt < current.closesAt)) {
      current.closesAt = closesAt;
    }
  }

  return result;
}

function openRequestLabel(requests: OpenRequests | undefined): string | null {
  if (!requests || requests.count === 0) {
    return null;
  }

  if (requests.count === 1) {
    return requests.closesAt
      ? tm('studies.openRequestUntil', { time: clockOf(requests.closesAt) })
      : tm('studies.openRequest');
  }

  return tm('studies.openRequests', { count: requests.count });
}

function openStudy(
  row: StudyRow,
  focusStudy: (studyId: string) => void,
) {
  switch (row.state) {
    case 'active':
      focusStudy(row.id);
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
  const { focusStudy, focusedStudyId } = useStudyFocus();
  const [rows, setRows] = useState<StudyRow[]>([]);
  const [openRequests, setOpenRequests] = useState<Record<string, OpenRequests>>(
    {},
  );
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

    // The open prompts of every study, the same source as the tab badge (FR-82).
    const prompts = await loadTodayPrompts().catch(() => null);
    if (prompts) {
      setOpenRequests(openRequestsOf(prompts.activities));
    }

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
            description: data.study.description,
            team: data.study.team,
            maxPromptsPerDay: data.study.max_prompts_per_day,
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
            description: data.study.description,
            team: data.study.team,
            maxPromptsPerDay: data.study.max_prompts_per_day,
            status: data.status,
            alias: data.alias,
            startsOn: data.study.starts_on,
            endsOn: data.study.ends_on,
            timezone: data.study.timezone,
          };

          return {
            id: data.study.id,
            title: data.study.title,
            state: stateOf(
              updated,
              data.study.status,
              now,
              data.erasure_due_at,
            ),
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

  // Today shows the focused study, otherwise the first active one.
  const currentId =
    rows.find((row) => row.id === focusedStudyId)?.id ??
    rows.find((row) => row.state === 'active')?.id ??
    rows[0]?.id ??
    null;

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>{tm('studies.title')}</Text>
        <Text style={styles.subtitle}>
          {rows.length === 1
            ? tm('studies.countOne')
            : tm('studies.count', { count: rows.length })}
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
          current={study.id === currentId}
          key={study.id}
          onDetails={() =>
            router.push({ pathname: '/study/[id]', params: { id: study.id } })
          }
          onOpen={() => openStudy(study, focusStudy)}
          requestLabel={
            study.state === 'active'
              ? openRequestLabel(openRequests[study.id])
              : null
          }
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
