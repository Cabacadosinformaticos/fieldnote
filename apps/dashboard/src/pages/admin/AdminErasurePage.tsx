import { useState, type FormEvent } from 'react'
import { AdminApiError, useErasures, useEraseParticipant } from '../../api/admin'
import { formatDateTime, isUuid, shortId } from '../../components/admin/format'
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

function erasureErrorText(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return t('erasure.error.generic', { code: 'unknown' })
  }
  switch (error.code) {
    case 'participant_not_found':
      return t('erasure.error.notFound')
    case 'erasure_scheduled':
      return t('erasure.error.scheduled')
    default:
      return t('erasure.error.generic', { code: error.code })
  }
}

export default function AdminErasurePage() {
  const erasuresQuery = useErasures()
  const eraseParticipant = useEraseParticipant()

  const [participantId, setParticipantId] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [success, setSuccess] = useState('')

  const scheduled = erasuresQuery.data?.scheduled ?? []
  const completed = erasuresQuery.data?.completed ?? []

  const id = participantId.trim()
  const canErase = isUuid(id) && id === confirmation.trim() && !eraseParticipant.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canErase) {
      return
    }
    setSuccess('')
    eraseParticipant.mutate(id, {
      onSuccess: (result) => {
        setSuccess(
          t('erasure.confirm.success', {
            entries: result.entries_deleted,
            files: result.files_deleted,
          }),
        )
        setParticipantId('')
        setConfirmation('')
      },
    })
  }

  function handleCancel() {
    setParticipantId('')
    setConfirmation('')
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

              <div className="ad-field">
                <label className="ad-label" htmlFor="ad-erasure-confirm">
                  {t('erasure.confirm.repeat')}
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

              <p className="ad-confirm-note">{t('erasure.confirm.note')}</p>
            </form>
          </section>

          <section className="ad-history-card">
            <h2 className="ad-history-title">{t('erasure.historyTitle')}</h2>
            {completed.length === 0 ? (
              <p className="ad-detail-note">{t('erasure.historyEmpty')}</p>
            ) : (
              completed.map((item) => (
                <div
                  key={`${item.participant_id}-${item.at}`}
                  className="ad-history-item"
                >
                  <CheckIcon width={18} height={18} />
                  <div>
                    <span className="ad-detail-title">
                      {t('erasure.historyItem', { id: shortId(item.participant_id) })}
                    </span>
                    <span className="ad-detail-note">
                      {t('erasure.historyMeta', {
                        study: item.study_title ?? '—',
                        date: formatDateTime(item.at),
                        entries: item.entries,
                        files: item.files,
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
