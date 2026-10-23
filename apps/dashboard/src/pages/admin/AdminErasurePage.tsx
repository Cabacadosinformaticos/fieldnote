import { useState, type FormEvent } from 'react'
import {
  AlertTriangleIcon,
  CheckIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '../../components/admin/icons'
import {
  erasureAppRows,
  erasureDeleted,
  erasureHistory,
  erasureKept,
  erasurePending,
  erasureSteps,
} from '../../fake/admin'
import { t } from '../../i18n/admin'
import '../../styles/admin.css'

export default function AdminErasurePage() {
  const [alias, setAlias] = useState('')
  const [totp, setTotp] = useState('')
  const [erased, setErased] = useState(false)
  const [success, setSuccess] = useState('')

  const canErase =
    alias.trim().toUpperCase() === erasurePending.alias.toUpperCase() && /^\d{6}$/.test(totp)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canErase || erased) {
      return
    }
    setErased(true)
    setSuccess(t('erasure.confirm.success', { alias: erasurePending.alias }))
  }

  function handleCancel() {
    setAlias('')
    setTotp('')
    setErased(false)
    setSuccess('')
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
            <span>{t('erasure.col.backups')}</span>
            <span>{t('erasure.col.state')}</span>
          </div>

          {erasureAppRows.map((row) => (
            <div key={row.alias} className="ad-erasure-grid ad-erasure-row">
              <span className="ad-mono ad-cell-strong">{row.alias}</span>
              <div className="ad-stack">
                <span className="ad-cell-strong">
                  <span className="ad-mono ad-study-id">{row.study}</span> · {row.title}
                </span>
                <span className="ad-cell-note">{row.studyNote}</span>
              </div>
              <span className="ad-cell-strong">{row.asked}</span>
              <span className="ad-cell-strong">{row.erase}</span>
              <span className="ad-cell-strong">{row.backups}</span>
              <div>
                <span className="ad-warning-pill">{row.state}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="ad-erasure-layout">
        <div className="ad-erasure-main">
          <section className="ad-pending-card" aria-labelledby="ad-pending-title">
            <div className="ad-pending-head">
              <div className="ad-pending-copy">
                <span className="ad-eyebrow">{t('erasure.manual.label')}</span>
                <h2 id="ad-pending-title" className="ad-pending-title">
                  {t('erasure.manual.titleStart')}
                  <span className="ad-mono">{erasurePending.alias}</span>
                  {t('erasure.manual.titleEnd', { study: erasurePending.study })}
                </h2>
                <span className="ad-cell-note">
                  {erasurePending.studyTitle} · {erasurePending.studyNote}
                </span>
              </div>
              <span className="ad-warning-pill">{t('erasure.manual.status')}</span>
            </div>

            <div className="ad-meta-box">
              <div>
                <span className="ad-meta-key">{t('erasure.manual.requestedBy')}</span>
                <span className="ad-meta-value">{erasurePending.requestedBy}</span>
              </div>
              <div>
                <span className="ad-meta-key">{t('erasure.manual.receivedAt')}</span>
                <span className="ad-meta-value">{erasurePending.receivedAt}</span>
              </div>
              <div>
                <span className="ad-meta-key">{t('erasure.manual.decision')}</span>
                <span className="ad-meta-value">{erasurePending.decidedAt}</span>
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
                {erasureDeleted.map((item) => (
                  <li key={item.title}>
                    <span className="ad-detail-title">{item.title}</span>
                    <span className="ad-detail-note">{item.note}</span>
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
                {erasureKept.map((item) => (
                  <li key={item.title}>
                    <span className="ad-detail-title">{item.title}</span>
                    <span className="ad-detail-note">{item.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="ad-erasure-card">
            <h2 className="ad-card-title">{t('erasure.afterTitle')}</h2>
            <ol className="ad-steps">
              {erasureSteps.map((step) => (
                <li key={step.n}>
                  <span className="ad-step-number">{step.n}</span>
                  <span className="ad-detail-title">{step.title}</span>
                  <span className="ad-detail-note">{step.note}</span>
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
                <label className="ad-label" htmlFor="ad-erasure-alias">
                  {t('erasure.confirm.aliasBefore')}
                  <span className="ad-mono">{erasurePending.alias}</span>
                  {t('erasure.confirm.aliasAfter')}
                </label>
                <input
                  id="ad-erasure-alias"
                  type="text"
                  className="ad-input ad-mono ad-input-alias"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  autoComplete="off"
                  disabled={erased}
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
                  maxLength={6}
                  className="ad-input ad-mono ad-input-totp"
                  value={totp}
                  onChange={(event) => setTotp(event.target.value.replace(/\D/g, ''))}
                  aria-describedby="ad-erasure-totp-hint"
                  autoComplete="one-time-code"
                  disabled={erased}
                />
                <span id="ad-erasure-totp-hint" className="ad-hint">
                  {t('erasure.confirm.totpHint')}
                </span>
              </div>

              {success ? (
                <p className="ad-success" role="status">
                  {success}
                </p>
              ) : null}

              <div className="ad-confirm-actions">
                <button type="submit" className="ad-danger-btn" disabled={!canErase || erased}>
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
            <div className="ad-history-item">
              <CheckIcon width={18} height={18} />
              <div>
                <span className="ad-detail-title">
                  {erasureHistory.alias} · {erasureHistory.study}
                </span>
                <span className="ad-detail-note">{erasureHistory.note}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
