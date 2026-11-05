import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
import {
  ParticipantsApiError,
  participantsKeys,
  useApprovals,
  useApproveEntry,
  useDeclineEntry,
  useStudyCodes,
  type StudyCodeOut,
} from '../../api/participants'
import { useStudyLiveRefresh } from '../../api/entries'
import EditStudyCodeModal from '../../components/participants/EditStudyCodeModal'
import ParticipantsTabs from '../../components/participants/ParticipantsTabs'
import StudyCodeCard from '../../components/participants/StudyCodeCard'
import { formatDate, formatDateTime } from '../../components/participants/format'
import {
  CalendarIcon,
  CheckIcon,
  PlusIcon,
  ShieldCheckIcon,
  TicketIcon,
} from '../../components/participants/icons'
import { errorKey, t } from '../../i18n/participants'

export default function InviteCodesPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const approvals = useApprovals(studyId)
  const codes = useStudyCodes(studyId)
  const approve = useApproveEntry(studyId)
  const decline = useDeclineEntry(studyId)
  const [editing, setEditing] = useState<StudyCodeOut | null>(null)
  useStudyLiveRefresh(studyId, [participantsKeys.root])

  const waiting = approvals.data ?? []
  const base = `/estudos/${studyId}/participantes`

  const actionError =
    approve.error instanceof ParticipantsApiError
      ? approve.error.code
      : decline.error instanceof ParticipantsApiError
        ? decline.error.code
        : null

  const waitingCode = waiting.find((entry) => entry.code)?.code ?? null
  const matchingCode = waitingCode
    ? codes.data?.find((code) => code.code === waitingCode)
    : undefined

  return (
    <div className="pts-page">
      <header className="pts-page-head">
        <div>
          <h1 className="page-title">{t('tabs.codes')}</h1>
          <p className="sub pts-lead">{t('codes.subtitle')}</p>
        </div>
        <Link className="btn btn-p" to={`${base}/codigos/novo`}>
          <PlusIcon />
          {t('action.newPosterCode')}
        </Link>
      </header>

      <ParticipantsTabs studyId={studyId} waitingCount={waiting.length} />

      <section className="card pts-waiting-card" aria-labelledby="pts-waiting-title">
        <div className="pts-waiting-head">
          <div>
            <h2 className="h2" id="pts-waiting-title">
              {t('codes.waitingTitle', { count: waiting.length })}
            </h2>
            <p className="sub">
              {waitingCode
                ? t('codes.waitingSub', { code: waitingCode })
                : t('codes.waitingSubCount')}
            </p>
          </div>
          <span className="pill wa">{t('codes.waitingPill', { count: waiting.length })}</span>
        </div>

        {approvals.isLoading ? (
          <p className="pts-empty">{t('codes.loading')}</p>
        ) : approvals.isError ? (
          <div className="pts-state-inline">
            <p>{t('codes.error')}</p>
            <button type="button" className="btn btn-sm" onClick={() => approvals.refetch()}>
              {t('codes.retry')}
            </button>
          </div>
        ) : waiting.length > 0 ? (
          <ul className="pts-waiting-list">
            {waiting.map((entry) => {
              const approving = approve.isPending && approve.variables === entry.participant_id
              const declining = decline.isPending && decline.variables === entry.participant_id
              return (
                <li key={entry.participant_id}>
                  <span className="pts-waiting-number">{entry.order}</span>
                  <div className="pts-waiting-who">
                    <strong>{t('codes.waitingPerson', { order: entry.order })}</strong>
                    <span>
                      {t('codes.enteredAt', { when: formatDateTime(entry.entered_at) })}{' '}
                      {entry.code ? t('codes.enteredWith', { code: entry.code }) : null}
                    </span>
                  </div>
                  <div className="pts-waiting-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-d"
                      disabled={declining || approving}
                      onClick={() => decline.mutate(entry.participant_id)}
                    >
                      {t('action.decline')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-p"
                      disabled={declining || approving}
                      onClick={() => approve.mutate(entry.participant_id)}
                    >
                      <CheckIcon /> {t('action.approve')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="pts-empty">{t('codes.waitingEmpty')}</p>
        )}

        {actionError ? <p className="pts-error">{t(errorKey(actionError))}</p> : null}

        <p className="pts-help pts-waiting-privacy">
          <ShieldCheckIcon />
          {t('codes.waitingPrivacy')}
        </p>

        {waiting.length > 0 ? (
          <div className="pts-deadline">
            <CalendarIcon />
            <div>
              <strong>
                {matchingCode
                  ? t('codes.waitingDeadlineTitleCode', {
                      date: formatDate(matchingCode.expires_at),
                    })
                  : t('codes.waitingDeadlineTitle')}
              </strong>
              <p>{t('codes.waitingDeadlineBodyPlain')}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="pts-codes-section" aria-labelledby="pts-codes-title">
        <div className="pts-section-head">
          <div>
            <h2 className="h2" id="pts-codes-title">
              {t('codes.title')}
            </h2>
            <p className="sub">{t('codes.sub')}</p>
          </div>
        </div>

        {codes.isLoading ? (
          <div className="card pts-state">
            <p>{t('codes.loading')}</p>
          </div>
        ) : codes.isError ? (
          <div className="card pts-state">
            <p>{t('codes.error')}</p>
            <button type="button" className="btn btn-sm" onClick={() => codes.refetch()}>
              {t('codes.retry')}
            </button>
          </div>
        ) : codes.data && codes.data.length > 0 ? (
          <div className="pts-code-grid">
            {codes.data.map((code) => (
              <StudyCodeCard key={code.id} studyId={studyId} code={code} onEdit={setEditing} />
            ))}
          </div>
        ) : (
          <div className="card pts-state">
            <p>{t('codes.empty')}</p>
          </div>
        )}
      </section>

      <div className="pts-info-grid">
        <section className="card pts-info-card" aria-labelledby="pts-two-types">
          <div className="pts-info-head">
            <TicketIcon />
            <h2 className="h2" id="pts-two-types">
              {t('codes.twoTypes')}
            </h2>
          </div>
          <dl className="pts-type-list">
            <div>
              <dt>{t('codes.personal')}</dt>
              <dd className="mono">{t('codes.personalExample')}</dd>
              <dd>
                <ul>
                  <li>{t('codes.personalBullet1')}</li>
                  <li>{t('codes.personalBullet2')}</li>
                  <li>{t('codes.personalBullet3')}</li>
                </ul>
              </dd>
            </div>
            <div>
              <dt>{t('codes.studyCode')}</dt>
              <dd>
                <ul>
                  <li>{t('codes.studyBullet1')}</li>
                  <li>{t('codes.studyBullet2')}</li>
                  <li>{t('codes.studyBullet3')}</li>
                </ul>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card pts-info-card" aria-labelledby="pts-protections">
          <div className="pts-info-head">
            <ShieldCheckIcon />
            <h2 className="h2" id="pts-protections">
              {t('codes.protections')}
            </h2>
          </div>
          <ul className="pts-check-list">
            <li>{t('codes.protection1')}</li>
            <li>{t('codes.protection2')}</li>
            <li>{t('codes.protection3')}</li>
            <li>{t('codes.protection4')}</li>
            <li>{t('codes.protection5')}</li>
            <li>{t('codes.protection6')}</li>
            <li>{t('codes.protection7')}</li>
          </ul>
        </section>
      </div>

      {editing ? (
        <EditStudyCodeModal
          studyId={studyId}
          code={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
