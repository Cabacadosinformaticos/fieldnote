import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  adherenceTone,
  entryRouteKey,
  participantStatusMeta,
  type DayStat,
  type ParticipantOut,
} from '../../api/participants'
import { t } from '../../i18n/participants'
import { formatDate } from './format'
import { EllipsisIcon, LockIcon, UserMinusIcon } from './icons'

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

export default function ParticipantsTable({
  studyId,
  rows,
  dayColumns,
  canReadIdentity,
}: {
  studyId: string
  rows: ParticipantRow[]
  dayColumns: string[]
  canReadIdentity: boolean
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)

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
      <div className="card pts-table-card">
        <table className="pts-table">
          <thead>
            <tr>
              <th scope="col">{t('table.participant')}</th>
              <th scope="col">{t('table.status')}</th>
              <th scope="col">{t('table.entry')}</th>
              <th scope="col">{t('table.registered')}</th>
              {columns.map((date, index) => (
                <th
                  scope="col"
                  key={`head-${index}`}
                  className={index === columns.length - 1 ? 'pts-day-head is-today' : 'pts-day-head'}
                >
                  {t('table.day', { n: index + 1 })}
                  <small>{date ? formatDate(date) : t('table.dash')}</small>
                </th>
              ))}
              <th scope="col" className="pts-actions-head">
                <span className="sr-only">{t('table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const status = participantStatusMeta[item.status]
              const detailsTo = `/estudos/${studyId}/participantes/${item.id}`
              const menuOpen = menu?.id === item.id

              return (
                <tr key={item.id}>
                  <td>
                    <Link className="pts-id-link mono" to={detailsTo}>
                      {item.alias ?? item.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
                  </td>
                  <td>{t(entryRouteKey(item.entry_route))}</td>
                  <td className="mono pts-consent">{formatDate(item.entered_at)}</td>
                  {item.days.map((stats, index) => (
                    <td
                      key={`${item.id}-day-${index}`}
                      className={index === item.days.length - 1 ? 'pts-day is-today' : 'pts-day'}
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
                  <td className="pts-actions-cell">
                    <button
                      type="button"
                      className="pts-row-menu-button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label={t('list.menuAria', { id: item.alias ?? item.id })}
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
    </>
  )
}
