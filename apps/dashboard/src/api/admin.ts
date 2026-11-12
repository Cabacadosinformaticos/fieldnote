import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from './client'
import type { components } from './schema'

export type AdminAccount = components['schemas']['app__schemas__admin__AccountOut'] & {
  name?: string | null
}
export type CreatedAccount = components['schemas']['AccountCreatedOut'] & {
  name?: string | null
}
export type AccountLinkResult = components['schemas']['AccountLinkOut']
export type ScheduleStyle = components['schemas']['ScheduleStyle']
// The generated schema is refreshed after all workers finish; these fields are hand-written.
export type AdminStudy = Omit<components['schemas']['AdminStudyOut'], 'team'> & {
  schedule_style: ScheduleStyle
  active_participants: number
  adherence_percentage: number | null
  adherence_period: 'today' | 'final' | null
  team: (components['schemas']['AdminStudyOut']['team'][number] & { name: string | null })[]
}
export type AuditActorType = components['schemas']['AuditActorType']
export type AuditEvent = components['schemas']['AuditEventOut'] & {
  actor_name: string | null
  actor_study_title: string | null
  origin_client: 'portal' | 'app_android' | 'app_ios' | 'scheduled_task' | 'automatic_task' | null
  origin_ip: string | null
  origin_browser: string | null
}
export type AuditPage = Omit<components['schemas']['AuditLogPage'], 'items'> & {
  items: AuditEvent[]
  total: number
  page_count: number
}
// The generated schema predates the alias and the counts kept on a done request.
export type ErasureList = Omit<components['schemas']['ErasureListOut'], 'completed'> & {
  completed: CompletedErasure[]
}
export type ScheduledErasure = components['schemas']['ScheduledErasureOut']
export type CompletedErasure = {
  participant_id: string | null
  alias: string | null
  study_id: string | null
  study_title: string | null
  actor_type: AuditActorType
  actor_id: string | null
  actor_name: string | null
  at: string
  entries: number
  files: number
}
export type ErasureResult = components['schemas']['ErasureResultOut']
export type UserRole = components['schemas']['UserRole']
export type PoolOverview = components['schemas']['AdminPoolOverviewOut']

export class AdminApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    this.status = status
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

async function toAdminError(error: unknown, response: Response): Promise<AdminApiError> {
  const body = error as ErrorEnvelope | undefined
  let code = body?.error?.code
  let message = body?.error?.message
  if (!code) {
    try {
      const parsed = (await response.clone().json()) as ErrorEnvelope
      code = parsed.error?.code
      message = parsed.error?.message
    } catch {
      // A body without JSON is not an error envelope; fall back to the status.
    }
  }
  return new AdminApiError(
    code ?? `http_${response.status}`,
    response.status,
    message ?? response.statusText,
  )
}

export async function fetchAccounts(): Promise<AdminAccount[]> {
  const { data, error, response } = await client.GET('/admin/accounts')
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function createAccount(input: {
  email: string
  name: string | null
  role: UserRole
}): Promise<CreatedAccount> {
  const body = input
  const { data, error, response } = await client.POST('/admin/accounts', { body })
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function updateAccount(
  userId: string,
  role: UserRole,
  name: string | null,
): Promise<AdminAccount> {
  const body = { role, name }
  const { data, error, response } = await client.PATCH('/admin/accounts/{user_id}', {
    params: { path: { user_id: userId } },
    body,
  })
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

async function accountAction(
  action: 'lock' | 'unlock',
  userId: string,
): Promise<AdminAccount> {
  const options = { params: { path: { user_id: userId } } }
  const { data, error, response } =
    action === 'lock'
      ? await client.POST('/admin/accounts/{user_id}/lock', options)
      : await client.POST('/admin/accounts/{user_id}/unlock', options)
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export function lockAccount(userId: string): Promise<AdminAccount> {
  return accountAction('lock', userId)
}

export function unlockAccount(userId: string): Promise<AdminAccount> {
  return accountAction('unlock', userId)
}

export async function sendAccountLink(userId: string): Promise<AccountLinkResult> {
  const { data, error, response } = await client.POST('/admin/accounts/{user_id}/send-link', {
    params: { path: { user_id: userId } },
  })
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function fetchStudies(): Promise<AdminStudy[]> {
  const { data, error, response } = await client.GET('/admin/studies')
  if (data) {
    return data as AdminStudy[]
  }
  throw await toAdminError(error, response)
}

export type AuditFilters = {
  actorType: AuditActorType | null
  action: string | null
  q?: string | null
  since: string | null
  until: string | null
  cursor: number | null
  limit?: number
}

export async function fetchAuditLog(filters: AuditFilters): Promise<AuditPage> {
  const { data, error, response } = await client.GET('/admin/audit-log', {
    params: {
      query: {
        actor_type: filters.actorType,
        action: filters.action,
        q: filters.q,
        since: filters.since,
        until: filters.until,
        cursor: filters.cursor,
        limit: filters.limit,
      },
    },
  })
  if (data) {
    return data as AuditPage
  }
  throw await toAdminError(error, response)
}

export async function fetchErasures(): Promise<ErasureList> {
  const { data, error, response } = await client.GET('/admin/erasures')
  if (data) {
    return data as ErasureList
  }
  throw await toAdminError(error, response)
}

export async function fetchPoolOverview(): Promise<PoolOverview> {
  const { data, error, response } = await client.GET('/admin/pool/overview')
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

type ErasurePostResult = { data?: ErasureResult; error?: unknown; response: Response }

// The generated schema predates the TOTP code in the body; openapi.json is refreshed after the
// batch, so the route is called through this narrow cast instead of being regenerated here.
const postErasure = client.POST as unknown as (
  path: '/admin/participants/{participant_id}/erasure',
  options: {
    params: { path: { participant_id: string } }
    body: { totp_code: string }
  },
) => Promise<ErasurePostResult>

export async function eraseParticipant(
  participantId: string,
  totpCode: string,
): Promise<ErasureResult> {
  const { data, error, response } = await postErasure(
    '/admin/participants/{participant_id}/erasure',
    {
      params: { path: { participant_id: participantId } },
      body: { totp_code: totpCode },
    },
  )
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

const keys = {
  accounts: ['admin', 'accounts'] as const,
  studies: ['admin', 'studies'] as const,
  erasures: ['admin', 'erasures'] as const,
  audit: ['admin', 'audit'] as const,
  pool: ['admin', 'pool'] as const,
}

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: fetchAccounts })
}

export function useStudies() {
  return useQuery({ queryKey: keys.studies, queryFn: fetchStudies })
}

export function useErasures(enabled = true) {
  return useQuery({
    queryKey: keys.erasures,
    queryFn: fetchErasures,
    enabled,
  })
}

export function usePoolOverview() {
  return useQuery({ queryKey: keys.pool, queryFn: fetchPoolOverview })
}

export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: [...keys.audit, filters],
    queryFn: () => fetchAuditLog(filters),
    placeholderData: keepPreviousData,
  })
}

function useAccountMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.accounts })
      void queryClient.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

export function useCreateAccount() {
  return useAccountMutation((input: { email: string; name: string | null; role: UserRole }) =>
    createAccount(input),
  )
}

export function useUpdateAccount() {
  return useAccountMutation((input: { userId: string; role: UserRole; name: string | null }) =>
    updateAccount(input.userId, input.role, input.name),
  )
}

export function useLockAccount() {
  return useAccountMutation((userId: string) => lockAccount(userId))
}

export function useUnlockAccount() {
  return useAccountMutation((userId: string) => unlockAccount(userId))
}

export function useSendAccountLink() {
  return useAccountMutation((userId: string) => sendAccountLink(userId))
}

export function useEraseParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { participantId: string; totpCode: string }) =>
      eraseParticipant(input.participantId, input.totpCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.erasures })
      void queryClient.invalidateQueries({ queryKey: keys.audit })
      void queryClient.invalidateQueries({ queryKey: ['erasure-requests', 'pending'] })
    },
  })
}
