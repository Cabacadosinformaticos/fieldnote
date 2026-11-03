import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { t } from '../i18n/studies'
import { client } from './client'
import type { components } from './schema'

export type Study = components['schemas']['StudyOut']
export type StudyListItem = components['schemas']['StudyListItemOut']
export type StudyMember = components['schemas']['StudyMemberOut']
export type StudyRole = components['schemas']['StudyRole']
export type StudyStatusApi = components['schemas']['StudyStatus']
export type Participant = components['schemas']['ParticipantOut']
export type Approval = components['schemas']['ApprovalOut']
export type Adherence = components['schemas']['AdherenceResponse']
export type Timeline = components['schemas']['TimelineResponse']
export type TimelineEntry = components['schemas']['TimelineEntry']
export type Entry = components['schemas']['EntryOut']
export type StudyOverview = components['schemas']['StudyOverviewOut']
export type OverviewAlert = components['schemas']['OverviewAlert']
export type StudyPlan = components['schemas']['StudyPlanOut']
export type PlanParticipant = components['schemas']['PlanParticipant']
export type PlanPrompt = components['schemas']['PlanPrompt']
export type StudyQuestion = components['schemas']['StudyQuestionOut']
export type QuestionKind = components['schemas']['QuestionKind']
export type StudyConsent = components['schemas']['StudyConsentOut']
export type StudyUpdate = components['schemas']['StudyUpdate']
export type PromptStatus = components['schemas']['PromptStatus']
export type UnplannedReason = components['schemas']['UnplannedReason']

export type StudyStatus = 'ongoing' | 'draft' | 'finished'

export type StudyMetricKind =
  | 'participants'
  | 'entries'
  | 'adherence'
  | 'adherenceFinal'
  | 'adherenceDraft'

export type StudyMetric = {
  kind: StudyMetricKind
  value: string
  note: string
}

export type StudySummary = {
  id: string
  title: string
  description: string
  status: StudyStatus
  role: StudyRole | null
  period: string
  schedule: string
  metrics: StudyMetric[]
}

export type EntryKind = 'photo' | 'text' | 'audio' | 'video'

export type FeedItem = {
  alias: string
  type: string
  activity: string
  recorded: string
  received: string
  delay: string
  late: boolean
  kind: EntryKind
  sky?: string
  ground?: string
  tree?: string
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

export class StudiesApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'StudiesApiError'
    this.code = code
    this.status = status
  }
}

function toApiError(error: unknown, response: Response): StudiesApiError {
  const body = error as ErrorEnvelope | undefined
  return new StudiesApiError(
    body?.error?.code ?? `http_${response.status}`,
    response.status,
    body?.error?.message ?? response.statusText,
  )
}

export function studiesErrorMessage(error: unknown): string {
  if (!(error instanceof StudiesApiError)) {
    return t('error.network')
  }

  switch (error.code) {
    case 'study_not_found':
      return t('error.study_not_found')
    case 'forbidden':
      return t('error.forbidden')
    case 'study_closed':
      return t('error.study_closed')
    case 'invalid_status_transition':
      return t('error.invalid_status_transition')
    case 'user_not_found':
      return t('error.user_not_found')
    case 'not_a_researcher':
      return t('error.not_a_researcher')
    case 'already_a_member':
      return t('error.already_a_member')
    case 'last_principal_investigator':
      return t('error.last_principal_investigator')
    case 'invalid_question':
      return t('error.invalid_question')
    case 'validation_error':
      return t('error.validation')
    case 'not_authenticated':
      return t('error.not_authenticated')
    default:
      return t('error.generic')
  }
}

export function statusFromApi(status: StudyStatusApi): StudyStatus {
  if (status === 'running') {
    return 'ongoing'
  }
  if (status === 'closed') {
    return 'finished'
  }
  return 'draft'
}

const styleLabels = {
  fixed: 'new.style.fixed.name',
  balanced: 'new.style.balanced.name',
  varied: 'new.style.varied.name',
} as const

export function styleLabel(style: Study['schedule_style']): string {
  return t(styleLabels[style])
}

export function formatDate(iso: string | null): string {
  if (!iso) {
    return t('common.none')
  }
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T12:00:00Z`),
  )
}

export function formatFullDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`))
}

function dayDiff(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  )
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dateInTimezone(value: string | Date, timezone: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function todayInTimezone(timezone: string): string {
  return dateInTimezone(new Date(), timezone)
}

type Clock = { hour: number; minute: number }

export function clockInTimezone(value: string | Date, timezone: string): Clock {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

export function nowClockInTimezone(timezone: string): Clock {
  return clockInTimezone(new Date(), timezone)
}

export function timeLabel(value: string | null, timezone: string): string {
  if (!value) {
    return '–'
  }
  const { hour, minute } = clockInTimezone(value, timezone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function shortDateLabel(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00Z`))
}

export function studyRange(study: Study): string {
  if (!study.starts_on && !study.ends_on) {
    return t('common.none')
  }
  if (study.starts_on && study.ends_on) {
    return `${formatDate(study.starts_on)} a ${formatFullDate(study.ends_on)}`
  }
  return formatDate(study.starts_on ?? study.ends_on)
}

export function studyDay(
  study: Study,
  today: string,
): { day: number; total: number } {
  if (!study.starts_on || !study.ends_on) {
    return { day: 0, total: 0 }
  }
  const total = dayDiff(study.starts_on, study.ends_on) + 1
  const day = Math.min(Math.max(dayDiff(study.starts_on, today) + 1, 0), total)
  return { day, total }
}

export const studyKeys = {
  all: ['studies'] as const,
  list: () => [...studyKeys.all, 'list'] as const,
  detail: (studyId: string) => [...studyKeys.all, 'detail', studyId] as const,
  members: (studyId: string) => [...studyKeys.all, 'members', studyId] as const,
  participants: (studyId: string) => [...studyKeys.all, 'participants', studyId] as const,
  approvals: (studyId: string) => [...studyKeys.all, 'approvals', studyId] as const,
  timeline: (studyId: string, start: string, end: string) =>
    [...studyKeys.all, 'timeline', studyId, start, end] as const,
  entries: (studyId: string) => [...studyKeys.all, 'entries', studyId] as const,
  overview: (studyId: string) => [...studyKeys.all, 'overview', studyId] as const,
  plan: (studyId: string, date: string) => [...studyKeys.all, 'plan', studyId, date] as const,
  questions: (studyId: string) => [...studyKeys.all, 'questions', studyId] as const,
  consent: (studyId: string) => [...studyKeys.all, 'consent', studyId] as const,
}

async function fetchStudy(studyId: string): Promise<Study> {
  const { data, error, response } = await client.GET('/studies/{study_id}', {
    params: { path: { study_id: studyId } },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchMembers(studyId: string): Promise<StudyMember[]> {
  const { data, error, response } = await client.GET('/studies/{study_id}/members', {
    params: { path: { study_id: studyId } },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchParticipants(studyId: string): Promise<Participant[]> {
  const { data, error, response } = await client.GET('/studies/{study_id}/participants', {
    params: { path: { study_id: studyId } },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchApprovals(studyId: string): Promise<Approval[]> {
  const { data, error, response } = await client.GET('/studies/{study_id}/approvals', {
    params: { path: { study_id: studyId } },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchTimeline(studyId: string, start: string, end: string): Promise<Timeline> {
  const { data, error, response } = await client.GET('/studies/{study_id}/timeline', {
    params: {
      path: { study_id: studyId },
      query: { start, end, zoom: 'day' },
    },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

export function useStudies(enabled = true) {
  return useQuery({
    queryKey: studyKeys.list(),
    enabled,
    queryFn: async () => {
      const { data, error, response } = await client.GET('/studies')
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useStudyCard(study: StudyListItem): StudySummary {
  const { user } = useAuth()
  const members = useStudyMembers(study.id)
  const member = members.data?.find((item) => item.user_id === user?.id)
  const role: StudyRole | null =
    user?.role === 'admin' ? 'principal_investigator' : (member?.role ?? null)
  const status = statusFromApi(study.status)
  const studyDays =
    study.starts_on && study.ends_on
      ? dayDiff(study.starts_on, study.ends_on) + 1
      : 0

  let adherenceMetric: StudyMetric
  if (status === 'draft') {
    adherenceMetric = {
      kind: 'adherenceDraft',
      value: '–',
      note: t('list.metric.adherenceNotStarted'),
    }
  } else if (status === 'finished') {
    const adherence = study.adherence_study
    adherenceMetric = {
      kind: 'adherenceFinal',
      value: `${adherence.percentage} %`,
      note:
        studyDays > 0
          ? t('list.metric.adherenceFinalNote', { days: studyDays })
          : t('list.metric.adherenceNote', {
              answered: adherence.answered,
              out: adherence.out,
            }),
    }
  } else {
    const adherence = study.adherence_today
    adherenceMetric = {
      kind: 'adherence',
      value: `${adherence.percentage} %`,
      note: t('list.metric.adherenceNote', {
        answered: adherence.answered,
        out: adherence.out,
      }),
    }
  }

  return {
    id: study.id,
    title: study.title,
    description: study.description ?? t('list.noDescription'),
    status,
    role,
    period: studyRange(study),
    schedule: t('list.schedule', {
      style: styleLabel(study.schedule_style),
      max: study.max_prompts_per_day,
    }),
    metrics: [
      {
        kind: 'participants',
        value: String(study.participant_count),
        note: '',
      },
      {
        kind: 'entries',
        value: String(study.entry_count),
        note: '',
      },
      adherenceMetric,
    ],
  }
}

export function useStudy(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.detail(studyId ?? ''),
    queryFn: () => fetchStudy(studyId as string),
    enabled: Boolean(studyId),
  })
}

export function useStudyMembers(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.members(studyId ?? ''),
    queryFn: () => fetchMembers(studyId as string),
    enabled: Boolean(studyId),
  })
}

export function useParticipants(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.participants(studyId ?? ''),
    queryFn: () => fetchParticipants(studyId as string),
    enabled: Boolean(studyId),
  })
}

export function useApprovals(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.approvals(studyId ?? ''),
    queryFn: () => fetchApprovals(studyId as string),
    enabled: Boolean(studyId),
  })
}

function timelineRange(study: Study | undefined): { start: string; end: string } {
  const end = new Date()
  const start = study?.starts_on
    ? new Date(`${study.starts_on}T00:00:00Z`)
    : new Date(end.getTime() - 90 * 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function useTimeline(studyId: string | undefined, study: Study | undefined) {
  const { start, end } = timelineRange(study)
  return useQuery({
    queryKey: studyKeys.timeline(studyId ?? '', start, end),
    queryFn: () => fetchTimeline(studyId as string, start, end),
    enabled: Boolean(studyId && study),
  })
}

export type StudyAccess = {
  role: StudyRole | null
  isAdmin: boolean
  isMember: boolean
  canDesign: boolean
  canManage: boolean
  isLoading: boolean
  error: unknown
}

export function useStudyRole(studyId: string | undefined): StudyAccess {
  const { user } = useAuth()
  const members = useStudyMembers(studyId)
  const isAdmin = user?.role === 'admin'
  const member = members.data?.find((item) => item.user_id === user?.id)
  const role = isAdmin ? 'principal_investigator' : (member?.role ?? null)
  const isMember = isAdmin || Boolean(member)

  return {
    role,
    isAdmin,
    isMember,
    canDesign: role === 'principal_investigator' || role === 'co_investigator',
    canManage: role === 'principal_investigator',
    isLoading: members.isLoading,
    error: members.error,
  }
}

export function useStudyOverview(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.overview(studyId ?? ''),
    queryFn: async (): Promise<StudyOverview> => {
      if (!studyId) {
        throw new StudiesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/overview', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    enabled: Boolean(studyId),
  })
}

export function useStudyPlan(studyId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: studyKeys.plan(studyId ?? '', date ?? ''),
    queryFn: async (): Promise<StudyPlan> => {
      if (!studyId || !date) {
        throw new StudiesApiError('study_missing', 0, 'The study or date is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/plan', {
        params: { path: { study_id: studyId }, query: { date } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    enabled: Boolean(studyId && date),
    placeholderData: (previous) => previous,
  })
}

export function useStudyQuestions(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.questions(studyId ?? ''),
    queryFn: async (): Promise<StudyQuestion[]> => {
      if (!studyId) {
        throw new StudiesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/questions', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    enabled: Boolean(studyId),
  })
}

export function useStudyConsent(studyId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.consent(studyId ?? ''),
    queryFn: async (): Promise<StudyConsent> => {
      if (!studyId) {
        throw new StudiesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/consent', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    enabled: Boolean(studyId),
  })
}

export function useCreateStudy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: components['schemas']['StudyCreate']) => {
      const { data, error, response } = await client.POST('/studies', { body })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.list() })
    },
  })
}

export function useStartStudy(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await client.POST('/studies/{study_id}/start', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.detail(studyId) })
      void queryClient.invalidateQueries({ queryKey: studyKeys.list() })
    },
  })
}

export function useCloseStudy(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await client.POST('/studies/{study_id}/close', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.detail(studyId) })
      void queryClient.invalidateQueries({ queryKey: studyKeys.list() })
    },
  })
}

export function useUpdateStudy(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: StudyUpdate) => {
      const { data, error, response } = await client.PATCH('/studies/{study_id}', {
        params: { path: { study_id: studyId } },
        body,
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.detail(studyId) })
      void queryClient.invalidateQueries({ queryKey: studyKeys.list() })
    },
  })
}

export function useCreateQuestion(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: components['schemas']['StudyQuestionCreate']) => {
      const { data, error, response } = await client.POST('/studies/{study_id}/questions', {
        params: { path: { study_id: studyId } },
        body,
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.questions(studyId) })
    },
  })
}

export function useUpdateQuestion(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      questionId,
      body,
    }: {
      questionId: string
      body: components['schemas']['StudyQuestionUpdate']
    }) => {
      const { data, error, response } = await client.PATCH(
        '/studies/{study_id}/questions/{question_id}',
        { params: { path: { study_id: studyId, question_id: questionId } }, body },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.questions(studyId) })
    },
  })
}

export function useDeleteQuestion(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error, response } = await client.DELETE(
        '/studies/{study_id}/questions/{question_id}',
        { params: { path: { study_id: studyId, question_id: questionId } } },
      )
      if (!response.ok) {
        throw toApiError(error, response)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.questions(studyId) })
    },
  })
}

export function useReorderQuestions(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (questionIds: string[]) => {
      const { data, error, response } = await client.PUT(
        '/studies/{study_id}/questions/order',
        {
          params: { path: { study_id: studyId } },
          body: { question_ids: questionIds },
        },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.questions(studyId) })
    },
  })
}

export function useAddStudyMember(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: components['schemas']['StudyMemberCreate']) => {
      const { data, error, response } = await client.POST('/studies/{study_id}/members', {
        params: { path: { study_id: studyId } },
        body,
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.members(studyId) })
    },
  })
}

export function useChangeStudyMemberRole(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: StudyRole }) => {
      const { data, error, response } = await client.PATCH(
        '/studies/{study_id}/members/{user_id}',
        { params: { path: { study_id: studyId, user_id: userId } }, body: { role } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.members(studyId) })
    },
  })
}

export function useRemoveStudyMember(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error, response } = await client.DELETE(
        '/studies/{study_id}/members/{user_id}',
        { params: { path: { study_id: studyId, user_id: userId } } },
      )
      if (!response.ok) {
        throw toApiError(error, response)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studyKeys.members(studyId) })
    },
  })
}
