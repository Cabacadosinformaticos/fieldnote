import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { client, refreshSession } from './client'
import type { components } from './schema'
import { getAccessToken } from './tokens'

export type EntryOut = components['schemas']['EntryOut']
export type EntryType = components['schemas']['EntryType']
export type MediaOut = components['schemas']['MediaOut']
export type TagOut = components['schemas']['TagOut']
export type EntryListResponse = components['schemas']['EntryListResponse']
export type MediaRetryOut = components['schemas']['MediaRetryOut']
export type TimelineResponse = components['schemas']['TimelineResponse']
export type TimelineLane = components['schemas']['TimelineLane']
export type TimelineEntry = components['schemas']['TimelineEntry']
export type TimelineMarker = components['schemas']['TimelineMarker']
export type ActivityOut = components['schemas']['ActivityOut']
export type ParticipantOut = components['schemas']['ParticipantOut']
export type StudyOut = components['schemas']['StudyOut']
export type StudyMemberOut = components['schemas']['StudyMemberOut']
export type StudyRole = components['schemas']['StudyRole']
export type TimelineZoom = 'week' | 'day' | 'hours'

type ErrorEnvelope = { error?: { code?: string; message?: string } }

export class EntriesApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'EntriesApiError'
    this.code = code
    this.status = status
  }
}

function toApiError(error: unknown, response: Response): EntriesApiError {
  const body = error as ErrorEnvelope | undefined
  return new EntriesApiError(
    body?.error?.code ?? `http_${response.status}`,
    response.status,
    body?.error?.message ?? response.statusText,
  )
}

export type EntryFilters = {
  participantId?: string
  activityId?: string
  entryType?: EntryType
  tagId?: string
  dateFrom?: string
  dateTo?: string
  q?: string
  freeOnly?: boolean
  lateOnly?: boolean
  cursor?: string | null
  limit?: number
}

export type ExportScope = 'all' | 'filtered'
export type ExportMediaType = 'photo' | 'audio' | 'video'

export type ExportHistoryItem = {
  id: number
  who: string
  when: string
  entry_count: number | null
  scope: ExportScope
  filter: Record<string, unknown> | null
  include_location: boolean
  include_identity: boolean
  include_media: boolean
  media_types: ExportMediaType[]
  include_csv: boolean
}

export type ExportOptions = {
  includeLocation: boolean
  includeIdentity: boolean
  scope: ExportScope
  filter?: EntryFilters
  includeMedia: boolean
  mediaTypes: ExportMediaType[]
  includeCsv: boolean
}

export type TimelineParams = {
  zoom: TimelineZoom
  start: string
  end: string
  participantId?: string
  activityId?: string
  entryType?: EntryType
  tagId?: string
}

const ROOT = 'entries'

export const entryKeys = {
  all: (studyId: string) => [ROOT, studyId] as const,
  list: (studyId: string, filters: EntryFilters) =>
    [ROOT, studyId, 'list', filters] as const,
  detail: (studyId: string, entryId: string | null) =>
    [ROOT, studyId, 'detail', entryId] as const,
  study: (studyId: string) => [ROOT, studyId, 'study'] as const,
  activities: (studyId: string) => [ROOT, studyId, 'activities'] as const,
  participants: (studyId: string) => [ROOT, studyId, 'participants'] as const,
  tags: (studyId: string) => [ROOT, studyId, 'tags'] as const,
  members: (studyId: string) => [ROOT, studyId, 'members'] as const,
  timeline: (studyId: string, params: TimelineParams) =>
    [ROOT, studyId, 'timeline', params] as const,
  exports: (studyId: string) => [ROOT, studyId, 'exports'] as const,
}

export function useEntries(studyId: string | undefined, filters: EntryFilters) {
  return useQuery({
    queryKey: entryKeys.list(studyId ?? '', filters),
    enabled: Boolean(studyId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<EntryListResponse> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/entries', {
        params: {
          path: { study_id: studyId },
          query: {
            limit: filters.limit ?? 12,
            ...(filters.participantId ? { participant_id: filters.participantId } : {}),
            ...(filters.activityId ? { activity_id: filters.activityId } : {}),
            ...(filters.entryType ? { entry_type: filters.entryType } : {}),
            ...(filters.tagId ? { tag_id: filters.tagId } : {}),
            ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
            ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
            ...(filters.q ? { q: filters.q } : {}),
            ...(filters.freeOnly ? { free_only: true } : {}),
            ...(filters.lateOnly ? { late_only: true } : {}),
            ...(filters.cursor ? { cursor: filters.cursor } : {}),
          },
        },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useRetryEntryMedia(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entryId: string): Promise<MediaRetryOut> => {
      const { data, error, response } = await client.POST(
        '/studies/{study_id}/entries/{entry_id}/media/retry',
        { params: { path: { study_id: studyId, entry_id: entryId } } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: (_data, entryId) => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.detail(studyId, entryId) })
      void queryClient.invalidateQueries({ queryKey: entryKeys.all(studyId) })
    },
  })
}

export function useEntry(
  studyId: string | undefined,
  entryId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: entryKeys.detail(studyId ?? '', entryId ?? null),
    enabled: Boolean(studyId && entryId && enabled),
    queryFn: async (): Promise<EntryOut> => {
      if (!studyId || !entryId) {
        throw new EntriesApiError('entry_missing', 0, 'The entry is missing.')
      }
      const { data, error, response } = await client.GET(
        '/studies/{study_id}/entries/{entry_id}',
        { params: { path: { study_id: studyId, entry_id: entryId } } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useStudy(studyId: string | undefined) {
  return useQuery({
    queryKey: entryKeys.study(studyId ?? ''),
    enabled: Boolean(studyId),
    queryFn: async (): Promise<StudyOut> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useActivities(studyId: string | undefined) {
  return useQuery({
    queryKey: entryKeys.activities(studyId ?? ''),
    enabled: Boolean(studyId),
    queryFn: async (): Promise<ActivityOut[]> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET(
        '/studies/{study_id}/activities',
        { params: { path: { study_id: studyId } } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useParticipants(studyId: string | undefined) {
  return useQuery({
    queryKey: entryKeys.participants(studyId ?? ''),
    enabled: Boolean(studyId),
    queryFn: async (): Promise<ParticipantOut[]> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET(
        '/studies/{study_id}/participants',
        { params: { path: { study_id: studyId } } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useTags(studyId: string | undefined) {
  return useQuery({
    queryKey: entryKeys.tags(studyId ?? ''),
    enabled: Boolean(studyId),
    queryFn: async (): Promise<TagOut[]> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET('/studies/{study_id}/tags', {
        params: { path: { study_id: studyId } },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useCreateTag(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string): Promise<TagOut> => {
      const { data, error, response } = await client.POST('/studies/{study_id}/tags', {
        params: { path: { study_id: studyId } },
        body: { name },
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.tags(studyId) })
    },
  })
}

export function useSetEntryTags(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      entryId,
      tagIds,
    }: {
      entryId: string
      tagIds: string[]
    }): Promise<components['schemas']['EntryTagsOut']> => {
      const { data, error, response } = await client.PUT(
        '/studies/{study_id}/entries/{entry_id}/tags',
        {
          params: { path: { study_id: studyId, entry_id: entryId } },
          body: { tag_ids: tagIds },
        },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.all(studyId) })
    },
  })
}

export function useMembers(studyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: entryKeys.members(studyId ?? ''),
    enabled: Boolean(studyId && enabled),
    queryFn: async (): Promise<StudyMemberOut[]> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET(
        '/studies/{study_id}/members',
        { params: { path: { study_id: studyId } } },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export function useTimeline(
  studyId: string | undefined,
  params: TimelineParams,
  enabled = true,
) {
  return useQuery({
    queryKey: entryKeys.timeline(studyId ?? '', params),
    enabled: Boolean(studyId && enabled),
    queryFn: async (): Promise<TimelineResponse> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      const { data, error, response } = await client.GET(
        '/studies/{study_id}/timeline',
        {
          params: {
            path: { study_id: studyId },
            query: {
              zoom: params.zoom,
              start: params.start,
              end: params.end,
              ...(params.participantId ? { participant_id: params.participantId } : {}),
              ...(params.activityId ? { activity_id: params.activityId } : {}),
              ...(params.entryType ? { entry_type: params.entryType } : {}),
              ...(params.tagId ? { tag_id: params.tagId } : {}),
            },
          },
        },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
  })
}

export type StudyPermissions = {
  isAdmin: boolean
  role: StudyRole | null
  canIncludeIdentity: boolean
}

export function useStudyPermissions(studyId: string | undefined): StudyPermissions {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const members = useMembers(studyId, !isAdmin)
  const membership = members.data?.find((member) => member.user_id === user?.id)
  const role = membership?.role ?? null
  return {
    isAdmin,
    role,
    canIncludeIdentity: isAdmin || role === 'principal_investigator',
  }
}

type StreamingEvent = { event: string; data: string }

function parseSseChunk(chunk: string): StreamingEvent | null {
  let event = 'message'
  const data: string[] = []
  for (const line of chunk.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') {
      event = value
    } else if (field === 'data') {
      data.push(value)
    }
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null
}

/**
 * The stream needs the Bearer token, which EventSource cannot send, so this reads the response
 * body with fetch and reconnects from the last received entry when the connection drops.
 */
export function useStudyEvents(studyId: string | undefined, onEvent?: () => void) {
  const queryClient = useQueryClient()
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')

  useEffect(() => {
    if (!studyId) {
      return
    }
    const controller = new AbortController()
    let stopped = false
    let lastReceivedAt: string | null = null
    let attempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleInvalidate = () => {
      if (invalidateTimer) {
        return
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = undefined
        void queryClient.invalidateQueries({ queryKey: entryKeys.all(studyId) })
        onEventRef.current?.()
      }, 250)
    }

    const url = () => {
      const suffix = lastReceivedAt
        ? `?since=${encodeURIComponent(lastReceivedAt)}`
        : ''
      return `/api/v1/studies/${studyId}/events${suffix}`
    }

    const open = async (): Promise<Response> => {
      const headers: Record<string, string> = { Accept: 'text/event-stream' }
      const token = getAccessToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      let response = await fetch(url(), {
        headers,
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'include',
      })
      if (response.status === 401) {
        const session = await refreshSession()
        if (session) {
          response = await fetch(url(), {
            headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'include',
          })
        }
      }
      return response
    }

    const connect = async () => {
      if (stopped) {
        return
      }
      setStatus((current) => (current === 'live' ? current : 'connecting'))
      try {
        const response = await open()
        if (!response.ok || !response.body) {
          throw new Error(`sse_http_${response.status}`)
        }
        attempt = 0
        setStatus('live')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!stopped) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }
          buffer += decoder.decode(value, { stream: true })
          let boundary = buffer.indexOf('\n\n')
          while (boundary >= 0) {
            const chunk = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const parsed = parseSseChunk(chunk)
            if (parsed) {
              if (parsed.event.startsWith('entry.') || parsed.event.startsWith('participant.')) {
                try {
                  const payload = JSON.parse(parsed.data) as { received_at?: string }
                  if (payload.received_at) {
                    lastReceivedAt = payload.received_at
                  }
                } catch {
                  // A malformed payload only means the stream cannot resume from it.
                }
                scheduleInvalidate()
              }
            }
            boundary = buffer.indexOf('\n\n')
          }
        }
      } catch {
        // The abort on unmount and network failures both land here; only the latter reconnects.
      }

      if (stopped) {
        return
      }
      setStatus('offline')
      attempt += 1
      const delay = Math.min(1000 * 2 ** attempt, 15_000)
      retryTimer = setTimeout(() => {
        void connect()
      }, delay)
    }

    void connect()

    return () => {
      stopped = true
      controller.abort()
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
      if (invalidateTimer) {
        clearTimeout(invalidateTimer)
      }
    }
  }, [studyId, queryClient])

  return status
}

/**
 * Re-runs the queries a page reads whenever the study event stream reports a change.
 * The stream already invalidates the entries; pass the other keys the page depends on.
 */
export function useStudyLiveRefresh(
  studyId: string | undefined,
  queryKeys: readonly QueryKey[],
) {
  const queryClient = useQueryClient()
  const keysRef = useRef(queryKeys)
  useEffect(() => {
    keysRef.current = queryKeys
  })
  return useStudyEvents(studyId, () => {
    for (const queryKey of keysRef.current) {
      void queryClient.invalidateQueries({ queryKey })
    }
  })
}

async function exportResponse(url: string): Promise<Response> {
  const send = (token: string | null) =>
    fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      cache: 'no-store',
    })

  let response = await send(getAccessToken())
  if (response.status === 401) {
    let code: string | null = null
    try {
      const body = (await response.clone().json()) as ErrorEnvelope
      code = body.error?.code ?? null
    } catch {
      code = null
    }
    if (code === 'token_expired') {
      const session = await refreshSession()
      if (session) {
        response = await send(session.access_token)
      }
    }
  }
  return response
}

export async function downloadStudyExport(
  studyId: string,
  options: ExportOptions,
): Promise<string> {
  const query = new URLSearchParams()
  if (options.includeLocation) {
    query.set('include_location', 'true')
  }
  if (options.includeIdentity) {
    query.set('include_identity', 'true')
  }
  if (options.includeMedia) {
    query.set('include_media', 'true')
    for (const type of options.mediaTypes) {
      query.append('media_type', type)
    }
    if (!options.includeCsv) {
      query.set('include_csv', 'false')
    }
  }
  if (options.scope === 'filtered') {
    query.set('scope', 'filtered')
    const filter = options.filter ?? {}
    if (filter.participantId) {
      query.set('participant_id', filter.participantId)
    }
    if (filter.activityId) {
      query.set('activity_id', filter.activityId)
    }
    if (filter.entryType) {
      query.set('entry_type', filter.entryType)
    }
    if (filter.tagId) {
      query.set('tag_id', filter.tagId)
    }
    if (filter.dateFrom) {
      query.set('date_from', filter.dateFrom)
    }
    if (filter.dateTo) {
      query.set('date_to', filter.dateTo)
    }
    if (filter.q) {
      query.set('q', filter.q)
    }
    if (filter.freeOnly) {
      query.set('free_only', 'true')
    }
    if (filter.lateOnly) {
      query.set('late_only', 'true')
    }
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await exportResponse(`/api/v1/studies/${studyId}/export${suffix}`)
  if (!response.ok) {
    let code: string | null = null
    try {
      const body = (await response.json()) as ErrorEnvelope
      code = body.error?.code ?? null
    } catch {
      code = null
    }
    throw new EntriesApiError(code ?? `http_${response.status}`, response.status, 'Export failed.')
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^"]+)"?/.exec(disposition)
  const filename = match?.[1] ?? `fieldnote-export-${studyId}.zip`
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoking at once can cancel the download while the browser is still reading the blob.
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
  return filename
}

async function fetchExportHistory(studyId: string): Promise<ExportHistoryItem[]> {
  const response = await exportResponse(`/api/v1/studies/${studyId}/exports`)
  if (!response.ok) {
    let code: string | null = null
    try {
      const body = (await response.json()) as ErrorEnvelope
      code = body.error?.code ?? null
    } catch {
      code = null
    }
    throw new EntriesApiError(
      code ?? `http_${response.status}`,
      response.status,
      'Export history failed.',
    )
  }
  const body = (await response.json()) as { items?: ExportHistoryItem[] }
  return body.items ?? []
}

export function useExportHistory(studyId: string | undefined) {
  return useQuery({
    queryKey: entryKeys.exports(studyId ?? ''),
    enabled: Boolean(studyId),
    queryFn: async (): Promise<ExportHistoryItem[]> => {
      if (!studyId) {
        throw new EntriesApiError('study_missing', 0, 'The study is missing.')
      }
      return fetchExportHistory(studyId)
    },
  })
}
