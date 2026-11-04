import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { Screen } from '@/components/Screen';
import { formatDate } from '@/components/join/format';
import { clockOf } from '@/components/daily/entryFormat';
import { SettingsRow } from '@/components/more/SettingsRow';
import {
  type StudyCardModel,
  type StudyCardState,
} from '@/components/more/StudyCard';
import { StatusPill } from '@/components/more/StatusPill';
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

function metaFor(study: StudyCardModel): string {
  switch (study.state) {
    case 'erasing':
      return tm('studies.erasingNote');
    case 'ended':
      return study.endsOn
        ? tm('studies.endedOn', { date: formatDate(study.endsOn) })
        : tm('studies.ended');
    case 'pending':
      return tm('studies.pendingNote');
    case 'withdrawn':
      return tm('studies.withdrawnNote');
    case 'removed':
      return tm('studies.removedNote');
    case 'declined':
      return tm('studies.declinedNote');
    default:
      return tm('studies.activeNote');
  }
}

type StudyRowCardProps = {
  current: boolean;
  onDetails: () => void;
  onOpen: () => void;
  requests: OpenRequests | undefined;
  study: StudyRow;
};

function StudyRowCard({
  current,
  onDetails,
  onOpen,
  requests,
  study,
}: StudyRowCardProps) {
  const active = study.state === 'active';
  const requestLabel = active ? openRequestLabel(requests) : null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={study.title}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={styles.cardTitle}>{study.title}</Text>

          <View style={styles.pills}>
            {current && active ? (
              <StatusPill label={tm('studies.now')} tone="now" />
            ) : null}
            {active ? (
              <StatusPill label={tm('studies.active')} tone="active" />
            ) : null}
            {study.state === 'pending' ? (
              <StatusPill label={tm('studies.pending')} tone="now" />
            ) : null}
            {study.state === 'withdrawn' ? (
              <StatusPill label={tm('studies.withdrawn')} tone="ended" />
            ) : null}
            {study.state === 'removed' ? (
              <StatusPill label={tm('studies.removed')} tone="erasing" />
            ) : null}
            {study.state === 'declined' ? (
              <StatusPill label={tm('studies.declined')} tone="ended" />
            ) : null}
            {study.state === 'ended' ? (
              <StatusPill label={tm('studies.ended')} tone="ended" />
            ) : null}
            {study.state === 'erasing' ? (
              <>
                <StatusPill label={tm('studies.ended')} tone="ended" />
                <StatusPill
                  label={tm('studies.erasing', {
                    date: study.erasureDueAt
                      ? formatDate(study.erasureDueAt)
                      : '',
                  })}
                  tone="erasing"
                />
              </>
            ) : null}
          </View>

          <View style={styles.meta}>
            {active ? <View style={styles.dot} /> : null}
            <Text
              numberOfLines={2}
              style={[styles.metaText, !active && styles.metaTextMuted]}
            >
              {requestLabel ?? metaFor(study)}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable
        accessibilityLabel={tm('studies.details')}
        accessibilityRole="button"
        onPress={onDetails}
        style={({ pressed }) => [styles.details, pressed && styles.pressed]}
      >
        <Text style={styles.detailsLabel}>{tm('studies.details')}</Text>
      </Pressable>
    </View>
  );
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
        <StudyRowCard
          current={study.id === currentId}
          key={study.id}
          onDetails={() =>
            router.push({ pathname: '/study/[id]', params: { id: study.id } })
          }
          onOpen={() => openStudy(study, focusStudy)}
          requests={openRequests[study.id]}
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
  card: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: 14,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    minWidth: 0,
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  meta: {
    minHeight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  metaText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  metaTextMuted: {
    color: colors.textMuted,
  },
  details: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  detailsLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.primaryDark,
  },
});
