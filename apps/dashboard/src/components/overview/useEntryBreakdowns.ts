import { useQueries } from '@tanstack/react-query'
import { client } from '../../api/client'
import {
  entryKeys,
  type ActivityOut,
  type EntryFilters,
  type EntryListResponse,
  type EntryType,
} from '../../api/entries'

const entryTypes: EntryType[] = ['photo', 'text', 'audio', 'video', 'scale', 'choice']

export type EntryBreakdowns = {
  byType: { type: EntryType; total: number }[]
  byActivity: { activity: ActivityOut; total: number; free: number }[]
  late: number
  isLoading: boolean
}

function totalQuery(studyId: string, query: Record<string, unknown>) {
  return {
    queryKey: entryKeys.list(studyId, query as EntryFilters),
    queryFn: async (): Promise<number> => {
      const { data, error, response } = await client.GET('/studies/{study_id}/entries', {
        params: {
          path: { study_id: studyId },
          query: { limit: 1, ...query } as never,
        },
      })
      if (data) {
        return (data as EntryListResponse).total
      }
      throw new Error(
        (error as { error?: { message?: string } } | undefined)?.error?.message ??
          response.statusText,
      )
    },
  }
}

export function useEntryBreakdowns(
  studyId: string | undefined,
  activities: ActivityOut[],
): EntryBreakdowns {
  const typeQueries = useQueries({
    queries: entryTypes.map((type) => ({
      ...totalQuery(studyId ?? '', { entry_type: type }),
      enabled: Boolean(studyId),
    })),
  })
  const activityTotals = useQueries({
    queries: activities.flatMap((activity) => [
      {
        ...totalQuery(studyId ?? '', { activity_id: activity.id }),
        enabled: Boolean(studyId),
      },
      {
        ...totalQuery(studyId ?? '', { activity_id: activity.id, free_only: true }),
        enabled: Boolean(studyId),
      },
    ]),
  })
  const lateQuery = useQueries({
    queries: [
      {
        ...totalQuery(studyId ?? '', { late_only: true }),
        enabled: Boolean(studyId),
      },
    ],
  })[0]

  return {
    byType: entryTypes.map((type, index) => ({
      type,
      total: typeQueries[index]?.data ?? 0,
    })),
    byActivity: activities.map((activity, index) => ({
      activity,
      total: activityTotals[index * 2]?.data ?? 0,
      free: activityTotals[index * 2 + 1]?.data ?? 0,
    })),
    late: lateQuery?.data ?? 0,
    isLoading:
      typeQueries.some((query) => query.isLoading) ||
      activityTotals.some((query) => query.isLoading) ||
      Boolean(lateQuery?.isLoading),
  }
}
