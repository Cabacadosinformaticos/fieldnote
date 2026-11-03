const dayMonth = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
})

const dayMonthYear = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`)
}

/** Numeric pt-PT date, zero padded everywhere: 04/11. */
export function formatDayMonth(isoDate: string | null | undefined): string {
  return isoDate ? dayMonth.format(toDate(isoDate)) : '–'
}

/** Numeric pt-PT date, zero padded everywhere: 04/11/2026. */
export function formatDayMonthYear(isoDate: string | null | undefined): string {
  return isoDate ? dayMonthYear.format(toDate(isoDate)) : '–'
}

/** Study period: 20/10 a 02/11/2026. */
export function formatDateRange(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): string {
  if (startsOn && endsOn) {
    return `${formatDayMonth(startsOn)} a ${formatDayMonthYear(endsOn)}`
  }
  return formatDayMonthYear(startsOn ?? endsOn)
}

export function formatWeekdayDayMonth(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(toDate(isoDate))
}
