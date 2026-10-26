import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  buildAdherenceView,
  entryRouteKey,
  ParticipantsApiError,
  participantStatusMeta,
  useAdherence,
  useCanReadIdentity,
  useIssuePersonalCode,
  useParticipant,
  useParticipantIdentity,
  useRemoveParticipant,
  useStudy,
} from '../../api/participants'
import AdherenceMatrix from '../../components/participants/AdherenceMatrix'
import PersonalCodeModal from '../../components/participants/PersonalCodeModal'
import { formatDate } from '../../components/participants/format'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  LockIcon,
  TicketIcon,
  TrashIcon,
  UserMinusIcon,
} from '../../components/participants/icons'
import { EyeIcon } from '../../components/icons'
import { errorKey, t } from '../../i18n/participants'

export default function ParticipantDetailPage() {
  const { studyId = '', participantId = '' } = useParams<{
    studyId: string
    participantId: string
  }>()
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as { withdraw?: boolean; identity?: boolean } | null
  const [confirming, setConfirming] = useState(Boolean(navState?.withdraw))
  const [identityShown, setIdentityShown] = useState(Boolean(navState?.identity))

  const participant = useParticipant(studyId, participantId)
  const adherence = useAdherence(studyId, participantId)
  const study = useStudy(studyId)
  const canReadIdentity = useCanReadIdentity(studyId)
  const identity = useParticipantIdentity(studyId, participantId, identityShown && canReadIdentity)
  const issueCode = useIssuePersonalCode(studyId)
  const removeParticipant = useRemoveParticipant(studyId)

  const listPath = `/estudos/${studyId}/participantes`
  const back = (
    <Link className="pts-back" to={listPath}>
      <ArrowLeftIcon />
      {t('action.backToList')}
    </Link>
  )

  if (participant.isLoading) {
    return (
      <div className="pts-page">
        {back}
        <div className="card pts-state">
          <p>{t('detail.loading')}</p>
        </div>
      </div>
    )
  }

  if (participant.isError || !participant.data) {
    const code =
      participant.error instanceof ParticipantsApiError ? participant.error.code : null
    return (
      <div className="pts-page">
        {back}
        <div className="card pts-state">
          <p>{code === 'participant_not_found' ? t('detail.notFound') : t('detail.error')}</p>
          <button type="button" className="btn btn-sm" onClick={() => participant.refetch()}>
            {t('detail.retry')}
          </button>
        </div>
      </div>
    )
  }

  const item = participant.data
  const alias = item.alias ?? item.id.slice(0, 8)
  const status = participantStatusMeta[item.status]
  const canWithdraw = item.status === 'active' || item.status === 'pending_approval'
  const view = adherence.data ? buildAdherenceView(adherence.data) : null
  const entriesCount = view ? view.totals.answered + view.freeCount : null
  const removeError =
    removeParticipant.error instanceof ParticipantsApiError ? removeParticipant.error.code : null
  const issueError =
    issueCode.error instanceof ParticipantsApiError ? issueCode.error.code : null

  return (
    <div className="pts-page">
      {back}

      <header className="pts-detail-head">
        <div>
          <div className="pts-detail-title">
            <h1 className="page-title">{alias}</h1>
            <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
          </div>
          <p className="sub">
            {t('detail.subtitleNoLanguage', { study: study.data?.title ?? t('detail.loading') })}
            {' · '}
            {t(entryRouteKey(item.entry_route))}
          </p>
        </div>
        <div className="pts-detail-actions">
          <button
            type="button"
            className="btn"
            disabled={issueCode.isPending}
            onClick={() => issueCode.mutate(participantId)}
          >
            <TicketIcon />
            {issueCode.isPending ? t('personalCode.issuing') : t('action.newInvite')}
          </button>
          {canReadIdentity ? (
            <button type="button" className="btn" onClick={() => setIdentityShown(!identityShown)}>
              <EyeIcon />
              {identityShown ? t('action.hideIdentity') : t('action.seeIdentity')}
            </button>
          ) : null}
          {canWithdraw ? (
            <button type="button" className="btn btn-d" onClick={() => setConfirming(true)}>
              <UserMinusIcon />
              {t('action.withdraw')}
            </button>
          ) : null}
        </div>
      </header>

      {issueError ? <p className="pts-error">{t(errorKey(issueError))}</p> : null}

      {view?.gap ? (
        <div className="pts-gap">
          <span className="pts-gap-icon">
            <AlertTriangleIcon />
          </span>
          <div>
            <strong>{t('detail.gapTitle')}</strong>
            <p>
              {t('detail.gapBody', {
                last: formatDate(view.gap.last),
                sent: view.gap.sentToday,
              })}
            </p>
          </div>
        </div>
      ) : null}

      {item.status === 'removed' ? (
        <p className="pts-inline-note">{t('detail.removedNote')}</p>
      ) : null}
      {item.status === 'withdrawn' ? (
        <p className="pts-inline-note">{t('detail.withdrawnNote')}</p>
      ) : null}

      <div className="pts-stat-grid">
        <article className="card pts-stat">
          <span>{t('detail.status')}</span>
          <strong>
            <span className={`pill ${status.pill}`}>{t(status.labelKey)}</span>
          </strong>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.consent')}</span>
          <strong className="mono">{t('table.dash')}</strong>
          <small>{t('detail.notAvailable')}</small>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.entries')}</span>
          <strong>
            {entriesCount === null
              ? t('table.dash')
              : view && view.freeCount > 0
                ? t('detail.entriesFreeValue', {
                    count: entriesCount,
                    free: view.freeCount,
                  })
                : t('detail.entriesValue', { count: entriesCount })}
          </strong>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.adherenceTotal')}</span>
          <strong>{view ? `${view.totals.percent} %` : t('table.dash')}</strong>
          <small>
            {view
              ? t('detail.adherenceLabel', {
                  answered: view.totals.answered,
                  total: view.totals.sent,
                  percent: view.totals.percent,
                })
              : t('detail.notAvailable')}
          </small>
        </article>
      </div>

      <div className="pts-detail-grid">
        <div className="pts-detail-main">
          {adherence.isLoading ? (
            <div className="card pts-state">
              <p>{t('detail.loading')}</p>
            </div>
          ) : view ? (
            <AdherenceMatrix view={view} />
          ) : (
            <div className="card pts-state">
              <p>{t('detail.adherenceUnavailable')}</p>
            </div>
          )}
        </div>

        <aside className="pts-detail-aside">
          <section className="card pts-side-card" aria-labelledby="pts-identity-title">
            <div className="pts-side-head">
              <h2 className="h2" id="pts-identity-title">
                {t('detail.identity')}
              </h2>
              <LockIcon />
            </div>
            {identityShown && canReadIdentity ? (
              identity.isLoading ? (
                <p className="pts-help">{t('detail.identityLoading')}</p>
              ) : identity.isError ? (
                <p className="pts-help">{t('detail.identityError')}</p>
              ) : identity.data?.name || identity.data?.email ? (
                <div className="pts-identity">
                  <strong>{identity.data?.name ?? t('table.dash')}</strong>
                  <span className="mono">{identity.data?.email ?? t('table.dash')}</span>
                </div>
              ) : (
                <p className="pts-help">{t('detail.noIdentity')}</p>
              )
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
                  <span>{t('table.dash')}</span>
                </dd>
              </div>
              <div>
                <dt>{t('detail.weekend')}</dt>
                <dd>
                  <span>{t('table.dash')}</span>
                </dd>
              </div>
            </dl>
            <p className="pts-help">{t('detail.notAvailable')}</p>
          </section>

          <section className="card pts-side-card" aria-labelledby="pts-phone-title">
            <div className="pts-side-head">
              <h2 className="h2" id="pts-phone-title">
                {t('detail.phones')}
              </h2>
            </div>
            <p className="pts-phone">{t('table.dash')}</p>
            <p className="sub mono">
              {t('detail.enteredAt', { date: formatDate(item.entered_at) })}
            </p>
            <p className="pts-help">{t('detail.notAvailable')}</p>
          </section>

          <section className="card pts-side-card" aria-labelledby="pts-erasure-title">
            <h2 className="h2" id="pts-erasure-title">
              {t('action.requestErasure')}
            </h2>
            <p className="pts-help">{t('detail.erasureUnavailable')}</p>
            <button type="button" className="btn btn-sm pts-full-button" disabled>
              <TrashIcon />
              {t('action.requestErasure')}
            </button>
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
            <h2 id="pts-confirm-title">{t('detail.confirmTitle', { id: alias })}</h2>
            <p id="pts-confirm-body">{t('detail.confirmBody', { id: alias })}</p>
            {removeError ? <p className="pts-error">{t(errorKey(removeError))}</p> : null}
            <footer className="pts-modal-foot">
              <button
                type="button"
                className="btn btn-d"
                disabled={removeParticipant.isPending}
                onClick={() =>
                  removeParticipant.mutate(participantId, {
                    onSuccess: () => navigate(listPath),
                  })
                }
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

      {issueCode.data ? (
        <PersonalCodeModal
          alias={alias}
          code={issueCode.data.code}
          expiresAt={issueCode.data.expires_at}
          onClose={() => issueCode.reset()}
        />
      ) : null}
    </div>
  )
}
