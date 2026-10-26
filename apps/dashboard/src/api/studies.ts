import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { t } from '../i18n/studies'
import { ActivitiesApiError, useActivities, type Activity } from './activities'
import { client } from './client'
import type { components } from './schema'

export type Study = components['schemas']['StudyOut']
export type StudyMember = components['schemas']['StudyMemberOut']
export type StudyRole = components['schemas']['StudyRole']
export type StudyStatusApi = components['schemas']['StudyStatus']
export type Participant = components['schemas']['ParticipantOut']
export type Approval = components['schemas']['ApprovalOut']
export type Adherence = components['schemas']['AdherenceResponse']
export type Timeline = components['schemas']['TimelineResponse']
export type TimelineEntry = components['schemas']['TimelineEntry']
export type Entry = components['schemas']['EntryOut']

export type StudyStatus = 'ongoing' | 'draft' | 'finished'

export type StudyMetricKind = 'participants' | 'entries' | 'activities'

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

export type AttentionTone = 'danger' | 'warning' | 'neutral'
export type AttentionIcon = 'alert' | 'users' | 'calendar' | 'user' | 'mail' | 'ban'
export type AttentionActionKind = 'retry' | 'review' | 'plan' | 'participant' | 'invite'

export type AttentionItem = {
  id: string
  icon: AttentionIcon
  tone: AttentionTone
  title: string
  detail: string
  action?: {
    kind: AttentionActionKind
    type: 'button' | 'link'
    to?: string
  }
}

export type TrendPoint = {
  label: string
  value: string
  height: number
  current: boolean
}

export type FunnelStep = {
  label: 'planned' | 'sent' | 'seen' | 'opened' | 'answered'
  value: number
  note: string
  width: number
  color: string
}

export type AdherenceCell = { answered: number; sent: number }

export type AdherenceRow = {
  alias: string
  note: string
  cells: (AdherenceCell | null)[]
  last: string
  warn: boolean
}

export type EntryKind = 'photo' | 'text' | 'audio'

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

export type HourDatum = { hour: number; sent: number; planned: number }

export type EntryTypeSlice = { name: string; value: number; color: string }

export type ActivitySlice = {
  code: string
  name: string
  value: number
  requested: number
  free: number
  note: string
}

export type OverviewData = {
  id: string
  title: string
  status: StudyStatus
  day: number
  totalDays: number
  dateRange: string
  participantCount: number
  participantsActive: number
  dateLabel: string
  currentTime: string
  nowHour: number
  adherence: { percent: string; answered: number; sent: number }
  trend: TrendPoint[]
  entries: { total: string; today: number; answered: number; free: number }
  entriesTotal: number
  active: { value: number; total: number; invites: number; declined: number }
  effort: { value: string; unit: string; note: string }
  attention: AttentionItem[]
  funnel: FunnelStep[]
  outcomes: { answered: number; open: number; expired: number }
  pending: { sent: number; pending: number; planned: number; unplanned: number; expected: number }
  dayHeads: { label: string; sub: string }[]
  totals: string[]
  adherenceRows: AdherenceRow[]
  feed: FeedItem[]
  hours: HourDatum[]
  hourLimit: number
  hourPeak: number
  hourPeakFrom: string
  hourPeakTo: string
  maxPerDay: number
  maxPerSlot: number
  activityMax: number
  types: EntryTypeSlice[]
  activities: ActivitySlice[]
  delayed: number
  tagged: number
  canClose: boolean
}

export type PlanReasonId = 'outsideHours' | 'interval' | 'dailyMax' | 'slotFull' | 'timeout'
export type PlanRequestStatus = 'responded' | 'sent' | 'expired' | 'planned'

export type PlanRequest = {
  activity: string
  minutes: number
  status: PlanRequestStatus
}

export type PlanUnplannedMarker = {
  activity: string
  reason: PlanReasonId
}

export type PlanParticipant = {
  alias: string
  windowStart: number
  windowEnd: number
  requests: PlanRequest[]
  unplanned?: PlanUnplannedMarker
}

export type PlanUnplannedItem = {
  id: string
  alias: string
  activity: string
  reason: PlanReasonId
  detail: string
}

export type PlanDay = {
  key: 'today' | 'tomorrow'
  dateLabel: string
  planned: number
  expected: number
  unplanned: number
  calculatedAt: string
  duration: string
  maxPerDay: number
  maxPerSlot: number
  styleName: string
  intervalMin: number
  participantsActive: number
  unplannedItems: PlanUnplannedItem[]
  reasonCounts: Record<PlanReasonId, number>
  participants: PlanParticipant[]
  intervalSent: number[]
  intervalPlanned: number[]
  nowPercent: number | null
  nowLabel: string | null
  sentTotal: number
  pendingTotal: number
}

export type PlanActivity = { code: string; name: string; color: string }

export const planReasonOrder: PlanReasonId[] = [
  'outsideHours',
  'interval',
  'dailyMax',
  'slotFull',
  'timeout',
]

export const planAxisStart = 8 * 60
export const planAxisEnd = 22 * 60 + 30
export const planSlotCount = (planAxisEnd - planAxisStart) / 15

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

function formatFullDate(iso: string): string {
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

function addDays(iso: string, days: number): string {
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

function todayInTimezone(timezone: string): string {
  return dateInTimezone(new Date(), timezone)
}

type Clock = { hour: number; minute: number }

function clockInTimezone(value: string | Date, timezone: string): Clock {
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

function timeLabel(value: string | null, timezone: string): string {
  if (!value) {
    return '–'
  }
  const { hour, minute } = clockInTimezone(value, timezone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function shortDateLabel(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00Z`))
}

function studyRange(study: Study): string {
  if (!study.starts_on && !study.ends_on) {
    return t('common.none')
  }
  if (study.starts_on && study.ends_on) {
    return `${formatDate(study.starts_on)} a ${formatFullDate(study.ends_on)}`
  }
  return formatDate(study.starts_on ?? study.ends_on)
}

function studyDay(study: Study, today: string): { day: number; total: number } {
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
  adherence: (studyId: string, participantId: string) =>
    [...studyKeys.all, 'adherence', studyId, participantId] as const,
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

async function fetchEntries(
  studyId: string,
  dateFrom: string | null | undefined,
): Promise<components['schemas']['EntryListResponse']> {
  const { data, error, response } = await client.GET('/studies/{study_id}/entries', {
    params: {
      path: { study_id: studyId },
      query: { limit: 200, ...(dateFrom ? { date_from: dateFrom } : {}) },
    },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchAdherence(studyId: string, participantId: string): Promise<Adherence> {
  const { data, error, response } = await client.GET(
    '/studies/{study_id}/participants/{participant_id}/adherence',
    { params: { path: { study_id: studyId, participant_id: participantId } } },
  )
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

export function useStudies() {
  return useQuery({
    queryKey: studyKeys.list(),
    queryFn: async () => {
      const { data, error, response } = await client.GET('/studies')
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useStudyCard(study: Study): StudySummary {
  const { user } = useAuth()
  const participants = useParticipants(study.id)
  const members = useStudyMembers(study.id)
  const entries = useEntries(study.id, study)
  const activities = useActivities(study.id)
  const member = members.data?.find((item) => item.user_id === user?.id)
  const role: StudyRole | null =
    user?.role === 'admin' ? 'principal_investigator' : (member?.role ?? null)
  const timezone = study.timezone
  const today = todayInTimezone(timezone)
  const participantRows = participants.data ?? []
  const entryRows = entries.data?.items ?? []
  const activityRows = activities.data ?? []
  const todayEntries = entryRows.filter(
    (entry) => dateInTimezone(entry.recorded_at, timezone) === today,
  )
  const loading = participants.isLoading || entries.isLoading || activities.isLoading

  return {
    id: study.id,
    title: study.title,
    description: study.description ?? t('list.noDescription'),
    status: statusFromApi(study.status),
    role,
    period: studyRange(study),
    schedule: t('list.schedule', {
      style: styleLabel(study.schedule_style),
      max: study.max_prompts_per_day,
    }),
    metrics: [
      {
        kind: 'participants',
        value: loading ? '…' : String(participantRows.length),
        note: loading
          ? ''
          : t('list.metric.participantsNote', {
              active: participantRows.filter((item) => item.status === 'active').length,
            }),
      },
      {
        kind: 'entries',
        value: loading ? '…' : String(entryRows.length),
        note: loading ? '' : t('list.metric.entriesNote', { today: todayEntries.length }),
      },
      {
        kind: 'activities',
        value: loading ? '…' : String(activityRows.length),
        note: loading
          ? ''
          : t('list.metric.activitiesNote', {
              prompts: activityRows.reduce((sum, activity) => sum + activity.prompts_per_day, 0),
            }),
      },
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

export function useEntries(studyId: string | undefined, study: Study | undefined) {
  return useQuery({
    queryKey: studyKeys.entries(studyId ?? ''),
    queryFn: () => fetchEntries(studyId as string, study?.starts_on),
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

const visibleStatuses = ['active', 'withdrawn', 'removed']

export type ParticipantAdherence = { participant: Participant; adherence: Adherence }

export function useStudyAdherence(studyId: string | undefined) {
  const participants = useParticipants(studyId)
  const visible = (participants.data ?? []).filter((item) =>
    visibleStatuses.includes(item.status),
  )
  const adherenceQueries = useQueries({
    queries: visible.map((participant) => ({
      queryKey: studyKeys.adherence(studyId ?? '', participant.id),
      queryFn: () => fetchAdherence(studyId as string, participant.id),
      enabled: Boolean(studyId),
    })),
  })

  const pairs: ParticipantAdherence[] = []
  visible.forEach((participant, index) => {
    const adherence = adherenceQueries[index]?.data
    if (adherence) {
      pairs.push({ participant, adherence })
    }
  })

  const firstError = adherenceQueries.find((query) => query.error)?.error
  const isLoading =
    participants.isLoading ||
    adherenceQueries.some((query) => query.isLoading || query.isPending)

  return {
    participants,
    visible,
    pairs,
    isLoading,
    error: participants.error ?? firstError ?? null,
  }
}

type PromptWithContext = components['schemas']['AdherencePrompt'] & {
  planDate: string
  participantId: string
  alias: string | null
}

function flattenPrompts(pairs: ParticipantAdherence[]): PromptWithContext[] {
  const prompts: PromptWithContext[] = []
  for (const pair of pairs) {
    for (const day of pair.adherence.days) {
      for (const cell of day.cells) {
        for (const prompt of cell.prompts ?? []) {
          prompts.push({
            ...prompt,
            planDate: day.date,
            participantId: pair.participant.id,
            alias: pair.participant.alias,
          })
        }
      }
    }
  }
  return prompts
}

function isSent(prompt: components['schemas']['AdherencePrompt']): boolean {
  return prompt.status !== 'planned'
}

function percentText(answered: number, sent: number): string {
  if (sent === 0) {
    return '–'
  }
  return `${Math.round((answered * 100) / sent)} %`
}

function lastEntryByParticipant(entries: Entry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const current = map.get(entry.participant_id)
    if (!current || Date.parse(entry.recorded_at) > Date.parse(current)) {
      map.set(entry.participant_id, entry.recorded_at)
    }
  }
  return map
}

function entryKind(type: components['schemas']['EntryType']): EntryKind {
  if (type === 'photo') {
    return 'photo'
  }
  if (type === 'text' || type === 'scale' || type === 'choice') {
    return 'text'
  }
  return 'audio'
}

const entryTypeLabels = {
  photo: 'overview.entryType.photo',
  text: 'overview.entryType.text',
  video: 'overview.entryType.video',
  audio: 'overview.entryType.audio',
  scale: 'overview.entryType.scale',
  choice: 'overview.entryType.choice',
} as const satisfies Record<components['schemas']['EntryType'], string>

const typePalette = ['#1E3FB0', '#6C8CF0', '#FFB020', '#9A5700', '#8A93A8', '#0E7C66']

function attentionItems(
  approvals: Approval[],
  rows: AdherenceRow[],
): AttentionItem[] {
  const items: AttentionItem[] = []

  if (approvals.length > 0) {
    items.push({
      id: 'approvals',
      icon: 'users',
      tone: 'warning',
      title: t('overview.attention.approvalsTitle', { count: approvals.length }),
      detail: t('overview.attention.approvalsDetail', { count: approvals.length }),
      action: { kind: 'review', type: 'link', to: 'participantes' },
    })
  }

  rows
    .filter((row) => row.warn)
    .slice(0, 2)
    .forEach((row, index) => {
      items.push({
        id: `inactive-${index}`,
        icon: 'user',
        tone: 'warning',
        title: t('overview.attention.inactiveTitle', { alias: row.alias }),
        detail:
          row.last === '–'
            ? t('overview.attention.inactiveNoEntries')
            : t('overview.attention.inactiveDetail', { last: row.last }),
        action: { kind: 'participant', type: 'link', to: 'participantes' },
      })
    })

  return items
}

function buildAdherenceRows(
  pairs: ParticipantAdherence[],
  days: string[],
  timezone: string,
  lastEntries: Map<string, string>,
): { rows: AdherenceRow[]; totals: string[] } {
  const rows: AdherenceRow[] = pairs.map((pair) => {
    const byDate = new Map(pair.adherence.days.map((day) => [day.date, day]))
    const cells = days.map((date) => {
      const day = byDate.get(date)
      if (!day) {
        return null
      }
      let answered = 0
      let sent = 0
      for (const cell of day.cells) {
        for (const prompt of cell.prompts ?? []) {
          if (prompt.status === 'answered') {
            answered += 1
          }
          if (isSent(prompt)) {
            sent += 1
          }
        }
      }
      return sent === 0 ? null : { answered, sent }
    })

    const last = lastEntries.get(pair.participant.id)
    const warn = !last || Date.now() - Date.parse(last) > 2 * 86_400_000

    return {
      alias: pair.participant.alias ?? '–',
      note: warn ? t('overview.adherence.inactive') : '',
      cells,
      last: last ? `${shortDateLabel(dateInTimezone(last, timezone), timezone).replace(/^\w/, (c) => c.toUpperCase())}, ${timeLabel(last, timezone)}` : '–',
      warn,
    }
  })

  rows.sort((left, right) => {
    if (left.warn !== right.warn) {
      return left.warn ? -1 : 1
    }
    return left.alias.localeCompare(right.alias)
  })

  const totals = days.map((_, index) => {
    let answered = 0
    let sent = 0
    for (const row of rows) {
      const cell = row.cells[index]
      if (cell) {
        answered += cell.answered
        sent += cell.sent
      }
    }
    return percentText(answered, sent)
  })

  return { rows, totals }
}

function activityCodes(activities: Activity[]): Map<string, string> {
  const map = new Map<string, string>()
  activities.forEach((activity, index) => {
    map.set(activity.id, `A${index + 1}`)
  })
  return map
}

function buildOverview(
  study: Study,
  participants: Participant[],
  approvals: Approval[],
  activities: Activity[],
  pairs: ParticipantAdherence[],
  entryPage: components['schemas']['EntryListResponse'] | undefined,
  canClose: boolean,
): OverviewData {
  const timezone = study.timezone
  const today = todayInTimezone(timezone)
  const { day, total } = studyDay(study, today)
  const prompts = flattenPrompts(pairs)
  const todayPrompts = prompts.filter((prompt) => prompt.planDate === today)
  const sentToday = todayPrompts.filter(isSent)
  const answeredToday = todayPrompts.filter((prompt) => prompt.status === 'answered')
  const spentNow = clockInTimezone(new Date(), timezone)

  const entries = [...(entryPage?.items ?? [])]
  entries.sort((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at))
  const todayEntries = entries.filter(
    (entry) => dateInTimezone(entry.recorded_at, timezone) === today,
  )
  const answeredEntries = entries.filter((entry) => entry.prompt_id !== null)
  const freeEntries = entries.filter((entry) => entry.prompt_id === null)

  const activeParticipants = participants.filter((item) => item.status === 'active')
  const declinedParticipants = participants.filter((item) => item.status === 'declined')
  const lastEntries = lastEntryByParticipant(entries)

  const dayWindow = Math.min(4, total > 0 ? day : 4)
  const days: string[] = []
  for (let offset = dayWindow - 1; offset >= 0; offset -= 1) {
    days.push(addDays(today, -offset))
  }
  const { rows, totals } = buildAdherenceRows(pairs, days, timezone, lastEntries)

  const trend: TrendPoint[] = days.map((date, index) => {
    const dayPrompts = prompts.filter((prompt) => prompt.planDate === date && isSent(prompt))
    const answered = dayPrompts.filter((prompt) => prompt.status === 'answered').length
    const sent = dayPrompts.length
    const isCurrent = date === today

    return {
      label: isCurrent ? t('overview.trend.today') : t('overview.trend.day', { day: day - dayWindow + index + 1 }),
      value: percentText(answered, sent),
      height: sent === 0 ? 8 : Math.max(8, Math.round((answered / sent) * 60)),
      current: isCurrent,
    }
  })

  const plannedToday = todayPrompts.length
  const funnel: FunnelStep[] = [
    {
      label: 'planned',
      value: plannedToday,
      note: t('overview.funnel.note', { value: plannedToday, total: plannedToday }),
      width: 100,
      color: '#C9D9FB',
    },
    {
      label: 'sent',
      value: sentToday.length,
      note: t('overview.funnel.note', { value: sentToday.length, total: plannedToday }),
      width: plannedToday === 0 ? 0 : (sentToday.length / plannedToday) * 100,
      color: '#9DB4F7',
    },
    {
      label: 'seen',
      value: todayPrompts.filter((prompt) => prompt.shown_at !== null).length,
      note: t('overview.funnel.note', {
        value: todayPrompts.filter((prompt) => prompt.shown_at !== null).length,
        total: plannedToday,
      }),
      width: plannedToday === 0 ? 0 : (todayPrompts.filter((prompt) => prompt.shown_at !== null).length / plannedToday) * 100,
      color: '#6C8CF0',
    },
    {
      label: 'opened',
      value: todayPrompts.filter((prompt) => prompt.opened_at !== null).length,
      note: t('overview.funnel.note', {
        value: todayPrompts.filter((prompt) => prompt.opened_at !== null).length,
        total: plannedToday,
      }),
      width: plannedToday === 0 ? 0 : (todayPrompts.filter((prompt) => prompt.opened_at !== null).length / plannedToday) * 100,
      color: '#4A72EC',
    },
    {
      label: 'answered',
      value: answeredToday.length,
      note: t('overview.funnel.note', { value: answeredToday.length, total: plannedToday }),
      width: plannedToday === 0 ? 0 : (answeredToday.length / plannedToday) * 100,
      color: '#1E3FB0',
    },
  ]

  const hours: HourDatum[] = Array.from({ length: 14 }, (_, index) => ({
    hour: index + 8,
    sent: 0,
    planned: 0,
  }))
  for (const prompt of todayPrompts) {
    const stamp = prompt.sent_at ?? prompt.scheduled_at
    if (!stamp) {
      continue
    }
    const { hour } = clockInTimezone(stamp, timezone)
    const bucket = hours.find((item) => item.hour === hour)
    if (!bucket) {
      continue
    }
    if (isSent(prompt)) {
      bucket.sent += 1
    } else {
      bucket.planned += 1
    }
  }

  const hourPeakDatum = hours.reduce(
    (best, item) => (item.sent + item.planned > best.sent + best.planned ? item : best),
    hours[0],
  )
  const hourPeak = hourPeakDatum.sent + hourPeakDatum.planned

  const typeCounts = new Map<components['schemas']['EntryType'], number>()
  for (const entry of entries) {
    typeCounts.set(entry.entry_type, (typeCounts.get(entry.entry_type) ?? 0) + 1)
  }
  const typeOrder: components['schemas']['EntryType'][] = [
    'photo',
    'text',
    'audio',
    'video',
    'scale',
    'choice',
  ]
  const types: EntryTypeSlice[] = typeOrder
    .filter((type) => (typeCounts.get(type) ?? 0) > 0)
    .map((type, index) => ({
      name: t(entryTypeLabels[type]),
      value: typeCounts.get(type) ?? 0,
      color: typePalette[index % typePalette.length],
    }))

  const codes = activityCodes(activities)
  const byActivity = new Map<string, { requested: number; free: number }>()
  for (const entry of entries) {
    const activityId = entry.activity_id
    if (!activityId) {
      continue
    }
    const current = byActivity.get(activityId) ?? { requested: 0, free: 0 }
    if (entry.prompt_id === null) {
      current.free += 1
    } else {
      current.requested += 1
    }
    byActivity.set(activityId, current)
  }
  const activitySlices: ActivitySlice[] = activities.map((activity) => {
    const counts = byActivity.get(activity.id) ?? { requested: 0, free: 0 }
    return {
      code: codes.get(activity.id) ?? 'A?',
      name: activity.title,
      value: counts.requested + counts.free,
      requested: counts.requested,
      free: counts.free,
      note: t('overview.types.activityNote', {
        requested: counts.requested,
        free: counts.free,
      }),
    }
  })

  const delayed = entries.filter(
    (entry) => Date.parse(entry.received_at) - Date.parse(entry.recorded_at) > 5 * 60_000,
  ).length
  const tagged = entries.filter((entry) => (entry.tags?.length ?? 0) > 0).length

  const feed: FeedItem[] = entries.slice(0, 6).map((entry) => {
    const delayMinutes = Math.max(
      0,
      Math.round((Date.parse(entry.received_at) - Date.parse(entry.recorded_at)) / 60_000),
    )
    const activity = activities.find((candidate) => candidate.id === entry.activity_id)
    const delay =
      delayMinutes >= 60
        ? `${Math.floor(delayMinutes / 60)} h ${String(delayMinutes % 60).padStart(2, '0')} min`
        : `${delayMinutes} min`

    return {
      alias: entry.participant_alias ?? '–',
      type: t(entryTypeLabels[entry.entry_type]),
      activity: entry.activity_title ?? activity?.title ?? t('overview.feed.noActivity'),
      recorded: timeLabel(entry.recorded_at, timezone),
      received: timeLabel(entry.received_at, timezone),
      delay,
      late: delayMinutes > 5,
      kind: entryKind(entry.entry_type),
    }
  })

  const effortTotal = activities.reduce(
    (totalMinutes, activity) => totalMinutes + activity.expected_minutes * activity.prompts_per_day,
    0,
  )
  const effortBreakdown = activities
    .map((activity) => `${activity.prompts_per_day} × ${activity.expected_minutes} min`)
    .join(' + ')

  return {
    id: study.id,
    title: study.title,
    status: statusFromApi(study.status),
    day,
    totalDays: total,
    dateRange: studyRange(study),
    participantCount: participants.length,
    participantsActive: activeParticipants.length,
    dateLabel: shortDateLabel(today, timezone).replace(/^\w/, (character) => character.toUpperCase()),
    currentTime: `${String(spentNow.hour).padStart(2, '0')}:${String(spentNow.minute).padStart(2, '0')}`,
    nowHour: spentNow.hour,
    adherence: {
      percent: percentText(answeredToday.length, sentToday.length),
      answered: answeredToday.length,
      sent: sentToday.length,
    },
    trend,
    entries: {
      total: `${entries.length}${entryPage?.next_cursor ? '+' : ''}`,
      today: todayEntries.length,
      answered: answeredEntries.length,
      free: freeEntries.length,
    },
    entriesTotal: entries.length,
    active: {
      value: activeParticipants.length,
      total: participants.length,
      invites: approvals.length,
      declined: declinedParticipants.length,
    },
    effort: {
      value: `${effortTotal} min`,
      unit: t('overview.effortPerDay'),
      note: effortBreakdown || t('overview.effortNone'),
    },
    attention: attentionItems(approvals, rows),
    funnel,
    outcomes: {
      answered: answeredToday.length,
      open: todayPrompts.filter((prompt) => prompt.status === 'sent').length,
      expired: todayPrompts.filter((prompt) => prompt.status === 'expired').length,
    },
    pending: {
      sent: sentToday.length,
      pending: plannedToday - sentToday.length,
      planned: plannedToday,
      unplanned: 0,
      expected: plannedToday,
    },
    dayHeads: days.map((date) => ({
      label: shortDateLabel(date, timezone).split(',')[0] ?? date,
      sub: formatDate(date),
    })),
    totals,
    adherenceRows: rows,
    feed,
    hours,
    hourLimit: study.max_prompts_per_slot * 4,
    hourPeak,
    hourPeakFrom: `${String(hourPeakDatum.hour).padStart(2, '0')}:00`,
    hourPeakTo: `${String(hourPeakDatum.hour + 1).padStart(2, '0')}:00`,
    maxPerDay: study.max_prompts_per_day,
    maxPerSlot: study.max_prompts_per_slot,
    activityMax: Math.max(1, ...activitySlices.map((activity) => activity.value)),
    types,
    activities: activitySlices,
    delayed,
    tagged,
    canClose,
  }
}

export function useStudyOverview(studyId: string | undefined) {
  const studyQuery = useStudy(studyId)
  const study = studyQuery.data
  const activitiesQuery = useActivities(studyId)
  const participantsQuery = useParticipants(studyId)
  const approvalsQuery = useApprovals(studyId)
  const adherence = useStudyAdherence(studyId)
  const entriesQuery = useEntries(studyId, study)

  const queryError =
    studyQuery.error ??
    activitiesQuery.error ??
    participantsQuery.error ??
    approvalsQuery.error ??
    adherence.error ??
    entriesQuery.error ??
    null

  const isLoading =
    studyQuery.isLoading ||
    activitiesQuery.isLoading ||
    participantsQuery.isLoading ||
    approvalsQuery.isLoading ||
    adherence.isLoading ||
    entriesQuery.isLoading

  const data = study
    ? buildOverview(
        study,
        adherence.participants.data ?? [],
        approvalsQuery.data ?? [],
        activitiesQuery.data ?? [],
        adherence.pairs,
        entriesQuery.data,
        true,
      )
    : undefined

  return { data, study, isLoading, error: queryError, refetch: studyQuery.refetch }
}

function planStatus(status: components['schemas']['PromptStatus']): PlanRequestStatus {
  if (status === 'answered') {
    return 'responded'
  }
  if (status === 'sent') {
    return 'sent'
  }
  if (status === 'expired') {
    return 'expired'
  }
  return 'planned'
}

function buildPlanDay(
  key: 'today' | 'tomorrow',
  date: string,
  pairs: ParticipantAdherence[],
  activities: Activity[],
  study: Study,
  activeCount: number,
): PlanDay {
  const timezone = study.timezone
  const codes = activityCodes(activities)
  const now = clockInTimezone(new Date(), timezone)
  const nowMinutes = now.hour * 60 + now.minute
  const intervalSent = Array.from({ length: planSlotCount }, () => 0)
  const intervalPlanned = Array.from({ length: planSlotCount }, () => 0)
  const gaps = activities
    .map((activity) => activity.min_gap_minutes)
    .filter((minutes) => minutes > 0)
  let sentTotal = 0
  let pendingTotal = 0

  const participants: PlanParticipant[] = pairs
    .filter((pair) => pair.participant.status === 'active')
    .map((pair) => {
    const day = pair.adherence.days.find((item) => item.date === date)
    const requests: PlanRequest[] = []
    for (const cell of day?.cells ?? []) {
      for (const prompt of cell.prompts ?? []) {
        const stamp = prompt.sent_at ?? prompt.scheduled_at
        if (!stamp) {
          continue
        }
        const { hour, minute } = clockInTimezone(stamp, timezone)
        const minutes = hour * 60 + minute
        const status = planStatus(prompt.status)
        requests.push({
          activity: codes.get(prompt.activity_id) ?? 'A?',
          minutes,
          status,
        })

        const slot = Math.floor((minutes - planAxisStart) / 15)
        if (slot >= 0 && slot < planSlotCount) {
          if (status === 'planned') {
            intervalPlanned[slot] += 1
            pendingTotal += 1
          } else {
            intervalSent[slot] += 1
            sentTotal += 1
          }
        }
      }
    }
    requests.sort((left, right) => left.minutes - right.minutes)

    return {
      alias: pair.participant.alias ?? '–',
      windowStart: planAxisStart,
      windowEnd: planAxisEnd,
      requests,
    }
  })

  const planned = sentTotal + pendingTotal

  return {
    key,
    dateLabel: formatFullDate(date),
    planned,
    expected: planned,
    unplanned: 0,
    calculatedAt: `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`,
    duration: '—',
    maxPerDay: study.max_prompts_per_day,
    maxPerSlot: study.max_prompts_per_slot,
    styleName: styleLabel(study.schedule_style),
    intervalMin: gaps.length > 0 ? Math.min(...gaps) : 0,
    participantsActive: activeCount,
    unplannedItems: [],
    reasonCounts: { outsideHours: 0, interval: 0, dailyMax: 0, slotFull: 0, timeout: 0 },
    participants,
    intervalSent,
    intervalPlanned,
    nowPercent:
      key === 'today' && nowMinutes >= planAxisStart && nowMinutes <= planAxisEnd
        ? ((nowMinutes - planAxisStart) / (planAxisEnd - planAxisStart)) * 100
        : null,
    nowLabel: key === 'today' ? `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}` : null,
    sentTotal,
    pendingTotal,
  }
}

const planColors = ['#2F5BEA', '#0E7C66', '#B96A00', '#7B4FBF', '#C2413E']

export function useStudyPlan(studyId: string | undefined) {
  const studyQuery = useStudy(studyId)
  const study = studyQuery.data
  const activitiesQuery = useActivities(studyId)
  const adherence = useStudyAdherence(studyId)
  const activities = activitiesQuery.data ?? []
  const timezone = study?.timezone ?? 'Europe/Lisbon'
  const today = todayInTimezone(timezone)
  const tomorrow = addDays(today, 1)
  const activeCount = (adherence.participants.data ?? []).filter(
    (participant) => participant.status === 'active',
  ).length

  const planActivities: PlanActivity[] = activities.map((activity, index) => ({
    code: `A${index + 1}`,
    name: activity.title,
    color: planColors[index % planColors.length],
  }))

  const todayPlan = study
    ? buildPlanDay('today', today, adherence.pairs, activities, study, activeCount)
    : undefined
  const tomorrowPlan = study
    ? buildPlanDay('tomorrow', tomorrow, adherence.pairs, activities, study, activeCount)
    : undefined

  const peak = todayPlan
    ? Math.max(
        0,
        ...todayPlan.intervalSent.map(
          (sent, index) => sent + (todayPlan.intervalPlanned[index] ?? 0),
        ),
      )
    : 0

  const error = studyQuery.error ?? activitiesQuery.error ?? adherence.error ?? null

  return {
    today: todayPlan,
    tomorrow: tomorrowPlan,
    planActivities,
    planAxisStart,
    planAxisEnd,
    planSlotCount,
    peak,
    isLoading: studyQuery.isLoading || activitiesQuery.isLoading || adherence.isLoading,
    error,
    refetch: studyQuery.refetch,
    hasPromptData: Boolean(
      todayPlan &&
        (todayPlan.planned > 0 ||
          (tomorrowPlan && tomorrowPlan.planned > 0)),
    ),
  }
}

export type { ActivitiesApiError, Activity }
