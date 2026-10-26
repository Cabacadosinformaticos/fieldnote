import { useMemo, useState } from 'react'
import { useAuditLog, type AuditActorType, type AuditEvent } from '../../api/admin'
import { formatDay, formatTime, isUuid, shortId } from '../../components/admin/format'
import { LockIcon } from '../../components/admin/icons'
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

const auditActions: { code: string; labelKey: AdminKey }[] = [
  { code: 'login', labelKey: 'audit.action.login' },
  { code: 'login_failed', labelKey: 'audit.action.login_failed' },
  { code: 'logout', labelKey: 'audit.action.logout' },
  { code: 'refresh_reuse_detected', labelKey: 'audit.action.refresh_reuse_detected' },
  { code: 'totp_enrolment', labelKey: 'audit.action.totp_enrolment' },
  { code: 'account_created', labelKey: 'audit.action.account_created' },
  { code: 'account_role_changed', labelKey: 'audit.action.account_role_changed' },
  { code: 'account_locked', labelKey: 'audit.action.account_locked' },
  { code: 'account_unlocked', labelKey: 'audit.action.account_unlocked' },
  { code: 'account_deleted', labelKey: 'audit.action.account_deleted' },
  { code: 'study_created', labelKey: 'audit.action.study_created' },
  { code: 'study_updated', labelKey: 'audit.action.study_updated' },
  { code: 'study_started', labelKey: 'audit.action.study_started' },
  { code: 'study_closed', labelKey: 'audit.action.study_closed' },
  { code: 'study_member_added', labelKey: 'audit.action.study_member_added' },
  { code: 'study_member_removed', labelKey: 'audit.action.study_member_removed' },
  { code: 'study_member_role_changed', labelKey: 'audit.action.study_member_role_changed' },
  { code: 'study_question_created', labelKey: 'audit.action.study_question_created' },
  { code: 'study_question_updated', labelKey: 'audit.action.study_question_updated' },
  { code: 'study_question_deleted', labelKey: 'audit.action.study_question_deleted' },
  { code: 'study_questions_reordered', labelKey: 'audit.action.study_questions_reordered' },
  { code: 'study_code_created', labelKey: 'audit.action.study_code_created' },
  { code: 'study_code_regenerated', labelKey: 'audit.action.study_code_regenerated' },
  { code: 'study_code_entry', labelKey: 'audit.action.study_code_entry' },
  { code: 'tag_created', labelKey: 'audit.action.tag_created' },
  { code: 'tag_deleted', labelKey: 'audit.action.tag_deleted' },
  { code: 'activity_created', labelKey: 'audit.action.activity_created' },
  { code: 'activity_updated', labelKey: 'audit.action.activity_updated' },
  { code: 'activity_deleted', labelKey: 'audit.action.activity_deleted' },
  { code: 'participant_added', labelKey: 'audit.action.participant_added' },
  { code: 'participant_approved', labelKey: 'audit.action.participant_approved' },
  { code: 'participant_declined', labelKey: 'audit.action.participant_declined' },
  { code: 'participant_removed', labelKey: 'audit.action.participant_removed' },
  { code: 'participant_invite_issued', labelKey: 'audit.action.participant_invite_issued' },
  { code: 'participant_identity_read', labelKey: 'audit.action.participant_identity_read' },
  { code: 'participant_erased', labelKey: 'audit.action.participant_erased' },
  { code: 'entry_created', labelKey: 'audit.action.entry_created' },
  { code: 'media_upload_url_issued', labelKey: 'audit.action.media_upload_url_issued' },
  { code: 'media_url_issued', labelKey: 'audit.action.media_url_issued' },
  { code: 'export', labelKey: 'audit.action.export' },
  { code: 'erasure_requested', labelKey: 'audit.action.erasure_requested' },
  { code: 'erasure_cancelled', labelKey: 'audit.action.erasure_cancelled' },
  { code: 'pool_invitations_sent', labelKey: 'audit.action.pool_invitations_sent' },
]

const actionLabels = new Map(auditActions.map((item) => [item.code, item.labelKey]))

const failedActions = new Set(['login_failed', 'refresh_reuse_detected'])

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function detailSummary(event: AuditEvent): string {
  if (!event.details) {
    return t('audit.detailsEmpty')
  }
  const entries = Object.entries(event.details)
  if (entries.length === 0) {
    return t('audit.detailsEmpty')
  }
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${renderValue(value)}`)
    .join(' · ')
}

function toIsoDate(value: string, endOfDay: boolean): string | null {
  if (!value) {
    return null
  }
  const time = endOfDay ? '23:59:59.999' : '00:00:00'
  const parsed = new Date(`${value}T${time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export default function AdminAuditPage() {
  const [actor, setActor] = useState<'all' | AuditActorType>('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cursors, setCursors] = useState<(number | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [openId, setOpenId] = useState<number | null>(null)

  const filters = useMemo(
    () => ({
      actorType: actor === 'all' ? null : actor,
      action: action === 'all' ? null : action,
      since: toIsoDate(from, false),
      until: toIsoDate(to, true),
      cursor: cursors[pageIndex] ?? null,
      limit: PAGE_SIZE,
    }),
    [actor, action, from, to, cursors, pageIndex],
  )

  const auditQuery = useAuditLog(filters)
  const events = auditQuery.data?.items ?? []
  const nextCursor = auditQuery.data?.next_cursor ?? null

  function resetPaging() {
    setCursors([null])
    setPageIndex(0)
  }

  function goNext() {
    if (nextCursor === null) {
      return
    }
    setCursors((current) => {
      const next = [...current]
      next[pageIndex + 1] = nextCursor
      return next
    })
    setPageIndex((index) => index + 1)
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
                    resetPaging()
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
              onChange={(event) => {
                setAction(event.target.value)
                resetPaging()
              }}
            >
              <option value="all">{t('audit.action.all')}</option>
              {auditActions.map((item) => (
                <option key={item.code} value={item.code}>
                  {t(item.labelKey)}
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
              onChange={(event) => {
                setFrom(event.target.value)
                resetPaging()
              }}
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
              onChange={(event) => {
                setTo(event.target.value)
                resetPaging()
              }}
            />
          </div>
        </div>
      </section>

      <section className="ad-events-card" aria-label={t('audit.title')}>
        <div className="ad-events-head">
          <h2 className="ad-events-title">{t('audit.heading', { count: events.length })}</h2>
          <span className="ad-muted">{t('audit.order')}</span>
        </div>

        <div className="ad-table-scroll">
          <div className="ad-audit-grid ad-table-head">
            <span>{t('audit.col.date')}</span>
            <span>{t('audit.col.actor')}</span>
            <span>{t('audit.col.action')}</span>
            <span>{t('audit.col.target')}</span>
            <span>{t('audit.col.detail')}</span>
          </div>

          {auditQuery.isPending ? (
            <div className="ad-empty" aria-busy="true">
              {t('audit.loading')}
            </div>
          ) : null}

          {auditQuery.isError ? (
            <div className="ad-empty">
              <p>{t('audit.loadError')}</p>
              <button type="button" className="ad-btn-sm" onClick={() => void auditQuery.refetch()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {!auditQuery.isPending && !auditQuery.isError
            ? events.map((item) => {
                const isOpen = openId === item.id
                const labelKey = actionLabels.get(item.action)
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
                          <span className="ad-cell-strong">{formatDay(item.at)}</span>
                          <span className="ad-mono ad-time">{formatTime(item.at)}</span>
                        </div>

                        <div className="ad-actor">
                          <span className={`ad-actor-badge is-${item.actor_type}`}>
                            {t(actorLabel[item.actor_type])}
                          </span>
                          <span className="ad-cell-strong">
                            {item.actor_id ? shortId(item.actor_id) : t('audit.actorUnknown')}
                          </span>
                        </div>

                        <div className="ad-actor">
                          <span className="ad-action-name">
                            {labelKey ? t(labelKey) : item.action}
                          </span>
                          {failedActions.has(item.action) ? (
                            <span className="pill da ad-failed-pill">{t('audit.failed')}</span>
                          ) : null}
                        </div>

                        <span className="ad-event-target">
                          {item.target
                            ? isUuid(item.target)
                              ? shortId(item.target)
                              : item.target
                            : '—'}
                        </span>
                        <span className="ad-event-detail">{detailSummary(item)}</span>
                      </div>
                    </button>

                    {isOpen && item.details ? (
                      <div className="ad-event-fields">
                        {Object.entries(item.details).map(([key, value]) => (
                          <div key={key} className="ad-event-field">
                            <span className="ad-event-field-key">{key}</span>
                            <span className="ad-event-field-value">{renderValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })
            : null}

          {!auditQuery.isPending && !auditQuery.isError && events.length === 0 ? (
            <div className="ad-empty">{t('audit.empty')}</div>
          ) : null}
        </div>

        <div className="ad-events-foot">
          <span className="ad-muted">{t('audit.showing', { shown: events.length })}</span>
          <div className="ad-pager">
            <button
              type="button"
              className="ad-btn-sm ad-btn-muted"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            >
              {t('audit.previous')}
            </button>
            <span className="ad-page-label">{t('audit.page', { page: pageIndex + 1 })}</span>
            <button
              type="button"
              className="ad-btn-sm"
              disabled={nextCursor === null}
              onClick={goNext}
            >
              {t('audit.next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
