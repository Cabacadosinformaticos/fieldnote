import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { t, type ParticipantsKey } from '../i18n/participants'
import { client } from './client'
import type { components } from './schema'

export type ParticipantOut = components['schemas']['ParticipantOut']
export type ParticipantStatus = components['schemas']['ParticipantStatus']
export type ParticipantCreate = components['schemas']['ParticipantCreate']
export type ParticipantAddedOut = components['schemas']['ParticipantAddedOut']
export type PersonalInviteCodeOut = components['schemas']['PersonalInviteCodeOut']
export type ParticipantIdentityOut = components['schemas']['ParticipantIdentityOut']
export type ApprovalOut = components['schemas']['ApprovalOut']
export type AdherenceResponse = components['schemas']['AdherenceResponse']
export type AdherenceDay = components['schemas']['AdherenceDay']
export type AdherenceCell = components['schemas']['AdherenceCell']
export type StudyCodeOut = components['schemas']['StudyCodeOut']
export type StudyCodeCreate = components['schemas']['StudyCodeCreate']
export type StudyCodeUpdate = components['schemas']['StudyCodeUpdate']
export type StudyOut = components['schemas']['StudyOut']
export type StudyMemberOut = components['schemas']['StudyMemberOut']
export type StudyRole = components['schemas']['StudyRole']

export class ParticipantsApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ParticipantsApiError'
    this.code = code
    this.status = status
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

async function unwrap<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): Promise<T> {
  if (result.data !== undefined) {
    return result.data
  }
  const body = result.error as ErrorEnvelope | undefined
  throw new ParticipantsApiError(
    body?.error?.code ?? `http_${result.response.status}`,
    result.response.status,
    body?.error?.message ?? result.response.statusText,
  )
}

export const participantsKeys = {
  root: ['participants'] as const,
  list: (studyId: string) => ['participants', 'list', studyId] as const,
  detail: (studyId: string, participantId: string) =>
    ['participants', 'detail', studyId, participantId] as const,
  adherence: (studyId: string, participantId: string) =>
    ['participants', 'adherence', studyId, participantId] as const,
  identity: (studyId: string, participantId: string) =>
    ['participants', 'identity', studyId, participantId] as const,
  approvals: (studyId: string) => ['participants', 'approvals', studyId] as const,
  codes: (studyId: string) => ['participants', 'codes', studyId] as const,
  study: (studyId: string) => ['participants', 'study', studyId] as const,
  members: (studyId: string) => ['participants', 'members', studyId] as const,
  poolCount: (studyId: string, criteria: PoolCriteria) =>
    ['participants', 'pool-count', studyId, criteria] as const,
}

export async function listParticipants(studyId: string): Promise<ParticipantOut[]> {
  return unwrap(
    await client.GET('/studies/{study_id}/participants', {
      params: { path: { study_id: studyId } },
    }),
  )
}

export async function getParticipant(
  studyId: string,
  participantId: string,
): Promise<ParticipantOut> {
  return unwrap(
    await client.GET('/studies/{study_id}/participants/{participant_id}', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function listApprovals(studyId: string): Promise<ApprovalOut[]> {
  return unwrap(
    await client.GET('/studies/{study_id}/approvals', {
      params: { path: { study_id: studyId } },
    }),
  )
}

export async function getAdherence(
  studyId: string,
  participantId: string,
): Promise<AdherenceResponse> {
  return unwrap(
    await client.GET('/studies/{study_id}/participants/{participant_id}/adherence', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function getParticipantIdentity(
  studyId: string,
  participantId: string,
): Promise<ParticipantIdentityOut> {
  return unwrap(
    await client.GET('/studies/{study_id}/participants/{participant_id}/identity', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function listStudyCodes(studyId: string): Promise<StudyCodeOut[]> {
  return unwrap(
    await client.GET('/studies/{study_id}/invite-codes', {
      params: { path: { study_id: studyId } },
    }),
  )
}

export async function getStudy(studyId: string): Promise<StudyOut> {
  return unwrap(
    await client.GET('/studies/{study_id}', {
      params: { path: { study_id: studyId } },
    }),
  )
}

export async function listStudyMembers(studyId: string): Promise<StudyMemberOut[]> {
  return unwrap(
    await client.GET('/studies/{study_id}/members', {
      params: { path: { study_id: studyId } },
    }),
  )
}

export async function addParticipant(
  studyId: string,
  payload: ParticipantCreate,
): Promise<ParticipantAddedOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/participants', {
      params: { path: { study_id: studyId } },
      body: payload,
    }),
  )
}

export async function issuePersonalCode(
  studyId: string,
  participantId: string,
): Promise<PersonalInviteCodeOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/participants/{participant_id}/invite-code', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function removeParticipant(
  studyId: string,
  participantId: string,
): Promise<void> {
  const result = await client.POST('/studies/{study_id}/participants/{participant_id}/remove', {
    params: { path: { study_id: studyId, participant_id: participantId } },
  })
  if (result.response.ok) {
    return
  }
  const body = result.error as ErrorEnvelope | undefined
  throw new ParticipantsApiError(
    body?.error?.code ?? `http_${result.response.status}`,
    result.response.status,
    body?.error?.message ?? result.response.statusText,
  )
}

export async function approveEntry(
  studyId: string,
  participantId: string,
): Promise<ParticipantOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/approvals/{participant_id}/approve', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function declineEntry(
  studyId: string,
  participantId: string,
): Promise<ParticipantOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/approvals/{participant_id}/decline', {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function createStudyCode(
  studyId: string,
  payload: StudyCodeCreate,
): Promise<StudyCodeOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/invite-codes', {
      params: { path: { study_id: studyId } },
      body: payload,
    }),
  )
}

export async function updateStudyCode(
  studyId: string,
  codeId: string,
  payload: StudyCodeUpdate,
): Promise<StudyCodeOut> {
  return unwrap(
    await client.PATCH('/studies/{study_id}/invite-codes/{code_id}', {
      params: { path: { study_id: studyId, code_id: codeId } },
      body: payload,
    }),
  )
}

export async function regenerateStudyCode(
  studyId: string,
  codeId: string,
): Promise<StudyCodeOut> {
  return unwrap(
    await client.POST('/studies/{study_id}/invite-codes/{code_id}/regenerate', {
      params: { path: { study_id: studyId, code_id: codeId } },
    }),
  )
}

export function useParticipants(studyId: string) {
  return useQuery({
    queryKey: participantsKeys.list(studyId),
    queryFn: () => listParticipants(studyId),
    enabled: Boolean(studyId),
  })
}

export function useParticipant(studyId: string, participantId: string) {
  return useQuery({
    queryKey: participantsKeys.detail(studyId, participantId),
    queryFn: () => getParticipant(studyId, participantId),
    enabled: Boolean(studyId && participantId),
  })
}

export function useAdherence(studyId: string, participantId: string) {
  return useQuery({
    queryKey: participantsKeys.adherence(studyId, participantId),
    queryFn: () => getAdherence(studyId, participantId),
    enabled: Boolean(studyId && participantId),
    retry: false,
  })
}

export function useApprovals(studyId: string) {
  return useQuery({
    queryKey: participantsKeys.approvals(studyId),
    queryFn: () => listApprovals(studyId),
    enabled: Boolean(studyId),
  })
}

export function useStudyCodes(studyId: string) {
  return useQuery({
    queryKey: participantsKeys.codes(studyId),
    queryFn: () => listStudyCodes(studyId),
    enabled: Boolean(studyId),
  })
}

export function useStudy(studyId: string) {
  return useQuery({
    queryKey: participantsKeys.study(studyId),
    queryFn: () => getStudy(studyId),
    enabled: Boolean(studyId),
  })
}

export function useStudyMembers(studyId: string) {
  return useQuery({
    queryKey: participantsKeys.members(studyId),
    queryFn: () => listStudyMembers(studyId),
    enabled: Boolean(studyId),
  })
}

export function useParticipantIdentity(
  studyId: string,
  participantId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: participantsKeys.identity(studyId, participantId),
    queryFn: () => getParticipantIdentity(studyId, participantId),
    enabled: Boolean(studyId && participantId && enabled),
    retry: false,
  })
}

/** Only the principal investigator and administrators may read an identity. */
export function useCanReadIdentity(studyId: string): boolean {
  const { user } = useAuth()
  const members = useStudyMembers(studyId)
  if (user?.role === 'admin') {
    return true
  }
  return members.data?.some(
    (member) =>
      member.user_id === user?.id && member.role === 'principal_investigator',
  ) ?? false
}

function useInvalidateParticipants(studyId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: participantsKeys.list(studyId) })
    void queryClient.invalidateQueries({ queryKey: participantsKeys.approvals(studyId) })
  }
}

export function useAddParticipant(studyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ParticipantCreate) => addParticipant(studyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: participantsKeys.list(studyId) })
    },
  })
}

export function useIssuePersonalCode(studyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => issuePersonalCode(studyId, participantId),
    onSuccess: (_data, participantId) => {
      void queryClient.invalidateQueries({ queryKey: participantsKeys.list(studyId) })
      void queryClient.invalidateQueries({
        queryKey: participantsKeys.detail(studyId, participantId),
      })
      void queryClient.invalidateQueries({
        queryKey: participantsKeys.adherence(studyId, participantId),
      })
    },
  })
}

export function useRemoveParticipant(studyId: string) {
  const invalidate = useInvalidateParticipants(studyId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => removeParticipant(studyId, participantId),
    onSuccess: (_data, participantId) => {
      invalidate()
      void queryClient.invalidateQueries({
        queryKey: participantsKeys.detail(studyId, participantId),
      })
      void queryClient.invalidateQueries({
        queryKey: participantsKeys.adherence(studyId, participantId),
      })
    },
  })
}

export function useApproveEntry(studyId: string) {
  const invalidate = useInvalidateParticipants(studyId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => approveEntry(studyId, participantId),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: participantsKeys.codes(studyId) })
    },
  })
}

export function useDeclineEntry(studyId: string) {
  const invalidate = useInvalidateParticipants(studyId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => declineEntry(studyId, participantId),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: participantsKeys.codes(studyId) })
    },
  })
}

export function useCreateStudyCode(studyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: StudyCodeCreate) => createStudyCode(studyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: participantsKeys.codes(studyId) })
    },
  })
}

export function useUpdateStudyCode(studyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ codeId, payload }: { codeId: string; payload: StudyCodeUpdate }) =>
      updateStudyCode(studyId, codeId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: participantsKeys.codes(studyId) })
    },
  })
}

export function useRegenerateStudyCode(studyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (codeId: string) => regenerateStudyCode(studyId, codeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: participantsKeys.codes(studyId) })
    },
  })
}

export type PoolCriteria = components['schemas']['PoolCriteria']

export function usePoolCount(studyId: string, criteria: PoolCriteria) {
  return useQuery({
    queryKey: participantsKeys.poolCount(studyId, criteria),
    queryFn: async () =>
      unwrap(
        await client.POST('/studies/{study_id}/pool/count', {
          params: { path: { study_id: studyId } },
          body: criteria,
        }),
      ),
    enabled: Boolean(studyId),
  })
}

export function useSendPoolInvitations(studyId: string) {
  return useMutation({
    mutationFn: async (criteria: PoolCriteria) =>
      unwrap(
        await client.POST('/studies/{study_id}/pool/invitations', {
          params: { path: { study_id: studyId } },
          body: criteria,
        }),
      ),
  })
}

// ---------------------------------------------------------------------------------------------
// View helpers.

export type PillTone = 'ok' | 'wa' | 'ne' | 'da' | 'pr'
export type FilterKey = 'all' | ParticipantStatus

export const participantStatusMeta: Record<
  ParticipantStatus,
  { labelKey: ParticipantsKey; pill: PillTone }
> = {
  active: { labelKey: 'status.active', pill: 'ok' },
  pending_approval: { labelKey: 'status.pendingApproval', pill: 'wa' },
  declined: { labelKey: 'status.declined', pill: 'ne' },
  withdrawn: { labelKey: 'status.withdrawn', pill: 'ne' },
  removed: { labelKey: 'status.removed', pill: 'ne' },
  erasure_scheduled: { labelKey: 'status.deleting', pill: 'ne' },
}

export const participantFilters: { key: FilterKey; labelKey: ParticipantsKey }[] = [
  { key: 'all', labelKey: 'list.filterAll' },
  ...(Object.keys(participantStatusMeta) as ParticipantStatus[]).map((key) => ({
    key,
    labelKey: participantStatusMeta[key].labelKey,
  })),
]

export function participantFilterCount(
  participants: ParticipantOut[],
  key: FilterKey,
): number {
  return key === 'all'
    ? participants.length
    : participants.filter((participant) => participant.status === key).length
}

/**
 * A participant may exist before an alias is assigned (for example a pending entry).
 * The raw id is an implementation detail, so the state supplies the label instead.
 */
export function participantLabel(
  participant: Pick<ParticipantOut, 'alias' | 'status'>,
): string {
  if (participant.alias) {
    return participant.alias
  }
  return participant.status === 'pending_approval'
    ? t('label.pendingAlias')
    : t('label.awaitingAlias')
}

export function searchParticipants(
  participants: ParticipantOut[],
  query: string,
): ParticipantOut[] {
  const term = query.trim().toLowerCase()
  if (!term) {
    return participants
  }
  return participants.filter((participant) =>
    participantLabel(participant).toLowerCase().includes(term),
  )
}

export function entryRouteKey(route: string | null): ParticipantsKey {
  if (route === 'personal_code') return 'entry.personalCode'
  if (route === 'study_code') return 'entry.studyCode'
  if (route === 'pool') return 'entry.pool'
  return 'entry.none'
}

export type MatrixState = 'answered' | 'expired' | 'pending' | 'notSent'

const promptState: Record<string, MatrixState> = {
  answered: 'answered',
  expired: 'expired',
  sent: 'pending',
  planned: 'notSent',
  unplanned: 'notSent',
}

export interface AdherenceView {
  slots: number[]
  days: string[]
  matrix: MatrixState[][]
  free: (number | null)[]
  freeCount: number
  totals: { answered: number; sent: number; percent: number }
  counts: { answered: number; expired: number; pending: number }
  gap: { last: string; sentToday: number } | null
}

export function buildAdherenceView(data: AdherenceResponse): AdherenceView {
  // The API groups cells by the activity's occurrence index, so several activities that
  // prompt once a day all share occurrence 0. Each day is really a list of requests, so
  // rows are built from the individual prompts, ordered by their scheduled time.
  const dayPrompts = data.days.map((day) =>
    (day.cells ?? [])
      .flatMap((cell) => cell.prompts ?? [])
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')),
  )
  const rowCount = Math.max(1, ...dayPrompts.map((prompts) => prompts.length))
  const slots = Array.from({ length: rowCount }, (_, index) => index + 1)
  const matrix = slots.map((_, row) =>
    dayPrompts.map((prompts) => {
      const prompt = prompts[row]
      return prompt ? promptState[prompt.status] ?? 'notSent' : 'notSent'
    }),
  )
  const free = data.days.map((day) => (day.cells.length === 0 ? null : day.free_entries))
  const freeCount = data.days.reduce((sum, day) => sum + day.free_entries, 0)

  const daysWithCells = data.days.filter((day) => day.cells.length > 0)
  const recent = daysWithCells.slice(-2)
  const hasGap =
    recent.length > 0 &&
    recent.every((day) => day.cells.every((cell) => cell.state !== 'answered'))
  const lastAnswered = [...daysWithCells]
    .reverse()
    .find((day) => day.cells.some((cell) => cell.state === 'answered'))
  const lastDay = daysWithCells[daysWithCells.length - 1]

  return {
    slots,
    days: data.days.map((day) => day.date),
    matrix,
    free,
    freeCount,
    totals: {
      answered: data.summary.answered,
      sent: data.summary.denominator,
      percent: Math.round(data.summary.percentage),
    },
    counts: {
      answered: data.summary.answered,
      expired: data.summary.expired,
      pending: data.summary.sent_pending,
    },
    gap: hasGap
      ? {
          last: lastAnswered?.date ?? '–',
          sentToday: lastDay?.cells.filter((cell) => cell.state !== 'answered').length ?? 0,
        }
      : null,
  }
}

export interface DayStat {
  answered: number
  sent: number
}

export function dayStat(day: AdherenceDay): DayStat {
  // A cell groups the prompts that share an occurrence, which in a day with several
  // once-a-day activities means all of them. Count the prompts, as the overview matrix and the
  // participant page do, so every view shows the same requests.
  let answered = 0
  let sent = 0
  for (const cell of day.cells) {
    for (const prompt of cell.prompts ?? []) {
      if (prompt.status === 'answered') {
        answered += 1
        sent += 1
      } else if (prompt.status === 'sent' || prompt.status === 'expired') {
        sent += 1
      }
    }
  }
  return { answered, sent }
}

export function adherenceTone(answered: number, sent: number): 'ok' | 'wa' | 'da' {
  if (sent === 0) return 'da'
  const ratio = answered / sent
  if (ratio >= 0.75) return 'ok'
  if (ratio >= 0.5) return 'wa'
  return 'da'
}
