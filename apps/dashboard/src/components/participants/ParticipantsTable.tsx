import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  adherenceTone,
  participantStatusMeta,
  type Participant,
} from '../../fake/participants'
import { t } from '../../i18n/participants'
import { EllipsisIcon, LockIcon, TrashIcon, UserMinusIcon } from './icons'

interface MenuState {
  id: string
  top: number
  left: number
}

const MENU_WIDTH = 300

function rowTone(item: Participant, index: number): string {
  const stats = item.days[index]
  if (!stats) return 'is-dash'
  return `is-${adherenceTone(stats.answered, stats.sent)}`
}

export default function ParticipantsTable({
  studyId,
  rows,
}: {
  studyId: string
  rows: Participant[]
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

  return (
    <>
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
              <th scope="col" className="pts-day-head">
                {t('table.day', { n: 1 })}
                <small>6 out.</small>
              </th>
              <th scope="col" className="pts-day-head">
                {t('table.day', { n: 2 })}
                <small>7 out.</small>
              </th>
              <th scope="col" className="pts-day-head">
                {t('table.day', { n: 3 })}
                <small>8 out.</small>
              </th>
              <th scope="col" className="pts-day-head is-today">
                {t('table.today')}
                <small>até 14:32</small>
              </th>
              <th scope="col">{t('table.lastEntry')}</th>
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
                      {item.id}
                    </Link>
                  </td>
                  <td>
                    <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
                  </td>
                  <td>{item.entry ? t(item.entry === 'qr' ? 'entry.qr' : 'entry.written') : '–'}</td>
                  <td className="mono pts-consent">{item.consent}</td>
                  <td>{item.language}</td>
                  <td className="mono pts-hours">{item.hours}</td>
                  {item.noteKey ? (
                    <td className="pts-row-note" colSpan={4}>
                      {t(item.noteKey)}
                    </td>
                  ) : (
                    item.days.map((stats, index) => (
                      <td
                        key={`${item.id}-day-${index}`}
                        className={index === 3 ? 'pts-day is-today' : 'pts-day'}
                      >
                        {stats ? (
                          <span
                            className={`pts-ratio ${rowTone(item, index)}`}
                            title={
                              index === 3
                                ? t('table.adherenceTodayTitle', {
                                    answered: stats.answered,
                                    sent: stats.sent,
                                  })
                                : t('table.adherenceTitle', {
                                    answered: stats.answered,
                                    sent: stats.sent,
                                  })
                            }
                          >
                            {stats.answered}/{stats.sent}
                          </span>
                        ) : (
                          <span className="pts-ratio is-dash">{t('table.dash')}</span>
                        )}
                      </td>
                    ))
                  )}
                  <td className={item.lastEntryAlert ? 'mono pts-last is-alert' : 'mono pts-last'}>
                    {item.lastEntry}
                  </td>
                  <td className="pts-actions-cell">
                    <button
                      type="button"
                      className="pts-row-menu-button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label={t('list.menuAria', { id: item.id })}
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
                          Math.min(rect.bottom + 6, window.innerHeight - 228),
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
                <span className="pts-menu-sep" />
                <Link
                  className="pts-menu-item"
                  role="menuitem"
                  to={`/estudos/${studyId}/participantes/${menu.id}`}
                  onClick={() => setMenu(null)}
                >
                  <LockIcon />
                  <span>
                    {t('action.seeIdentity')}
                    <small>{t('list.menuIdentityHint')}</small>
                  </span>
                </Link>
                <Link
                  className="pts-menu-item"
                  role="menuitem"
                  to={`/estudos/${studyId}/participantes/${menu.id}`}
                  state={{ erasure: true }}
                  onClick={() => setMenu(null)}
                >
                  <TrashIcon />
                  <span>
                    {t('action.requestErasure')}
                    <small>{t('list.menuErasureHint')}</small>
                  </span>
                </Link>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
