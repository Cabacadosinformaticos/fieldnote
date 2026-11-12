import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from './client'

/**
 * The generated schema does not know these endpoints yet (openapi.json is refreshed after the
 * batch), so the types live here by hand and the typed client is used only as the transport.
 */
export type StudyRole = 'principal_investigator' | 'co_investigator' | 'member'

export type ErasureRequestSummary = {
  id: string
  status: 'pending' | 'done' | 'cancelled'
  // Null on a done request whose participant was erased; the alias stays as the record.
  participant_id: string | null
  participant_alias: string
  study_id: string
  requested_by: string | null
  requested_by_name: string | null
  received_at: string
  created_at: string
}

export type ErasureRequestCounts = {
  entries: number
  files: number
  entry_types: Record<string, number>
  has_identity: boolean
  study_participants: number
  study_entries: number
}

export type PendingErasureRequest = ErasureRequestSummary & {
  // A pending request always still points at its participant.
  participant_id: string
  alias: string | null
  study_title: string
  requested_by_role: StudyRole | null
  counts: ErasureRequestCounts
}

export class ErasureRequestsApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ErasureRequestsApiError'
    this.code = code
    this.status = status
  }
}

type Result = { data?: unknown; error?: unknown; response: Response }

type UntypedClient = {
  GET: (
    path: string,
    options?: { params?: { path?: Record<string, string> } },
  ) => Promise<Result>
  POST: (
    path: string,
    options: { params?: { path?: Record<string, string> }; body?: unknown },
  ) => Promise<Result>
  DELETE: (
    path: string,
    options?: { params?: { path?: Record<string, string> } },
  ) => Promise<Result>
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

const api = client as unknown as UntypedClient

async function unwrap<T>(result: Result): Promise<T> {
  if (result.data !== undefined) {
    return result.data as T
  }
  const body = result.error as ErrorEnvelope | undefined
  throw new ErasureRequestsApiError(
    body?.error?.code ?? `http_${result.response.status}`,
    result.response.status,
    body?.error?.message ?? result.response.statusText,
  )
}

const base = '/studies/{study_id}/participants/{participant_id}/erasure-request'

export async function fetchParticipantErasureRequest(
  studyId: string,
  participantId: string,
): Promise<ErasureRequestSummary | null> {
  return unwrap(
    await api.GET(base, {
      params: { path: { study_id: studyId, participant_id: participantId } },
    }),
  )
}

export async function createErasureRequest(
  studyId: string,
  participantId: string,
  receivedAt: string,
): Promise<ErasureRequestSummary> {
  return unwrap(
    await api.POST(base, {
      params: { path: { study_id: studyId, participant_id: participantId } },
      body: { received_at: receivedAt },
    }),
  )
}

export async function cancelErasureRequest(
  studyId: string,
  participantId: string,
): Promise<void> {
  const result = await api.DELETE(base, {
    params: { path: { study_id: studyId, participant_id: participantId } },
  })
  if (result.response.ok) {
    return
  }
  const body = result.error as ErrorEnvelope | undefined
  throw new ErasureRequestsApiError(
    body?.error?.code ?? `http_${result.response.status}`,
    result.response.status,
    body?.error?.message ?? result.response.statusText,
  )
}

export async function fetchPendingErasureRequests(): Promise<PendingErasureRequest[]> {
  return unwrap(await api.GET('/admin/erasure-requests'))
}

const keys = {
  all: ['erasure-requests'] as const,
  participant: (studyId: string, participantId: string) =>
    ['erasure-requests', 'participant', studyId, participantId] as const,
  pending: ['erasure-requests', 'pending'] as const,
}

export function useParticipantErasureRequest(
  studyId: string,
  participantId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: keys.participant(studyId, participantId),
    queryFn: () => fetchParticipantErasureRequest(studyId, participantId),
    enabled: Boolean(studyId && participantId && enabled),
    retry: false,
  })
}

function useInvalidate(studyId: string, participantId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({
      queryKey: keys.participant(studyId, participantId),
    })
    void queryClient.invalidateQueries({ queryKey: keys.pending })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })
  }
}

export function useCreateErasureRequest(studyId: string, participantId: string) {
  const invalidate = useInvalidate(studyId, participantId)
  return useMutation({
    mutationFn: (receivedAt: string) =>
      createErasureRequest(studyId, participantId, receivedAt),
    onSuccess: invalidate,
  })
}

export function useCancelErasureRequest(studyId: string, participantId: string) {
  const invalidate = useInvalidate(studyId, participantId)
  return useMutation({
    mutationFn: () => cancelErasureRequest(studyId, participantId),
    onSuccess: invalidate,
  })
}

export function usePendingErasureRequests(enabled = true) {
  return useQuery({
    queryKey: keys.pending,
    queryFn: fetchPendingErasureRequests,
    enabled,
  })
}
