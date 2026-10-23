import { useMemo, useState } from 'react'
import { LockIcon, SearchIcon } from '../../components/admin/icons'
import {
  auditActions,
  auditEvents,
  type AuditActorType,
} from '../../fake/admin'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

const PAGE_SIZE = 22

const actorFilters: { key: 'all' | AuditActorType; labelKey: AdminKey }[] = [
  { key: 'all', labelKey: 'audit.actor.all' },
  { key: 'user', labelKey: 'audit.actor.user' },
  { key: 'participant', labelKey: 'audit.actor.participant' },
  { key: 'system', labelKey: 'audit.actor.system' },
]

const actorLabel: Record<AuditActorType, AdminKey> = {
  user: 'audit.actor.user',
  participant: 'audit.actor.participant',
  system: 'audit.actor.system',
}

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

function formatDate(iso: string) {
  if (!iso) {
    return '—'
  }
  const [year, month, day] = iso.split('-')
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`
}

export default function AdminAuditPage() {
  const [actor, setActor] = useState<'all' | AuditActorType>('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('2026-09-29')
  const [to, setTo] = useState('2026-10-09')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>('AUD-001284')
  const [page, setPage] = useState(1)

  const visibleEvents = useMemo(() => {
    const term = query.trim().toLowerCase()
    return auditEvents.filter((item) => {
      const matchesActor = actor === 'all' || item.actorType === actor
      const matchesAction = action === 'all' || item.action === action
      const matchesFrom = from.length === 0 || item.date >= from
      const matchesTo = to.length === 0 || item.date <= to
      const matchesQuery =
        term.length === 0 ||
        item.actor.toLowerCase().includes(term) ||
        item.target.toLowerCase().includes(term) ||
        item.detail.toLowerCase().includes(term) ||
        item.action.toLowerCase().includes(term)
      return matchesActor && matchesAction && matchesFrom && matchesTo && matchesQuery
    })
  }, [actor, action, from, to, query])

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageEvents = visibleEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const shown = Math.min(visibleEvents.length, safePage * PAGE_SIZE)

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
  }

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('audit.title')}</h1>
          <p className="ad-subtitle">{t('audit.subtitle')}</p>
        </div>
      </header>

      <div className="ad-banner">
        <LockIcon width={20} height={20} />
        <p>
          <strong>{t('audit.immutableStrong')}</strong>
          {t('audit.immutableBody')}
        </p>
      </div>

      <section className="ad-filter-card" aria-label={t('audit.filtersLabel')}>
        <div className="ad-filter-row">
          <div className="ad-field ad-field-auto">
            <span id="ad-audit-actor-label" className="ad-label">
              {t('audit.actorType')}
            </span>
            <div
              className="ad-filters ad-filters-actor"
              role="group"
              aria-labelledby="ad-audit-actor-label"
            >
              {actorFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={actor === item.key ? 'ad-filter is-active' : 'ad-filter'}
                  aria-pressed={actor === item.key}
                  onClick={() => {
                    setActor(item.key)
                    setPage(1)
                  }}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="ad-field ad-field-action">
            <label className="ad-label" htmlFor="ad-audit-action">
              {t('audit.action')}
            </label>
            <select
              id="ad-audit-action"
              className="ad-input ad-select"
              value={action}
              onChange={(event) => updateFilter(setAction, event.target.value)}
            >
              <option value="all">{t('audit.action.all')}</option>
              {auditActions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="ad-field ad-field-date">
            <label className="ad-label" htmlFor="ad-audit-from">
              {t('audit.from')}
            </label>
            <input
              id="ad-audit-from"
              type="date"
              className="ad-input"
              value={from}
              onChange={(event) => updateFilter(setFrom, event.target.value)}
            />
          </div>

          <div className="ad-field ad-field-date">
            <label className="ad-label" htmlFor="ad-audit-to">
              {t('audit.to')}
            </label>
            <input
              id="ad-audit-to"
              type="date"
              className="ad-input"
              value={to}
              onChange={(event) => updateFilter(setTo, event.target.value)}
            />
          </div>

          <div className="ad-field ad-field-grow">
            <label className="ad-label" htmlFor="ad-audit-query">
              {t('audit.search')}
            </label>
            <div className="ad-search ad-search-full">
              <SearchIcon />
              <input
                id="ad-audit-query"
                type="search"
                className="ad-input"
                placeholder={t('audit.searchPlaceholder')}
                value={query}
                onChange={(event) => updateFilter(setQuery, event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="ad-events-card" aria-label={t('audit.title')}>
        <div className="ad-events-head">
          <h2 className="ad-events-title">
            {t('audit.heading', {
              count: visibleEvents.length,
              from: formatDate(from),
              to: formatDate(to),
            })}
          </h2>
          <span className="ad-muted">{t('audit.order')}</span>
        </div>

        <div className="ad-table-scroll">
          <div className="ad-audit-grid ad-table-head">
            <span>{t('audit.col.date')}</span>
            <span>{t('audit.col.actor')}</span>
            <span>{t('audit.col.action')}</span>
            <span>{t('audit.col.target')}</span>
            <span>{t('audit.col.detail')}</span>
            <span>{t('audit.col.origin')}</span>
          </div>

          {pageEvents.map((item) => {
            const isOpen = openId === item.id
            return (
              <div key={item.id} className={isOpen ? 'ad-event is-open' : 'ad-event'}>
                <button
                  type="button"
                  className="ad-event-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                >
                  <div className="ad-audit-grid ad-event-grid">
                    <div className="ad-stack">
                      <span className="ad-cell-strong">{item.day}</span>
                      <span className="ad-mono ad-time">{item.time}</span>
                    </div>

                    <div className="ad-actor">
                      <span className={`ad-actor-badge is-${item.actorType}`}>
                        {t(actorLabel[item.actorType])}
                      </span>
                      <span className="ad-cell-strong">{item.actor}</span>
                    </div>

                    <div className="ad-actor">
                      <span className="ad-action-name">{item.action}</span>
                      {item.failed ? (
                        <span className="pill da ad-failed-pill">{t('audit.failed')}</span>
                      ) : null}
                    </div>

                    <span className="ad-event-target">{item.target}</span>
                    <span className="ad-event-detail">{item.detail}</span>

                    <div className="ad-stack">
                      <span className="ad-mono ad-ip">{item.ip}</span>
                      <span className="ad-cell-note">{item.via}</span>
                    </div>
                  </div>
                </button>

                {isOpen && item.fields ? (
                  <div className="ad-event-fields">
                    {item.fields.map((field) => (
                      <div key={field.k} className="ad-event-field">
                        <span className="ad-event-field-key">{field.k}</span>
                        <span className="ad-event-field-value">{field.v}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}

          {pageEvents.length === 0 ? <div className="ad-empty">{t('audit.empty')}</div> : null}
        </div>

        <div className="ad-events-foot">
          <span className="ad-muted">
            {t('audit.showing', { shown, total: visibleEvents.length })}
          </span>
          <div className="ad-pager">
            <button
              type="button"
              className="ad-btn-sm ad-btn-muted"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('audit.previous')}
            </button>
            <span className="ad-page-label">
              {t('audit.page', { page: safePage, pages: totalPages })}
            </span>
            <button
              type="button"
              className="ad-btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {t('audit.next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
