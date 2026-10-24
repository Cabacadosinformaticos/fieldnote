import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addParticipantDefaults, inviteCodeRounds } from '../../fake/participants'
import { t } from '../../i18n/participants'
import {
  AlertTriangleIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  LockIcon,
  ShieldCheckIcon,
} from './icons'
import QrCode from './QrCode'

type Step = 'data' | 'invite'

export default function AddParticipantModal({ studyId }: { studyId: string }) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('data')
  const [round, setRound] = useState(0)
  const [name, setName] = useState(addParticipantDefaults.name)
  const [email, setEmail] = useState(addParticipantDefaults.email)
  const [language, setLanguage] = useState(addParticipantDefaults.language)
  const [copied, setCopied] = useState(false)

  const participantId = `P-${25 + round}`
  const code = inviteCodeRounds[round % inviteCodeRounds.length]
  const close = () => navigate(`/estudos/${studyId}/participantes`)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <div className="pts-modal-backdrop">
      <div
        className="pts-modal pts-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pts-add-title"
      >
        <header className="pts-modal-head">
          <div>
            <h2 id="pts-add-title">{t('add.title')}</h2>
          </div>
          <button type="button" className="pts-icon-button" aria-label={t('action.close')} onClick={close}>
            <CloseIcon />
          </button>
        </header>

        <ol className="pts-steps">
          <li className={step === 'data' ? 'is-current' : 'is-done'}>
            <span className="pts-step-dot">{step === 'data' ? 1 : <CheckIcon />}</span>
            {t('add.stepData')}
          </li>
          <li className={step === 'invite' ? 'is-current' : ''}>
            <span className="pts-step-dot">2</span>
            {t('add.stepInvite')}
          </li>
        </ol>

        {step === 'data' ? (
          <>
            <div className="pts-modal-body">
              <div className="pts-field-row">
                <label className="pts-field">
                  <span className="pts-label">
                    {t('add.pseudonym')} <em>{t('add.pseudonymAuto')}</em>
                  </span>
                  <input className="pts-input mono" value={participantId} readOnly />
                </label>
              </div>
              <div className="pts-field-row">
                <label className="pts-field">
                  <span className="pts-label">{t('add.name')}</span>
                  <input
                    className="pts-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="pts-field">
                  <span className="pts-label">{t('add.email')}</span>
                  <input
                    className="pts-input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="pts-field pts-field-narrow">
                <span className="pts-label">{t('add.language')}</span>
                <select
                  className="pts-input"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option>{t('add.languagePt')}</option>
                  <option>English</option>
                </select>
              </label>
              <div className="pts-info-box">
                <LockIcon />
                <p>{t('add.privacy')}</p>
              </div>
            </div>
            <footer className="pts-modal-foot">
              <button type="button" className="btn" onClick={close}>
                {t('action.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-p"
                disabled={!name.trim() || !email.trim()}
                onClick={() => setStep('invite')}
              >
                {t('add.generate')}
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="pts-modal-body">
              <div className="pts-invite-grid">
                <div>
                  <span className="pts-eyebrow">{t('add.codeLabel', { id: participantId })}</span>
                  <p className="pts-invite-code mono">{code}</p>
                  <div className="pts-invite-meta">
                    <span className="pill ok">{t('add.singleUse')}</span>
                    <span className="pill ne">
                      {t('add.validUntil', { date: addParticipantDefaults.validUntil })}
                    </span>
                  </div>
                  <div className="pts-warning-box">
                    <AlertTriangleIcon />
                    <div>
                      <strong>{t('add.warningTitle')}</strong>
                      <p>{t('add.warningBody', { id: participantId })}</p>
                    </div>
                  </div>
                  <p className="sub">{t('add.delivery', { id: participantId })}</p>
                </div>
                <div className="pts-invite-qr">
                  <QrCode seed={addParticipantDefaults.qrSeed + round} label={code} />
                  <p className="sub">{t('add.qrNote')}</p>
                  <button type="button" className="btn btn-sm" onClick={copy}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? t('action.copied') : t('action.copyCode')}
                  </button>
                </div>
              </div>
              <div className="pts-code-note">
                <ShieldCheckIcon />
                <p>
                  {t('add.posterLead')}{' '}
                  <Link to={`/estudos/${studyId}/participantes/codigos`}>{t('add.seeCodes')}</Link>
                </p>
              </div>
            </div>
            <footer className="pts-modal-foot">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRound(round + 1)
                  setStep('data')
                  setCopied(false)
                }}
              >
                {t('add.another')}
              </button>
              <button type="button" className="btn btn-p" onClick={close}>
                {t('action.finish')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
