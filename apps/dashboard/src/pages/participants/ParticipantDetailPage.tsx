import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useLocation, useParams } from 'react-router-dom'
import AdherenceMatrix from '../../components/participants/AdherenceMatrix'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  LockIcon,
  ShieldCheckIcon,
  TicketIcon,
  TrashIcon,
  UserMinusIcon,
} from '../../components/participants/icons'
import { EyeIcon } from '../../components/icons'
import {
  getParticipantDetail,
  participantStatusMeta,
  studyName,
} from '../../fake/participants'
import { t } from '../../i18n/participants'

export default function ParticipantDetailPage() {
  const { studyId = 'jardim-da-estrela', participantId = 'P-07' } = useParams<{
    studyId: string
    participantId: string
  }>()
  const location = useLocation()
  const navState = location.state as { withdraw?: boolean; erasure?: boolean } | null
  const [confirming, setConfirming] = useState(Boolean(navState?.withdraw))
  const [withdrawn, setWithdrawn] = useState(false)
  const [identityShown, setIdentityShown] = useState(false)
  const [erasureRequested, setErasureRequested] = useState(Boolean(navState?.erasure))

  const detail = getParticipantDetail(participantId)
  const listPath = `/estudos/${studyId}/participantes`

  if (!detail) {
    return (
      <div className="pts-page">
        <Link className="pts-back" to={listPath}>
          <ArrowLeftIcon />
          {t('action.backToList')}
        </Link>
        <p className="card pts-empty">{t('detail.notFound')}</p>
      </div>
    )
  }

  const statusKey = withdrawn ? 'withdrawn' : detail.participant.status
  const status = participantStatusMeta[statusKey]
  const canWithdraw = detail.participant.status === 'active' && !withdrawn
  const languageKey = detail.participant.language === 'PT' ? 'detail.language.pt' : 'detail.language.en'
  const entriesCount = detail.totals.answered + detail.freeCount
  const entriesText =
    detail.freeCount > 0
      ? t('detail.entriesFreeValue', { count: entriesCount, free: detail.freeCount })
      : t('detail.entriesValue', { count: entriesCount })

  return (
    <div className="pts-page">
      <Link className="pts-back" to={listPath}>
        <ArrowLeftIcon />
        {t('action.backToList')}
      </Link>

      <header className="pts-detail-head">
        <div>
          <div className="pts-detail-title">
            <h1 className="page-title">{detail.participant.id}</h1>
            <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
          </div>
          <p className="sub">
            {t('detail.subtitle', { study: studyName, language: t(languageKey) })}
          </p>
        </div>
        <div className="pts-detail-actions">
          <Link className="btn" to={`${listPath}/adicionar`}>
            <TicketIcon />
            {t('action.newInvite')}
          </Link>
          <button type="button" className="btn" onClick={() => setIdentityShown(!identityShown)}>
            <EyeIcon />
            {identityShown ? t('action.hideIdentity') : t('action.seeIdentity')}
          </button>
          {canWithdraw ? (
            <button type="button" className="btn btn-d" onClick={() => setConfirming(true)}>
              <UserMinusIcon />
              {t('action.withdraw')}
            </button>
          ) : null}
        </div>
      </header>

      {detail.gap ? (
        <div className="pts-gap">
          <span className="pts-gap-icon">
            <AlertTriangleIcon />
          </span>
          <div>
            <strong>{t('detail.gapTitle')}</strong>
            <p>{t('detail.gapBody', { last: detail.gap.last, sent: detail.gap.sentToday })}</p>
          </div>
        </div>
      ) : null}

      {withdrawn ? <p className="pts-inline-note">{t('detail.withdrawnNote')}</p> : null}

      <div className="pts-stat-grid">
        <article className="card pts-stat">
          <span>{t('detail.status')}</span>
          <strong>
            <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
          </strong>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.consent')}</span>
          <strong className="mono">{detail.consentLabel}</strong>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.entries')}</span>
          <strong>{entriesText}</strong>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.adherenceTotal')}</span>
          <strong>{detail.totals.percent} %</strong>
          <small>
            {t('detail.adherenceLabel', {
              answered: detail.totals.answered,
              total: detail.totals.sent,
              percent: detail.totals.percent,
            })}
          </small>
        </article>
      </div>

      <div className="pts-detail-grid">
        <div className="pts-detail-main">
          <AdherenceMatrix detail={detail} />
        </div>

        <aside className="pts-detail-aside">
          <section className="card pts-side-card" aria-labelledby="pts-identity-title">
            <div className="pts-side-head">
              <h2 className="h2" id="pts-identity-title">
                {t('detail.identity')}
              </h2>
              <LockIcon />
            </div>
            {identityShown ? (
              <div className="pts-identity">
                <strong>{detail.identity.name}</strong>
                <span className="mono">{detail.identity.email}</span>
              </div>
            ) : (
              <div className="pts-identity is-masked">
                <strong>{t('detail.identityMasked')}</strong>
                <span className="mono">{t('detail.identityHidden')}</span>
              </div>
            )}
            <p className="pts-help">{t('detail.identityHelp')}</p>
          </section>

          <section className="card pts-side-card" aria-labelledby="pts-hours-title">
            <h2 className="h2" id="pts-hours-title">
              {t('detail.hours')}
            </h2>
            <dl className="pts-hours-list">
              <div>
                <dt>{t('detail.weekdays')}</dt>
                <dd>
                  {detail.weekday.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>{t('detail.weekend')}</dt>
                <dd>
                  <span>{detail.weekend}</span>
                </dd>
              </div>
            </dl>
            <p className="pts-help">{t('detail.hoursHelp')}</p>
          </section>

          <section className="card pts-side-card" aria-labelledby="pts-phone-title">
            <div className="pts-side-head">
              <h2 className="h2" id="pts-phone-title">
                {t('detail.phones')}
              </h2>
              <span className="pill ok">{t('detail.phoneCurrent')}</span>
            </div>
            <p className="pts-phone">Telemóvel Android</p>
            <p className="sub mono">{detail.phoneLast}</p>
            <p className="pts-help">{t('detail.phoneNeverChanged')}</p>
          </section>

          <section className="card pts-side-card" aria-labelledby="pts-erasure-title">
            <h2 className="h2" id="pts-erasure-title">
              {t('action.requestErasure')}
            </h2>
            <p className="pts-help">{t('detail.erasureHelp')}</p>
            <button
              type="button"
              className="btn btn-sm pts-full-button"
              disabled={erasureRequested}
              onClick={() => setErasureRequested(true)}
            >
              <TrashIcon />
              {t('action.requestErasure')}
            </button>
            {erasureRequested ? (
              <p className="pts-success">
                <ShieldCheckIcon />
                {t('detail.erasureRequested')}
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      {confirming ? (
        <div className="pts-modal-backdrop">
          <div
            className="pts-modal pts-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pts-confirm-title"
            aria-describedby="pts-confirm-body"
          >
            <h2 id="pts-confirm-title">
              {t('detail.confirmTitle', { id: detail.participant.id })}
            </h2>
            <p id="pts-confirm-body">
              {t('detail.confirmBody', { id: detail.participant.id })}
            </p>
            <footer className="pts-modal-foot">
              <button
                type="button"
                className="btn btn-d"
                onClick={() => {
                  setWithdrawn(true)
                  setConfirming(false)
                }}
              >
                {t('action.withdraw')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                {t('action.cancel')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
