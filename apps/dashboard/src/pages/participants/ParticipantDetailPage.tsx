import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEntries, useStudyLiveRefresh, type EntryType } from '../../api/entries'
import {
  buildAdherenceView,
  entryRouteKey,
  participantLabel,
  ParticipantsApiError,
  participantsKeys,
  participantDisplayState,
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
import {
  availabilityGroups,
  formatDate,
  formatDateTime,
  plural,
} from '../../components/participants/format'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  LockIcon,
  TicketIcon,
  UserMinusIcon,
} from '../../components/participants/icons'
import { EyeIcon } from '../../components/icons'
import { errorKey, t, type ParticipantsKey } from '../../i18n/participants'

const entryKindKeys: Record<EntryType, ParticipantsKey> = {
  photo: 'entryKind.photo',
  text: 'entryKind.text',
  audio: 'entryKind.audio',
  video: 'entryKind.video',
  scale: 'entryKind.scale',
  choice: 'entryKind.choice',
}

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
  const recentEntries = useEntries(studyId, { participantId, limit: 5 })
  useStudyLiveRefresh(studyId, [participantsKeys.root])

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
  const alias = participantLabel(item)
  const status = participantStatusMeta[participantDisplayState(item)]
  const canWithdraw = item.status === 'active' || item.status === 'pending_approval'
  const view = adherence.data ? buildAdherenceView(adherence.data) : null
  const entriesCount = view ? view.totals.answered + view.freeCount : null
  const entriesLabel =
    entriesCount === null
      ? t('table.dash')
      : plural(entriesCount, t('detail.entryOne'), t('detail.entriesValue', { count: entriesCount }))
  const freeLabel = view
    ? plural(view.freeCount, t('detail.freeOne'), t('detail.freeMany', { count: view.freeCount }))
    : ''
  const hours = availabilityGroups(item.availability_summary)
  const recent = recentEntries.data?.items ?? []
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
            <div className="pts-withdraw-block">
              <button
                type="button"
                className="btn btn-d"
                aria-describedby="pts-withdraw-help"
                onClick={() => setConfirming(true)}
              >
                <UserMinusIcon />
                {t('action.withdraw')}
              </button>
              <p className="pts-help" id="pts-withdraw-help">
                {t('detail.withdrawHelp', { id: alias })}
              </p>
            </div>
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
          <strong className="mono">{formatDateTime(item.consented_at)}</strong>
          <small>
            {item.consented_at ? t('detail.consentAt') : t('detail.consentMissing')}
          </small>
        </article>
        <article className="card pts-stat">
          <span>{t('detail.entries')}</span>
          <strong>
            {view && view.freeCount > 0
              ? t('detail.entriesFreeValue', { entries: entriesLabel, free: freeLabel })
              : entriesLabel}
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
              : t('detail.adherenceMissing')}
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

          {recentEntries.isError ? null : (
            <section className="card pts-recent-card" aria-labelledby="pts-recent-title">
              <div className="pts-section-head">
                <h2 className="h2" id="pts-recent-title">
                  {t('detail.recentTitle')}
                </h2>
                <Link className="btn btn-sm" to={`/estudos/${studyId}/registos`}>
                  {t('detail.recentAll')}
                </Link>
              </div>
              {recentEntries.isLoading ? (
                <p className="pts-help">{t('detail.recentLoading')}</p>
              ) : recent.length === 0 ? (
                <p className="pts-help">{t('detail.recentEmpty')}</p>
              ) : (
                <ul className="pts-recent-list">
                  {recent.map((entry) => (
                    <li key={entry.id}>
                      <div className="pts-recent-body">
                        <strong>{entry.activity_title ?? t('detail.recentFree')}</strong>
                        <small>
                          {t('detail.recentMeta', {
                            type: t(entryKindKeys[entry.entry_type]),
                            date: formatDateTime(entry.recorded_at),
                          })}
                        </small>
                      </div>
                      <Link
                        className="btn btn-sm"
                        to={`/estudos/${studyId}/registos?registo=${entry.id}`}
                      >
                        {t('detail.recentView')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
              {hours.anyTime ? (
                <div>
                  <dt>{t('detail.anyDay')}</dt>
                  <dd>
                    <span>{t('table.anyTime')}</span>
                  </dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>{t('detail.weekdays')}</dt>
                    <dd>
                      {hours.weekdays.length > 0 ? (
                        hours.weekdays.map((range) => <span key={range}>{range}</span>)
                      ) : (
                        <span>{t('table.dash')}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('detail.weekend')}</dt>
                    <dd>
                      {hours.weekend.length > 0 ? (
                        hours.weekend.map((range) => <span key={range}>{range}</span>)
                      ) : (
                        <span>{t('table.dash')}</span>
                      )}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="pts-help">{t('detail.hoursHelp')}</p>
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
