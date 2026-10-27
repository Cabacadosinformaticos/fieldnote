import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from './client'
import type { components } from './schema'
import { t } from '../i18n/activities'

export type Activity = components['schemas']['ActivityOut']
export type ActivityCreate = components['schemas']['ActivityCreate']
export type ActivityUpdate = components['schemas']['ActivityUpdate']
export type ActivityOptions = components['schemas']['ActivityOptions']

export type CaptureType = 'photo' | 'text' | 'video' | 'audio' | 'scale'
export type ScaleKind = 'number' | 'faces' | 'text' | 'bar'

export type ActivityScaleDraft = {
  kind: ScaleKind
  points: number
  lowLabel: string
  highLabel: string
  midLabel: string
}

export type ActivityDraft = {
  id: string | null
  title: string
  instruction: string
  types: CaptureType[]
  scale: ActivityScaleDraft
  effortMinutes: number
  locationRequested: boolean
  freeEntriesEnabled: boolean
  freeEntriesPerDay: number
  windowStart: string
  windowEnd: string
  requestsPerDay: number
  minGapMinutes: number
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

export class ActivitiesApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ActivitiesApiError'
    this.code = code
    this.status = status
  }
}

function toApiError(error: unknown, response: Response): ActivitiesApiError {
  const body = error as ErrorEnvelope | undefined
  return new ActivitiesApiError(
    body?.error?.code ?? `http_${response.status}`,
    response.status,
    body?.error?.message ?? response.statusText,
  )
}

export function activitiesErrorMessage(error: unknown): string {
  if (!(error instanceof ActivitiesApiError)) {
    return t('error.network')
  }

  switch (error.code) {
    case 'study_not_found':
      return t('error.study_not_found')
    case 'activity_not_found':
      return t('error.activity_not_found')
    case 'forbidden':
      return t('error.forbidden')
    case 'study_closed':
      return t('error.study_closed')
    case 'invalid_status_transition':
      return t('error.study_closed')
    case 'validation_error':
      return t('error.validation')
    default:
      return t('error.generic')
  }
}

const scaleKindFromApi: Record<NonNullable<ActivityOptions['scale_type']>, ScaleKind> = {
  numbers: 'number',
  faces: 'faces',
  text: 'text',
  slider: 'bar',
}

const scaleKindToApi: Record<ScaleKind, NonNullable<ActivityOptions['scale_type']>> = {
  number: 'numbers',
  faces: 'faces',
  text: 'text',
  bar: 'slider',
}

const captureTypes: CaptureType[] = ['photo', 'text', 'video', 'audio', 'scale']

function isCaptureType(value: string): value is CaptureType {
  return (captureTypes as string[]).includes(value)
}

export function shortTime(value: string): string {
  return value.slice(0, 5)
}

function apiTime(value: string): string {
  const trimmed = value.trim()
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed
}

export function newActivityDraft(): ActivityDraft {
  return {
    id: null,
    title: '',
    instruction: '',
    types: ['photo', 'text'],
    scale: {
      kind: 'number',
      points: 7,
      lowLabel: 'Muito mal',
      highLabel: 'Muito bem',
      midLabel: '',
    },
    effortMinutes: 1,
    locationRequested: false,
    freeEntriesEnabled: false,
    freeEntriesPerDay: 1,
    windowStart: '08:00',
    windowEnd: '22:00',
    requestsPerDay: 1,
    minGapMinutes: 60,
  }
}

export function draftFromActivity(activity: Activity): ActivityDraft {
  const types = activity.entry_types.filter(isCaptureType)
  const options = activity.options

  return {
    id: activity.id,
    title: activity.title,
    instruction: activity.instructions ?? '',
    types: types.length > 0 ? types : ['text'],
    scale: {
      kind: options ? scaleKindFromApi[options.scale_type] : 'number',
      points: options?.points ?? 7,
      lowLabel: options?.start_label ?? 'Muito mal',
      highLabel: options?.end_label ?? 'Muito bem',
      midLabel: options?.middle_label ?? '',
    },
    effortMinutes: activity.expected_minutes,
    locationRequested: activity.capture_location,
    freeEntriesEnabled: activity.allow_free_entries,
    freeEntriesPerDay: activity.max_free_entries_per_day ?? 1,
    windowStart: shortTime(activity.window_start),
    windowEnd: shortTime(activity.window_end),
    requestsPerDay: activity.prompts_per_day,
    minGapMinutes: activity.min_gap_minutes,
  }
}

function buildOptions(scale: ActivityScaleDraft): ActivityOptions {
  const kind = scale.kind
  const start = scale.lowLabel.trim()
  const end = scale.highLabel.trim()
  const middle = scale.midLabel.trim()

  if (kind === 'bar') {
    return {
      scale_type: scaleKindToApi[kind],
      points: null,
      start_label: start || null,
      end_label: end || null,
      middle_label: null,
    }
  }

  if (kind === 'faces') {
    return {
      scale_type: scaleKindToApi[kind],
      points: scale.points,
      start_label: start || null,
      end_label: end || null,
      middle_label: scale.points % 2 === 1 && middle ? middle : null,
    }
  }

  return {
    scale_type: scaleKindToApi[kind],
    points: scale.points,
    start_label: start || null,
    end_label: end || null,
    middle_label: scale.points % 2 === 1 && middle ? middle : null,
  }
}

export function draftToBody(draft: ActivityDraft): ActivityCreate {
  return {
    title: draft.title.trim(),
    instructions: draft.instruction.trim() || null,
    entry_types: draft.types,
    options: draft.types.includes('scale') ? buildOptions(draft.scale) : null,
    prompts_per_day: draft.requestsPerDay,
    window_start: apiTime(draft.windowStart),
    window_end: apiTime(draft.windowEnd),
    min_gap_minutes: draft.minGapMinutes,
    capture_location: draft.locationRequested,
    allow_free_entries: draft.freeEntriesEnabled,
    max_free_entries_per_day: draft.freeEntriesEnabled ? draft.freeEntriesPerDay : null,
    expected_minutes: draft.effortMinutes,
  }
}

export function draftValidationError(draft: ActivityDraft): string | null {
  if (!draft.title.trim()) {
    return t('edit.error.title')
  }
  if (draft.types.length === 0) {
    return t('edit.error.types')
  }
  if (draft.types.includes('scale') && (draft.scale.kind === 'number' || draft.scale.kind === 'text')) {
    if (!draft.scale.lowLabel.trim() || !draft.scale.highLabel.trim()) {
      return t('edit.error.labels')
    }
  }
  return null
}

export const activityKeys = {
  all: (studyId: string) => ['studies', studyId, 'activities'] as const,
  list: (studyId: string) => [...activityKeys.all(studyId), 'list'] as const,
  detail: (studyId: string, activityId: string) =>
    [...activityKeys.all(studyId), 'detail', activityId] as const,
}

async function fetchActivities(studyId: string): Promise<Activity[]> {
  const { data, error, response } = await client.GET('/studies/{study_id}/activities', {
    params: { path: { study_id: studyId } },
  })
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

async function fetchActivity(studyId: string, activityId: string): Promise<Activity> {
  const { data, error, response } = await client.GET(
    '/studies/{study_id}/activities/{activity_id}',
    { params: { path: { study_id: studyId, activity_id: activityId } } },
  )
  if (data) {
    return data
  }
  throw toApiError(error, response)
}

export function useActivities(studyId: string | undefined) {
  return useQuery({
    queryKey: activityKeys.list(studyId ?? ''),
    queryFn: () => fetchActivities(studyId as string),
    enabled: Boolean(studyId),
  })
}

export function useActivity(studyId: string | undefined, activityId: string | undefined) {
  return useQuery({
    queryKey: activityKeys.detail(studyId ?? '', activityId ?? ''),
    queryFn: () => fetchActivity(studyId as string, activityId as string),
    enabled: Boolean(studyId && activityId),
  })
}

export function useCreateActivity(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: ActivityCreate) => {
      const { data, error, response } = await client.POST('/studies/{study_id}/activities', {
        params: { path: { study_id: studyId } },
        body,
      })
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(studyId) })
    },
  })
}

export function useUpdateActivity(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId, body }: { activityId: string; body: ActivityUpdate }) => {
      const { data, error, response } = await client.PATCH(
        '/studies/{study_id}/activities/{activity_id}',
        {
          params: { path: { study_id: studyId, activity_id: activityId } },
          body,
        },
      )
      if (data) {
        return data
      }
      throw toApiError(error, response)
    },
    onSuccess: (activity) => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(studyId) })
      void queryClient.invalidateQueries({
        queryKey: activityKeys.detail(studyId, activity.id),
      })
    },
  })
}

export function useDeleteActivity(studyId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error, response } = await client.DELETE(
        '/studies/{study_id}/activities/{activity_id}',
        { params: { path: { study_id: studyId, activity_id: activityId } } },
      )
      if (response.ok) {
        return activityId
      }
      throw toApiError(error, response)
    },
    onSuccess: (activityId) => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(studyId) })
      void queryClient.removeQueries({ queryKey: activityKeys.detail(studyId, activityId) })
    },
  })
}
