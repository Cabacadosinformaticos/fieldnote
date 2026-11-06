const months = [
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

const dateTime = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Lisbon',
})

const dayPart = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Lisbon',
})

const timePart = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Lisbon',
})

const hourMinutePart = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Lisbon',
})

/** Date-only API values (starts_on, ends_on) stay in the calendar; no timezone shift. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed)
}

export function formatDay(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : dayPart.format(parsed)
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : timePart.format(parsed)
}

export function formatHourMinute(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : hourMinutePart.format(parsed)
}

export function shortId(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
