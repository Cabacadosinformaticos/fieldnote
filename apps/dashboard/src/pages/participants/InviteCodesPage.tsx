import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
import ParticipantsTabs from '../../components/participants/ParticipantsTabs'
import StudyCodeCard from '../../components/participants/StudyCodeCard'
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
  ShieldCheckIcon,
  TicketIcon,
} from '../../components/participants/icons'
import { studyCodes, waitingCode, waitingEntries } from '../../fake/participants'
import { t } from '../../i18n/participants'

type Decision = 'approved' | 'declined'

export default function InviteCodesPage() {
  const { studyId = 'jardim-da-estrela' } = useParams<{ studyId: string }>()
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const pending = waitingEntries.filter((entry) => !decisions[entry.id]).length
  const base = `/estudos/${studyId}/participantes`

  const decide = (id: string, decision: Decision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

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

      <ParticipantsTabs studyId={studyId} waitingCount={pending} />

      <section className="card pts-waiting-card" aria-labelledby="pts-waiting-title">
        <div className="pts-waiting-head">
          <div>
            <h2 className="h2" id="pts-waiting-title">
              {t('codes.waitingTitle', { count: pending })}
            </h2>
            <p className="sub">{t('codes.waitingSub', { code: waitingCode })}</p>
          </div>
          <span className="pill wa">{t('codes.waitingPill', { count: pending })}</span>
        </div>

        {waitingEntries.length > 0 ? (
          <ul className="pts-waiting-list">
            {waitingEntries.map((entry, index) => {
              const decision = decisions[entry.id]
              return (
                <li key={entry.id}>
                  <span className="pts-waiting-number">{index + 1}</span>
                  <div className="pts-waiting-who">
                    <strong>{entry.label}</strong>
                    <span>
                      {t('codes.enteredPrefix', { when: entry.when })} <code>{waitingCode}</code>
                    </span>
                  </div>
                  <div className="pts-waiting-actions">
                    {decision === 'approved' ? (
                      <span className="pill ok">
                        <CheckIcon /> {t('codes.approved')}
                      </span>
                    ) : decision === 'declined' ? (
                      <span className="pill ne">
                        <CloseIcon /> {t('codes.declined')}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-d"
                          onClick={() => decide(entry.id, 'declined')}
                        >
                          {t('action.decline')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-p"
                          onClick={() => decide(entry.id, 'approved')}
                        >
                          {t('action.approve')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="pts-empty">{t('codes.waitingEmpty')}</p>
        )}

        <p className="pts-help pts-waiting-privacy">
          <ShieldCheckIcon />
          {t('codes.waitingPrivacy')}
        </p>

        <div className="pts-deadline">
          <CalendarIcon />
          <div>
            <strong>{t('codes.waitingDeadlineTitle')}</strong>
            <p>{t('codes.waitingDeadlineBody')}</p>
          </div>
        </div>
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
        <div className="pts-code-grid">
          {studyCodes.map((code) => (
            <StudyCodeCard key={code.id} studyId={studyId} code={code} />
          ))}
        </div>
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
    </div>
  )
}
