import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ParticipantsApiError,
  useAddParticipant,
  useParticipants,
} from '../../api/participants'
import { errorKey, t } from '../../i18n/participants'
import { formatDate, nextAlias } from './format'
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
  const participants = useParticipants(studyId)
  const addParticipant = useAddParticipant(studyId)
  const [step, setStep] = useState<Step>('data')
  const [aliasOverride, setAliasOverride] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)

  const suggestedAlias = nextAlias((participants.data ?? []).map((item) => item.alias))
  const alias = aliasOverride ?? suggestedAlias

  const created = addParticipant.data
  const participantLabel = created?.alias ?? alias
  const invite = created?.invite_code
  const close = () => navigate(`/estudos/${studyId}/participantes`)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const copy = () => {
    if (!invite || !navigator.clipboard) return
    navigator.clipboard
      .writeText(invite.code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  const submit = () => {
    addParticipant.mutate(
      {
        alias: alias.trim(),
        name: name.trim() ? name.trim() : null,
        email: email.trim() ? email.trim() : null,
      },
      { onSuccess: () => setStep('invite') },
    )
  }

  const reset = () => {
    addParticipant.reset()
    setStep('data')
    setAliasOverride(null)
    setName('')
    setEmail('')
    setCopied(false)
  }

  const error =
    addParticipant.error instanceof ParticipantsApiError ? addParticipant.error.code : null

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
                  <input
                    className="pts-input mono"
                    value={alias}
                    onChange={(event) => setAliasOverride(event.target.value)}
                    autoComplete="off"
                  />
                  <span className="pts-help">{t('add.aliasHelp')}</span>
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
              <div className="pts-info-box">
                <LockIcon />
                <p>{t('add.privacy')}</p>
              </div>
              {error ? <p className="pts-error">{t(errorKey(error))}</p> : null}
            </div>
            <footer className="pts-modal-foot">
              <button type="button" className="btn" onClick={close}>
                {t('action.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-p"
                disabled={!alias.trim() || addParticipant.isPending}
                onClick={submit}
              >
                {addParticipant.isPending ? t('add.generating') : t('add.generate')}
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="pts-modal-body">
              <div className="pts-invite-grid">
                <div>
                  <span className="pts-eyebrow">
                    {t('add.codeLabel', { id: participantLabel })}
                  </span>
                  <p className="pts-invite-code mono">{invite?.code}</p>
                  <div className="pts-invite-meta">
                    <span className="pill ok">{t('add.singleUse')}</span>
                    <span className="pill ne">
                      {t('add.validUntil', { date: formatDate(invite?.expires_at) })}
                    </span>
                  </div>
                  <div className="pts-warning-box">
                    <AlertTriangleIcon />
                    <div>
                      <strong>{t('add.warningTitle')}</strong>
                      <p>{t('add.warningBody', { id: participantLabel })}</p>
                    </div>
                  </div>
                  <p className="sub">{t('add.delivery', { id: participantLabel })}</p>
                </div>
                <div className="pts-invite-qr">
                  <QrCode value={invite?.code ?? ''} label={invite?.code} />
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
              <button type="button" className="btn" onClick={reset}>
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
