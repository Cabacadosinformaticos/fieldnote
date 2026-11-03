import type { ParticipantOut } from '../../api/participants'

const dateFormat = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? '–' : dateFormat.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '–'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '–' : dateTimeFormat.format(date)
}

export function availabilityRanges(
  summary: ParticipantOut['availability_summary'],
): string[] {
  if (!summary || summary.any_time) {
    return []
  }
  const seen = new Set<string>()
  const ranges: string[] = []
  for (const interval of summary.intervals) {
    const range = `${interval.start_time.slice(0, 5)}–${interval.end_time.slice(0, 5)}`
    if (!seen.has(range)) {
      seen.add(range)
      ranges.push(range)
    }
  }
  return ranges
}

/** Weekday intervals (ISO 1 to 5) and weekend intervals (6 and 7), ready to display. */
export function availabilityGroups(summary: ParticipantOut['availability_summary']): {
  anyTime: boolean
  weekdays: string[]
  weekend: string[]
} {
  if (!summary) {
    return { anyTime: false, weekdays: [], weekend: [] }
  }
  if (summary.any_time) {
    return { anyTime: true, weekdays: [], weekend: [] }
  }
  const weekdays: string[] = []
  const weekend: string[] = []
  for (const interval of summary.intervals) {
    const range = `${interval.start_time.slice(0, 5)} às ${interval.end_time.slice(0, 5)}`
    if (interval.weekdays.some((day) => day >= 1 && day <= 5) && !weekdays.includes(range)) {
      weekdays.push(range)
    }
    if (interval.weekdays.some((day) => day >= 6) && !weekend.includes(range)) {
      weekend.push(range)
    }
  }
  return { anyTime: false, weekdays, weekend }
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

export function emailDisplayName(email: string): string {
  const localPart = email.split('@')[0] ?? email
  const words = localPart.split(/[._-]+/).filter(Boolean)
  if (words.length === 0) {
    return email
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function emailInitials(email: string): string {
  const words = emailDisplayName(email).split(' ').filter(Boolean)
  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || '?'
  )
}

export function nextAlias(aliases: (string | null)[]): string {
  let highest = 0
  for (const alias of aliases) {
    const match = /^P-(\d+)$/.exec(alias ?? '')
    if (match) {
      highest = Math.max(highest, Number(match[1]))
    }
  }
  return `P-${String(highest + 1).padStart(2, '0')}`
}
