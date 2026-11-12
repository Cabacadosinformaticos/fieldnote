import { useState, type FormEvent } from 'react'
import {
  AdminApiError,
  useErasures,
  useEraseParticipant,
  type CompletedErasure,
} from '../../api/admin'
import {
  usePendingErasureRequests,
  type PendingErasureRequest,
} from '../../api/erasureRequests'
import {
  formatDateOnly,
  formatDateTime,
  formatDay,
  formatHourMinute,
  isUuid,
  shortId,
} from '../../components/admin/format'
import {
  AlertTriangleIcon,
  CheckIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '../../components/admin/icons'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

const deletedItems: { titleKey: AdminKey; noteKey: AdminKey }[] = [
  { titleKey: 'erasure.deleted.identity', noteKey: 'erasure.deleted.identityNote' },
  { titleKey: 'erasure.deleted.entries', noteKey: 'erasure.deleted.entriesNote' },
  { titleKey: 'erasure.deleted.files', noteKey: 'erasure.deleted.filesNote' },
  { titleKey: 'erasure.deleted.link', noteKey: 'erasure.deleted.linkNote' },
]

const keptItems: { titleKey: AdminKey; noteKey: AdminKey }[] = [
  { titleKey: 'erasure.kept.audit', noteKey: 'erasure.kept.auditNote' },
  { titleKey: 'erasure.kept.counts', noteKey: 'erasure.kept.countsNote' },
  { titleKey: 'erasure.kept.backups', noteKey: 'erasure.kept.backupsNote' },
  { titleKey: 'erasure.kept.outside', noteKey: 'erasure.kept.outsideNote' },
]

const steps: { n: string; titleKey: AdminKey; noteKey: AdminKey }[] = [
  { n: '1', titleKey: 'erasure.steps.oneTitle', noteKey: 'erasure.steps.oneNote' },
  { n: '2', titleKey: 'erasure.steps.twoTitle', noteKey: 'erasure.steps.twoNote' },
  { n: '3', titleKey: 'erasure.steps.threeTitle', noteKey: 'erasure.steps.threeNote' },
]

const entryTypeKeys: { type: string; one: AdminKey; many: AdminKey }[] = [
  { type: 'text', one: 'erasure.type.textOne', many: 'erasure.type.textMany' },
  { type: 'photo', one: 'erasure.type.photoOne', many: 'erasure.type.photoMany' },
  { type: 'audio', one: 'erasure.type.audioOne', many: 'erasure.type.audioMany' },
  { type: 'video', one: 'erasure.type.videoOne', many: 'erasure.type.videoMany' },
  { type: 'scale', one: 'erasure.type.scaleOne', many: 'erasure.type.scaleMany' },
  { type: 'choice', one: 'erasure.type.choiceOne', many: 'erasure.type.choiceMany' },
]

function countText(one: AdminKey, many: AdminKey, count: number): string {
  return count === 1 ? t(one) : t(many, { count })
}

function entryBreakdown(request: PendingErasureRequest): string {
  return entryTypeKeys
    .filter((item) => (request.counts.entry_types[item.type] ?? 0) > 0)
    .map((item) => countText(item.one, item.many, request.counts.entry_types[item.type]))
    .join(', ')
}

function requesterText(request: PendingErasureRequest): string {
  const name = request.requested_by_name ?? t('erasure.pending.unknownRequester')
  if (!request.requested_by_role) {
    return name
  }
  return `${name}, ${t(`studies.role.${request.requested_by_role}` as AdminKey)}`
}

function PendingRequestCard({ request }: { request: PendingErasureRequest }) {
  const alias = request.alias ?? shortId(request.participant_id)
  const remaining = Math.max(0, request.counts.study_entries - request.counts.entries)
  const breakdown = entryBreakdown(request)

  return (
    <>
      <section className="ad-pending-card" aria-labelledby={`ad-pending-title-${request.id}`}>
        <div className="ad-pending-head">
          <div className="ad-pending-copy">
            <span className="ad-eyebrow">{t('erasure.pending.eyebrow')}</span>
            <h2 id={`ad-pending-title-${request.id}`} className="ad-pending-title">
              {t('erasure.pending.title', {
                alias,
                study: request.study_title,
              })}
            </h2>
          </div>
          <span className="ad-warning-pill">{t('erasure.pending.status')}</span>
        </div>
        <div className="ad-meta-box">
          <div>
            <span className="ad-meta-key">{t('erasure.pending.requestedBy')}</span>
            <span className="ad-meta-value">{requesterText(request)}</span>
          </div>
          <div>
            <span className="ad-meta-key">{t('erasure.pending.receivedAt')}</span>
            <span className="ad-meta-value">
              {formatDateOnly(request.received_at.slice(0, 10))}
            </span>
          </div>
          <div>
            <span className="ad-meta-key">{t('erasure.pending.decision')}</span>
            <span className="ad-meta-value">
              {t('erasure.pending.acceptedAt', {
                date: formatDateTime(request.created_at),
              })}
            </span>
          </div>
        </div>
      </section>

      <div className="ad-erasure-cards">
        <section className="ad-erasure-card">
          <div className="ad-erasure-card-head">
            <span className="ad-icon-square is-danger">
              <TrashIcon />
            </span>
            <h2 className="ad-card-title">{t('erasure.deletedTitle')}</h2>
          </div>
          <ul className="ad-detail-list">
            <li>
              <span className="ad-detail-title">{t('erasure.deleted.identity')}</span>
              <span className="ad-detail-note">
                {request.counts.has_identity
                  ? t('erasure.deleted.identityNote')
                  : t('erasure.deleted.identityAbsent')}
              </span>
            </li>
            <li>
              <span className="ad-detail-title">
                {countText('erasure.counts.entryOne', 'erasure.counts.entries', request.counts.entries)}
              </span>
              <span className="ad-detail-note">{breakdown || t('erasure.counts.none')}</span>
            </li>
            <li>
              <span className="ad-detail-title">
                {countText('erasure.counts.fileOne', 'erasure.counts.files', request.counts.files)}
              </span>
              <span className="ad-detail-note">{t('erasure.deleted.filesNote')}</span>
            </li>
            <li>
              <span className="ad-detail-title">{t('erasure.deleted.link')}</span>
              <span className="ad-detail-note">{t('erasure.deleted.linkNote')}</span>
            </li>
          </ul>
        </section>

        <section className="ad-erasure-card">
          <div className="ad-erasure-card-head">
            <span className="ad-icon-square is-primary">
              <ShieldCheckIcon width={18} height={18} />
            </span>
            <h2 className="ad-card-title">{t('erasure.keptTitle')}</h2>
          </div>
          <ul className="ad-detail-list">
            <li>
              <span className="ad-detail-title">{t('erasure.kept.audit')}</span>
              <span className="ad-detail-note">{t('erasure.kept.auditNote')}</span>
            </li>
            <li>
              <span className="ad-detail-title">{t('erasure.kept.counts')}</span>
              <span className="ad-detail-note">
                {t('erasure.kept.countsNoteDynamic', {
                  study: request.study_title,
                  participants: request.counts.study_participants,
                  total: request.counts.study_entries,
                  remaining,
                })}
              </span>
            </li>
            <li>
              <span className="ad-detail-title">{t('erasure.kept.backups')}</span>
              <span className="ad-detail-note">{t('erasure.kept.backupsNote')}</span>
            </li>
            <li>
              <span className="ad-detail-title">{t('erasure.kept.outside')}</span>
              <span className="ad-detail-note">{t('erasure.kept.outsideNote')}</span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}

function erasureErrorText(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return t('erasure.error.generic', { code: 'unknown' })
  }
  switch (error.code) {
    case 'participant_not_found':
      return t('erasure.error.notFound')
    case 'erasure_scheduled':
      return t('erasure.error.scheduled')
    case 'totp_required':
      return t('erasure.error.totpRequired')
    case 'invalid_totp':
      return t('erasure.error.totpInvalid')
    case 'totp_enrolment_required':
      return t('erasure.error.totpNotEnrolled')
    default:
      return t('erasure.error.generic', { code: error.code })
  }
}

function backupUntil(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  date.setUTCDate(date.getUTCDate() + 7)
  return formatDateOnly(date.toISOString().slice(0, 10))
}

function historyActor(item: CompletedErasure): string {
  if (item.actor_name) {
    return item.actor_name
  }
  return item.actor_type === 'system'
    ? t('erasure.historySystemActor')
    : t('audit.actorUnknown')
}

export default function AdminErasurePage() {
  const erasuresQuery = useErasures()
  const eraseParticipant = useEraseParticipant()
  const pendingQuery = usePendingErasureRequests()

  const [participantId, setParticipantId] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const scheduled = erasuresQuery.data?.scheduled ?? []
  const completed = erasuresQuery.data?.completed ?? []
  const pendingRequests = pendingQuery.data ?? []
  const selected =
    pendingRequests.find((request) => request.id === selectedId) ?? pendingRequests[0] ?? null

  const id = participantId.trim()
  const expected = selected ? (selected.alias ?? selected.participant_id) : id
  const targetId = selected ? selected.participant_id : id
  const canErase =
    Boolean(targetId) &&
    confirmation.trim() === expected &&
    /^\d{6}$/.test(totpCode.trim()) &&
    (selected !== null || isUuid(id)) &&
    !eraseParticipant.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canErase) {
      return
    }
    setSuccess('')
    eraseParticipant.mutate(
      { participantId: targetId, totpCode: totpCode.trim() },
      {
        onSuccess: (result) => {
          setSuccess(
            t('erasure.confirm.success', {
              entries: result.entries_deleted,
              files: result.files_deleted,
            }),
          )
          setParticipantId('')
          setConfirmation('')
          setTotpCode('')
          setSelectedId(null)
        },
      },
    )
  }

  function handleCancel() {
    setParticipantId('')
    setConfirmation('')
    setTotpCode('')
    setSelectedId(null)
    setSuccess('')
    eraseParticipant.reset()
  }

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('erasure.title')}</h1>
          <p className="ad-subtitle">{t('erasure.subtitle')}</p>
        </div>
      </header>

      <section className="ad-table-card" aria-labelledby="ad-app-erasure-title">
        <div className="ad-app-head">
          <div className="ad-app-heading">
            <div className="ad-app-title-row">
              <h2 id="ad-app-erasure-title" className="ad-card-title">
                {t('erasure.app.title')}
              </h2>
              <span className="ad-readonly">{t('erasure.readOnly')}</span>
            </div>
            <p className="ad-app-note">{t('erasure.app.note')}</p>
          </div>
        </div>

        <div className="ad-table-scroll">
          <div className="ad-erasure-grid ad-table-head">
            <span>{t('erasure.col.participant')}</span>
            <span>{t('erasure.col.study')}</span>
            <span>{t('erasure.col.asked')}</span>
            <span>{t('erasure.col.auto')}</span>
            <span>{t('erasure.col.state')}</span>
          </div>

          {erasuresQuery.isPending ? (
            <div className="ad-empty" aria-busy="true">
              {t('erasure.app.loading')}
            </div>
          ) : null}

          {erasuresQuery.isError ? (
            <div className="ad-empty">
              <p>{t('erasure.app.loadError')}</p>
              <button type="button" className="ad-btn-sm" onClick={() => void erasuresQuery.refetch()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {!erasuresQuery.isPending && !erasuresQuery.isError
            ? scheduled.map((row) => (
                <div key={row.participant_id} className="ad-erasure-grid ad-erasure-row">
                  <span className="ad-mono ad-cell-strong">{row.alias ?? shortId(row.participant_id)}</span>
                  <div className="ad-stack">
                    <span className="ad-cell-strong">{row.study_title ?? '—'}</span>
                    <span className="ad-cell-note ad-mono">{shortId(row.study_id)}</span>
                  </div>
                  <span className="ad-cell-strong">{formatDateTime(row.requested_at)}</span>
                  <span className="ad-cell-strong">{formatDateTime(row.due_at)}</span>
                  <div>
                    <span className="ad-warning-pill">{t('erasure.scheduledState')}</span>
                  </div>
                </div>
              ))
            : null}

          {!erasuresQuery.isPending && !erasuresQuery.isError && scheduled.length === 0 ? (
            <div className="ad-empty">{t('erasure.app.empty')}</div>
          ) : null}
        </div>
      </section>

      <div className="ad-erasure-layout">
        <div className="ad-erasure-main">
          {pendingQuery.isPending ? (
            <section className="ad-pending-card">
              <p className="ad-cell-note">{t('erasure.pending.loading')}</p>
            </section>
          ) : null}

          {pendingQuery.isError ? (
            <section className="ad-pending-card">
              <p className="ad-cell-note">{t('erasure.pending.loadError')}</p>
              <button
                type="button"
                className="ad-btn-sm"
                onClick={() => void pendingQuery.refetch()}
              >
                {t('common.retry')}
              </button>
            </section>
          ) : null}

          {pendingRequests.map((request) => (
            <PendingRequestCard key={request.id} request={request} />
          ))}

          {!pendingQuery.isPending && !pendingQuery.isError && pendingRequests.length === 0 ? (
            <>
              <section className="ad-pending-card" aria-labelledby="ad-pending-title">
                <div className="ad-pending-head">
                  <div className="ad-pending-copy">
                    <span className="ad-eyebrow">{t('erasure.manual.label')}</span>
                    <h2 id="ad-pending-title" className="ad-pending-title">
                      {t('erasure.manual.title')}
                    </h2>
                    <span className="ad-cell-note">{t('erasure.manual.note')}</span>
                  </div>
                  <span className="ad-warning-pill">{t('erasure.manual.status')}</span>
                </div>
              </section>

              <div className="ad-erasure-cards">
                <section className="ad-erasure-card">
                  <div className="ad-erasure-card-head">
                    <span className="ad-icon-square is-danger">
                      <TrashIcon />
                    </span>
                    <h2 className="ad-card-title">{t('erasure.deletedTitle')}</h2>
                  </div>
                  <ul className="ad-detail-list">
                    {deletedItems.map((item) => (
                      <li key={item.titleKey}>
                        <span className="ad-detail-title">{t(item.titleKey)}</span>
                        <span className="ad-detail-note">{t(item.noteKey)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="ad-erasure-card">
                  <div className="ad-erasure-card-head">
                    <span className="ad-icon-square is-primary">
                      <ShieldCheckIcon width={18} height={18} />
                    </span>
                    <h2 className="ad-card-title">{t('erasure.keptTitle')}</h2>
                  </div>
                  <ul className="ad-detail-list">
                    {keptItems.map((item) => (
                      <li key={item.titleKey}>
                        <span className="ad-detail-title">{t(item.titleKey)}</span>
                        <span className="ad-detail-note">{t(item.noteKey)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : null}

          <section className="ad-erasure-card">
            <h2 className="ad-card-title">{t('erasure.afterTitle')}</h2>
            <ol className="ad-steps">
              {steps.map((step) => (
                <li key={step.n}>
                  <span className="ad-step-number">{step.n}</span>
                  <span className="ad-detail-title">{t(step.titleKey)}</span>
                  <span className="ad-detail-note">{t(step.noteKey)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="ad-erasure-aside" aria-label={t('erasure.confirm.title')}>
          <section className="ad-confirm-card">
            <div className="ad-confirm-heading">
              <h2 className="ad-confirm-title">
                <AlertTriangleIcon />
                {t('erasure.confirm.title')}
              </h2>
              <p className="ad-confirm-body">{t('erasure.confirm.body')}</p>
            </div>

            <form className="ad-confirm-form" onSubmit={handleSubmit}>
              {selected ? (
                <div className="ad-field">
                  <label className="ad-label" htmlFor="ad-erasure-request">
                    {t('erasure.pending.select')}
                  </label>
                  {pendingRequests.length > 1 ? (
                    <select
                      id="ad-erasure-request"
                      className="ad-input ad-select"
                      value={selected.id}
                      onChange={(event) => {
                        setSelectedId(event.target.value)
                        setConfirmation('')
                      }}
                      disabled={eraseParticipant.isPending}
                    >
                      {pendingRequests.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.alias ?? shortId(request.participant_id)} ·{' '}
                          {request.study_title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="ad-meta-value">
                      {selected.alias ?? shortId(selected.participant_id)} ·{' '}
                      {selected.study_title}
                    </span>
                  )}
                </div>
              ) : (
                <div className="ad-field">
                  <label className="ad-label" htmlFor="ad-erasure-id">
                    {t('erasure.manual.id')}
                  </label>
                  <input
                    id="ad-erasure-id"
                    type="text"
                    className="ad-input ad-mono ad-input-alias"
                    value={participantId}
                    onChange={(event) => setParticipantId(event.target.value)}
                    aria-describedby="ad-erasure-id-hint"
                    autoComplete="off"
                    disabled={eraseParticipant.isPending}
                  />
                  <span id="ad-erasure-id-hint" className="ad-hint">
                    {t('erasure.manual.idHint')}
                  </span>
                </div>
              )}

              <div className="ad-field">
                <label className="ad-label" htmlFor="ad-erasure-confirm">
                  {selected
                    ? t('erasure.confirm.alias', {
                        alias: selected.alias ?? selected.participant_id,
                      })
                    : t('erasure.confirm.repeat')}
                </label>
                <input
                  id="ad-erasure-confirm"
                  type="text"
                  className="ad-input ad-mono ad-input-alias"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  disabled={eraseParticipant.isPending}
                />
              </div>

              <div className="ad-field">
                <label className="ad-label" htmlFor="ad-erasure-totp">
                  {t('erasure.confirm.totp')}
                </label>
                <input
                  id="ad-erasure-totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="ad-input ad-mono ad-input-alias"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  aria-describedby="ad-erasure-totp-hint"
                  autoComplete="one-time-code"
                  disabled={eraseParticipant.isPending}
                />
                <span id="ad-erasure-totp-hint" className="ad-hint">
                  {t('erasure.confirm.totpHint')}
                </span>
              </div>

              {eraseParticipant.error ? (
                <p className="ad-form-error" role="alert">
                  {erasureErrorText(eraseParticipant.error)}
                </p>
              ) : null}

              {success ? (
                <p className="ad-success" role="status">
                  {success}
                </p>
              ) : null}

              <div className="ad-confirm-actions">
                <button type="submit" className="ad-danger-btn" disabled={!canErase}>
                  <TrashIcon />
                  {t('erasure.confirm.erase')}
                </button>
                <button type="button" className="ad-cancel-btn" onClick={handleCancel}>
                  {t('erasure.confirm.cancel')}
                </button>
              </div>

              <p className="ad-confirm-note">
                {selected ? t('erasure.confirm.pendingNote') : t('erasure.confirm.note')}
              </p>
            </form>
          </section>

          <section className="ad-history-card">
            <h2 className="ad-history-title">{t('erasure.historyTitle')}</h2>
            {completed.length === 0 ? (
              <p className="ad-detail-note">{t('erasure.historyEmpty')}</p>
            ) : (
              completed.map((item, index) => (
                <div
                  key={`${item.participant_id ?? item.alias ?? index}-${item.at}`}
                  className="ad-history-item"
                >
                  <CheckIcon width={18} height={18} />
                  <div>
                    <span className="ad-detail-title">
                      {t('erasure.historyItem', {
                        alias: item.alias ?? shortId(item.participant_id),
                        study: item.study_title ?? '—',
                      })}
                    </span>
                    <span className="ad-detail-note">
                      {t('erasure.historyMeta', {
                        date: formatDay(item.at),
                        time: formatHourMinute(item.at),
                        actor: historyActor(item),
                        entries: item.entries,
                        files: item.files,
                        until: backupUntil(item.at),
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
