import type { EntryOut, EntryType, TagOut } from '../../api/entries'
import type { EntriesKey } from '../../i18n/entries'

export type { EntryOut, EntryType, TagOut }

export type TimelineKind = EntryType | 'request'
export type EntryStatus = 'ready' | 'processing' | 'failed'

export const entryKindMeta: Record<
  EntryType,
  { labelKey: EntriesKey; color: string; tint: string }
> = {
  photo: { labelKey: 'kind.photo', color: '#2F5BEA', tint: '#EAF0FF' },
  text: { labelKey: 'kind.text', color: '#5B6478', tint: '#EEF1F6' },
  video: { labelKey: 'kind.video', color: '#131A2A', tint: '#E6EAF3' },
  audio: { labelKey: 'kind.audio', color: '#0E7C66', tint: '#E3F4EC' },
  scale: { labelKey: 'kind.scale', color: '#B96A00', tint: '#FFF3D6' },
  choice: { labelKey: 'kind.choice', color: '#6B3FA0', tint: '#F1EAFB' },
}

export const entryStatusMeta: Record<EntryStatus, { labelKey: EntriesKey; tone: string }> = {
  ready: { labelKey: 'status.ready', tone: 'ok' },
  processing: { labelKey: 'status.processing', tone: 'wa' },
  failed: { labelKey: 'status.failed', tone: 'da' },
}

export function entryStatusOf(entry: EntryOut): EntryStatus {
  const statuses = (entry.media ?? []).map((media) => media.status)
  if (statuses.includes('failed')) {
    return 'failed'
  }
  if (statuses.some((status) => status === 'pending' || status === 'uploaded')) {
    return 'processing'
  }
  return 'ready'
}

/** A free entry has no prompt behind it; the activity is still recorded. */
export function isFree(entry: EntryOut): boolean {
  return entry.prompt_id === null
}

export function lateMinutes(entry: EntryOut): number {
  const recorded = new Date(entry.recorded_at).getTime()
  const received = new Date(entry.received_at).getTime()
  return Math.max(0, Math.round((received - recorded) / 60_000))
}

export function isLate(entry: EntryOut, threshold = 15): boolean {
  return lateMinutes(entry) > threshold
}

export function entryAlias(entry: EntryOut): string {
  return entry.participant_alias ?? shortId(entry.participant_id)
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

type PaletteName = 'teal' | 'green' | 'sand'

const palettes: Record<PaletteName, { sky: string; sun: string; far: string; near: string; trunk: string; tree: string; tree2: string }> = {
  teal: {
    sky: '#D7E5E8',
    sun: '#F1E4B8',
    far: '#A9C9CF',
    near: '#6A9FA8',
    trunk: '#3F7480',
    tree: '#3F7480',
    tree2: '#6A9FA8',
  },
  green: {
    sky: '#CFE3D2',
    sun: '#EBD9A8',
    far: '#9CC3A6',
    near: '#5E9470',
    trunk: '#3E7352',
    tree: '#3E7352',
    tree2: '#5E9470',
  },
  sand: {
    sky: '#E8E1CB',
    sun: '#D9B66B',
    far: '#CDBF94',
    near: '#9DAA72',
    trunk: '#5F7F52',
    tree: '#5F7F52',
    tree2: '#9DAA72',
  },
}

export function paletteFor(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 3
  }
  return palettes[(['teal', 'green', 'sand'] as PaletteName[])[hash]]
}

export type ScaleAnswer = {
  type: string
  points: number
  labels: string[]
  value: number
  lowLabel: string
  highLabel: string
}

function defaultScaleLabels(type: string, points: number): string[] {
  if (type === 'faces') {
    if (points === 4) {
      return ['Muito mal', 'Mal', 'Bem', 'Muito bem']
    }
    return Array.from({ length: points }, (_, index) => String(index + 1))
  }
  const start = type === 'numbers' && points === 11 ? 0 : 1
  return Array.from({ length: points }, (_, index) => String(start + index))
}

function shownLabels(shown: Record<string, unknown>): string[] {
  const labels = shown.labels
  if (Array.isArray(labels)) {
    const texts = labels.map((label) => String(label)).filter(Boolean)
    if (texts.length > 0) {
      return texts
    }
  }
  const start = shown.label_start ?? shown.start_label
  const middle = shown.label_middle ?? shown.middle_label
  const end = shown.label_end ?? shown.end_label
  const ordered = [start, middle, end].filter((label) => label !== undefined && label !== null)
  return ordered.map((label) => String(label))
}

export function scaleAnswer(entry: EntryOut): ScaleAnswer | null {
  if (entry.entry_type !== 'scale' || !entry.scale_shown) {
    return null
  }
  const shown = entry.scale_shown
  const type = String(shown.scale_type ?? 'numbers')
  const rawLabels = shownLabels(shown)
  const points =
    typeof shown.points === 'number'
      ? shown.points
      : rawLabels.length > 1
        ? rawLabels.length
        : 0
  const labels = rawLabels.length > 0 ? rawLabels : defaultScaleLabels(type, points)
  return {
    type,
    points,
    labels,
    value: entry.value ?? 0,
    lowLabel: labels[0] ?? '',
    highLabel: labels[labels.length - 1] ?? '',
  }
}

export function scaleTypeKey(type: string): EntriesKey {
  switch (type) {
    case 'faces':
      return 'detail.scaleFaces'
    case 'slider':
      return 'detail.scaleSlider'
    case 'text':
      return 'detail.scaleText'
    default:
      return 'detail.scaleNumeric'
  }
}

const MONTHS_SHORT = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
]

const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function splitDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number)
  return { year, month, day }
}

export function formatShortDate(isoDate: string): string {
  const { month, day } = splitDate(isoDate)
  return `${pad(day)} ${MONTHS_SHORT[month - 1]}`
}

export function formatLongDate(isoDate: string): string {
  const { year, month, day } = splitDate(isoDate)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('pt-PT', {
    weekday: 'long',
    timeZone: 'UTC',
  })
  return `${weekday}, ${day} de ${MONTHS_LONG[month - 1]}`
}

export function addDays(isoDate: string, delta: number): string {
  const { year, month, day } = splitDate(isoDate)
  const date = new Date(Date.UTC(year, month - 1, day + delta, 12))
  return date.toISOString().slice(0, 10)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${pad(hours)}:${pad(minutes)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    zoneFormatters.set(timeZone, formatter)
  }
  return formatter
}

export type ZonedParts = { date: string; time: string; minutes: number }

export function zonedParts(isoTimestamp: string, timeZone: string): ZonedParts {
  const parts = zoneFormatter(timeZone).formatToParts(new Date(isoTimestamp))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const hour = get('hour')
  const minute = get('minute')
  return {
    date: `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`,
    time: `${pad(hour)}:${pad(minute)}`,
    minutes: hour * 60 + minute,
  }
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zoneFormatter(timeZone).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - date.getTime()
}

/** Turn a wall-clock date and minute in the study timezone into an ISO 8601 instant. */
export function zonedDateTime(isoDate: string, minutesOfDay: number, timeZone: string): string {
  const { year, month, day } = splitDate(isoDate)
  const hours = Math.floor(minutesOfDay / 60)
  const minutes = minutesOfDay % 60
  const guess = Date.UTC(year, month - 1, day, hours, minutes)
  const offset = zoneOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset).toISOString()
}

export function dayStartIso(isoDate: string, timeZone: string): string {
  return zonedDateTime(isoDate, 0, timeZone)
}

export function todayInZone(timeZone: string): string {
  return zonedParts(new Date().toISOString(), timeZone).date
}

export function nowInZone(timeZone: string): string {
  return zonedParts(new Date().toISOString(), timeZone).time
}

export function formatStamp(isoTimestamp: string, timeZone: string): string {
  const { date, time } = zonedParts(isoTimestamp, timeZone)
  const { month, day } = splitDate(date)
  return `${pad(day)} ${MONTHS_SHORT[month - 1]} ${time}`
}

export function formatReceived(entry: EntryOut, timeZone: string): string {
  const recorded = zonedParts(entry.recorded_at, timeZone)
  const received = zonedParts(entry.received_at, timeZone)
  return received.date === recorded.date
    ? received.time
    : formatStamp(entry.received_at, timeZone)
}

export function formatRange(fromDate: string, toDate: string): string {
  return `${formatShortDate(fromDate)} a ${formatShortDate(toDate)}`
}

export function tagNames(tags: TagOut[]): string[] {
  return tags.map((tag) => tag.name)
}
