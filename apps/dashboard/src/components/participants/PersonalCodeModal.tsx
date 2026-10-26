import { useEffect, useState } from 'react'
import { t } from '../../i18n/participants'
import { formatDate } from './format'
import { AlertTriangleIcon, CheckIcon, CloseIcon, CopyIcon } from './icons'
import QrCode from './QrCode'

export default function PersonalCodeModal({
  alias,
  code,
  expiresAt,
  onClose,
}: {
  alias: string
  code: string
  expiresAt: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        aria-labelledby="pts-personal-code-title"
      >
        <header className="pts-modal-head">
          <div>
            <h2 id="pts-personal-code-title">{t('personalCode.title', { id: alias })}</h2>
            <p className="sub">{t('personalCode.sub')}</p>
          </div>
          <button
            type="button"
            className="pts-icon-button"
            aria-label={t('action.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="pts-modal-body">
          <div className="pts-invite-grid">
            <div>
              <span className="pts-eyebrow">{t('personalCode.label', { id: alias })}</span>
              <p className="pts-invite-code mono">{code}</p>
              <div className="pts-invite-meta">
                <span className="pill ok">{t('add.singleUse')}</span>
                <span className="pill ne">
                  {t('add.validUntil', { date: formatDate(expiresAt) })}
                </span>
              </div>
              <div className="pts-warning-box">
                <AlertTriangleIcon />
                <div>
                  <strong>{t('personalCode.warningTitle')}</strong>
                  <p>{t('personalCode.warningBody')}</p>
                </div>
              </div>
              <p className="sub">{t('personalCode.delivery', { id: alias })}</p>
            </div>
            <div className="pts-invite-qr">
              <QrCode value={code} label={code} />
              <p className="sub">{t('personalCode.qrNote')}</p>
              <button type="button" className="btn btn-sm" onClick={copy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t('action.copied') : t('action.copyCode')}
              </button>
            </div>
          </div>
        </div>

        <footer className="pts-modal-foot">
          <button type="button" className="btn btn-p" onClick={onClose}>
            {t('action.finish')}
          </button>
        </footer>
      </div>
    </div>
  )
}
