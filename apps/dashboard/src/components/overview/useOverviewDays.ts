import { useQueries } from '@tanstack/react-query'
import { client } from '../../api/client'
import {
  addDays,
  studyKeys,
  type PlanPrompt,
  type Study,
  type StudyPlan,
} from '../../api/studies'

// The matrix needs one plan request per day. Fourteen keeps a long study from
// sending dozens of requests while still covering the usual two-week study.
const MAX_MATRIX_DAYS = 14

export type OverviewDay = {
  date: string
  dayNumber: number
  plan: StudyPlan | undefined
  isLoading: boolean
}

function elapsedDates(study: Study, today: string): string[] {
  const start = study.starts_on ?? today
  const end = study.ends_on !== null && today > study.ends_on ? study.ends_on : today
  if (end < start) {
    return []
  }
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date)
  }
  return dates.slice(-MAX_MATRIX_DAYS)
}

export function dayNumber(study: Study, date: string): number {
  if (!study.starts_on) {
    return 0
  }
  const diff = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${study.starts_on}T00:00:00Z`)) /
      86_400_000,
  )
  return diff + 1
}

export function promptsForParticipant(
  plan: StudyPlan | undefined,
  participantId: string,
): PlanPrompt[] {
  return (plan?.prompts ?? []).filter((prompt) => prompt.participant_id === participantId)
}

export function promptCell(prompts: PlanPrompt[]): { answered: number; sent: number } {
  let answered = 0
  let sent = 0
  for (const prompt of prompts) {
    if (prompt.status === 'answered') {
      answered += 1
      sent += 1
    } else if (prompt.status === 'sent' || prompt.status === 'expired') {
      sent += 1
    }
  }
  return { answered, sent }
}

export function useOverviewDays(
  studyId: string | undefined,
  study: Study | undefined,
  today: string | undefined,
): OverviewDay[] {
  const dates = study && today ? elapsedDates(study, today) : []
  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: studyKeys.plan(studyId ?? '', date),
      enabled: Boolean(studyId),
      queryFn: async (): Promise<StudyPlan> => {
        const { data, error, response } = await client.GET('/studies/{study_id}/plan', {
          params: { path: { study_id: studyId as string }, query: { date } },
        })
        if (data) {
          return data
        }
        throw new Error(
          (error as { error?: { message?: string } } | undefined)?.error?.message ??
            response.statusText,
        )
      },
    })),
  })

  return dates.map((date, index) => ({
    date,
    dayNumber: study ? dayNumber(study, date) : index + 1,
    plan: queries[index]?.data,
    isLoading: Boolean(queries[index]?.isLoading),
  }))
}
