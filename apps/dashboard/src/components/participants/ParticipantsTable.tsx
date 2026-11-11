import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  adherenceTone,
  entryRouteKey,
  participantLabel,
  ParticipantsApiError,
  participantDisplayState,
  participantStatusMeta,
  useIssuePersonalCode,
  type DayStat,
  type ParticipantOut,
} from '../../api/participants'
import { errorKey, t } from '../../i18n/participants'
import { availabilityGroups, formatDate, formatDateTime } from './format'
import { EllipsisIcon, LockIcon, TicketIcon, UserMinusIcon } from './icons'
import PersonalCodeModal from './PersonalCodeModal'

export interface ParticipantRow extends ParticipantOut {
  days: (DayStat | null)[]
}

interface MenuState {
  id: string
  top: number
  left: number
}

const MENU_WIDTH = 300

function rowTone(stats: DayStat | null): string {
  if (!stats) return 'is-dash'
  return `is-${adherenceTone(stats.answered, stats.sent)}`
}

function dayNumber(date: string, studyStart: string | null): number | null {
  if (!date || !studyStart) {
    return null
  }
  const diff = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${studyStart}T00:00:00Z`)) / 86_400_000,
  )
  return diff + 1
}

function dateInZone(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function timeInZone(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function availabilityText(item: ParticipantOut): string {
  const summary = item.availability_summary
  if (!summary) {
    return t('table.dash')
  }
  if (summary.any_time) {
    return t('table.anyTime')
  }
  // The same interval can apply only to weekends; without the days the hours look wider than
  // they are and the plan's "outside the participant's hours" reason seems wrong.
  const groups = availabilityGroups(summary)
  const parts: string[] = []
  if (groups.weekdays.length > 0) {
    parts.push(`${t('detail.weekdays')} ${groups.weekdays.join(', ')}`)
  }
  if (groups.weekend.length > 0) {
    parts.push(`${t('detail.weekend')} ${groups.weekend.join(', ')}`)
  }
  return parts.length > 0 ? parts.join(' · ') : t('table.dash')
}

function lastEntryText(value: string | null | undefined, today: string, timeZone: string): string {
  if (!value) {
    return t('table.dash')
  }
  if (dateInZone(value, timeZone) === today) {
    return t('table.lastToday', { time: timeInZone(value, timeZone) })
  }
  return formatDateTime(value)
}

export default function ParticipantsTable({
  studyId,
  rows,
  dayColumns,
  studyStart,
  today,
  timeZone,
  canReadIdentity,
}: {
  studyId: string
  rows: ParticipantRow[]
  dayColumns: string[]
  studyStart: string | null
  today: string
  timeZone: string
  canReadIdentity: boolean
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [issueAlias, setIssueAlias] = useState('')
  const issueCode = useIssuePersonalCode(studyId)
  const issueError =
    issueCode.error instanceof ParticipantsApiError ? issueCode.error.code : null

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  if (rows.length === 0) {
    return (
      <div className="card pts-table-card">
        <p className="pts-empty">{t('list.empty')}</p>
      </div>
    )
  }

  const columns = dayColumns.length > 0 ? dayColumns : ['', '', '', '']

  return (
    <>
      {issueError ? (
        <p className="pts-error" role="alert">
          {t(errorKey(issueError))}
        </p>
      ) : null}

      <div className="card pts-table-card">
        <table className="pts-table">
          <thead>
            <tr>
              <th scope="col">{t('table.participant')}</th>
              <th scope="col">{t('table.status')}</th>
              <th scope="col">{t('table.entry')}</th>
              <th scope="col">{t('table.consent')}</th>
              <th scope="col">{t('table.language')}</th>
              <th scope="col">{t('table.hours')}</th>
              {columns.map((date, index) => {
                const isToday = Boolean(date) && date === today
                const number = dayNumber(date, studyStart)
                return (
                  <th
                    scope="col"
                    key={`head-${index}`}
                    className={isToday ? 'pts-day-head is-today' : 'pts-day-head'}
                    title={
                      isToday
                        ? t('table.todayTitle', { n: number ?? index + 1 })
                        : number !== null
                          ? t('table.dayTitle', { n: number, date: formatDate(date) })
                          : undefined
                    }
                  >
                    {isToday
                      ? t('table.today')
                      : number !== null
                        ? t('table.day', { n: number })
                        : t('table.dash')}
                    <small>{date ? formatDate(date) : t('table.dash')}</small>
                  </th>
                )
              })}
              <th scope="col">{t('table.lastEntry')}</th>
              <th scope="col" className="pts-actions-head">
                <span className="sr-only">{t('table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const status = participantStatusMeta[participantDisplayState(item)]
              const detailsTo = `/estudos/${studyId}/participantes/${item.id}`
              const menuOpen = menu?.id === item.id

              return (
                <tr key={item.id}>
                  <td>
                    <Link className="pts-id-link mono" to={detailsTo}>
                      {participantLabel(item)}
                    </Link>
                  </td>
                  <td>
                    <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
                  </td>
                  <td>{t(entryRouteKey(item.entry_route))}</td>
                  <td className="mono pts-consent">{formatDateTime(item.consented_at)}</td>
                  <td>
                    {item.locale === 'pt'
                      ? t('table.localePt')
                      : item.locale === 'en'
                        ? t('table.localeEn')
                        : t('table.dash')}
                  </td>
                  <td className="mono">{availabilityText(item)}</td>
                  {item.days.map((stats, index) => (
                    <td
                      key={`${item.id}-day-${index}`}
                      className={
                        dayColumns[index] === today ? 'pts-day is-today' : 'pts-day'
                      }
                    >
                      {stats ? (
                        <span
                          className={`pts-ratio ${rowTone(stats)}`}
                          title={t('table.adherenceTitle', {
                            answered: stats.answered,
                            sent: stats.sent,
                          })}
                        >
                          {stats.answered}/{stats.sent}
                        </span>
                      ) : (
                        <span className="pts-ratio is-dash">{t('table.dash')}</span>
                      )}
                    </td>
                  ))}
                  <td className="mono">{lastEntryText(item.last_entry_at, today, timeZone)}</td>
                  <td className="pts-actions-cell">
                    <button
                      type="button"
                      className="pts-row-menu-button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label={t('list.menuAria', { id: participantLabel(item) })}
                      onClick={(event) => {
                        if (menuOpen) {
                          setMenu(null)
                          return
                        }
                        const rect = event.currentTarget.getBoundingClientRect()
                        const left = Math.max(
                          12,
                          Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12),
                        )
                        const top = Math.max(
                          12,
                          Math.min(rect.bottom + 6, window.innerHeight - 168),
                        )
                        setMenu({ id: item.id, top, left })
                      }}
                    >
                      <EllipsisIcon />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {menu
        ? createPortal(
            <>
              <div className="pts-menu-scrim" onClick={() => setMenu(null)} />
              <div
                className="pts-row-menu"
                role="menu"
                style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}
              >
                <button
                  type="button"
                  className="pts-menu-item"
                  role="menuitem"
                  disabled={issueCode.isPending}
                  onClick={() => {
                    const row = rows.find((item) => item.id === menu.id)
                    setIssueAlias(row ? participantLabel(row) : menu.id)
                    issueCode.mutate(menu.id)
                    setMenu(null)
                  }}
                >
                  <TicketIcon />
                  <span>
                    {t('action.newInvite')}
                    <small>{t('list.menuNewCodeHint')}</small>
                  </span>
                </button>
                {rows.find((row) => row.id === menu.id)?.status === 'active' ||
                rows.find((row) => row.id === menu.id)?.status === 'pending_approval' ? (
                  <Link
                    className="pts-menu-item is-danger"
                    role="menuitem"
                    to={`/estudos/${studyId}/participantes/${menu.id}`}
                    state={{ withdraw: true }}
                    onClick={() => setMenu(null)}
                  >
                    <UserMinusIcon />
                    <span>
                      {t('action.withdraw')}
                      <small>{t('list.menuRemoveHint')}</small>
                    </span>
                  </Link>
                ) : null}
                {canReadIdentity ? (
                  <>
                    <span className="pts-menu-sep" />
                    <Link
                      className="pts-menu-item"
                      role="menuitem"
                      to={`/estudos/${studyId}/participantes/${menu.id}`}
                      state={{ identity: true }}
                      onClick={() => setMenu(null)}
                    >
                      <LockIcon />
                      <span>
                        {t('action.seeIdentity')}
                        <small>{t('list.menuIdentityHint')}</small>
                      </span>
                    </Link>
                  </>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}

      {issueCode.data && issueAlias ? (
        <PersonalCodeModal
          alias={issueAlias}
          code={issueCode.data.code}
          expiresAt={issueCode.data.expires_at}
          onClose={() => {
            issueCode.reset()
            setIssueAlias('')
          }}
        />
      ) : null}
    </>
  )
}
