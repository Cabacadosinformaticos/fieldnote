const dateFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
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
