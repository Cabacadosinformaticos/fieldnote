import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from './client'
import type { components } from './schema'

export type AdminAccount = components['schemas']['app__schemas__admin__AccountOut']
export type CreatedAccount = components['schemas']['AccountCreatedOut']
export type AdminStudy = components['schemas']['AdminStudyOut']
export type AuditActorType = components['schemas']['AuditActorType']
export type AuditEvent = components['schemas']['AuditEventOut']
export type AuditPage = components['schemas']['AuditLogPage']
export type ErasureList = components['schemas']['ErasureListOut']
export type ScheduledErasure = components['schemas']['ScheduledErasureOut']
export type CompletedErasure = components['schemas']['CompletedErasureOut']
export type ErasureResult = components['schemas']['ErasureResultOut']
export type UserRole = components['schemas']['UserRole']

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
  role: UserRole
}): Promise<CreatedAccount> {
  const { data, error, response } = await client.POST('/admin/accounts', {
    body: input,
  })
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function changeAccountRole(
  userId: string,
  role: UserRole,
): Promise<AdminAccount> {
  const { data, error, response } = await client.PATCH('/admin/accounts/{user_id}', {
    params: { path: { user_id: userId } },
    body: { role },
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

export async function deleteAccount(userId: string): Promise<void> {
  const { error, response } = await client.DELETE('/admin/accounts/{user_id}', {
    params: { path: { user_id: userId } },
  })
  if (!response.ok) {
    throw await toAdminError(error, response)
  }
}

export async function fetchStudies(): Promise<AdminStudy[]> {
  const { data, error, response } = await client.GET('/admin/studies')
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export type AuditFilters = {
  actorType: AuditActorType | null
  action: string | null
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
        since: filters.since,
        until: filters.until,
        cursor: filters.cursor,
        limit: filters.limit,
      },
    },
  })
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function fetchErasures(): Promise<ErasureList> {
  const { data, error, response } = await client.GET('/admin/erasures')
  if (data) {
    return data
  }
  throw await toAdminError(error, response)
}

export async function eraseParticipant(participantId: string): Promise<ErasureResult> {
  const { data, error, response } = await client.POST(
    '/admin/participants/{participant_id}/erasure',
    { params: { path: { participant_id: participantId } } },
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
  return useAccountMutation((input: { email: string; role: UserRole }) => createAccount(input))
}

export function useChangeAccountRole() {
  return useAccountMutation((input: { userId: string; role: UserRole }) =>
    changeAccountRole(input.userId, input.role),
  )
}

export function useLockAccount() {
  return useAccountMutation((userId: string) => lockAccount(userId))
}

export function useUnlockAccount() {
  return useAccountMutation((userId: string) => unlockAccount(userId))
}

export function useDeleteAccount() {
  return useAccountMutation((userId: string) => deleteAccount(userId))
}

export function useEraseParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eraseParticipant,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.erasures })
      void queryClient.invalidateQueries({ queryKey: keys.audit })
    },
  })
}
