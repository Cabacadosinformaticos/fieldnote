import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { StudyCode } from '../../fake/participants'
import { t } from '../../i18n/participants'
import { CheckIcon, CopyIcon, PrinterIcon } from './icons'
import QrCode from './QrCode'

export default function StudyCodeCard({
  studyId,
  code,
}: {
  studyId: string
  code: StudyCode
}) {
  const [off, setOff] = useState(code.state === 'off')
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard
      .writeText(code.code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <article className={off ? 'card pts-code-card is-off' : 'card pts-code-card'}>
      <header className="pts-code-head">
        <div>
          <h3>{code.name}</h3>
          <div className="pts-code-line">
            <span className="mono">{code.code}</span>
            <button type="button" className="pts-copy-button" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('action.copied') : t('action.copyCode')}
            </button>
          </div>
        </div>
        <span className={off ? 'pill ne' : 'pill ok'}>
          {off ? t('codes.off') : t('codes.active')}
        </span>
      </header>

      <div className="pts-code-body">
        <div className="pts-code-qr">
          <QrCode seed={code.qrSeed} label={code.code} />
        </div>
        <dl className="pts-code-facts">
          <div>
            <dt>{t('codes.uses')}</dt>
            <dd>
              <strong>{off ? t('codes.off') : code.uses}</strong>
              <small>{code.usesNote}</small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.until')}</dt>
            <dd>
              <strong>{code.until}</strong>
              <small>{code.created}</small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.approval')}</dt>
            <dd>
              <strong>{code.approval}</strong>
              <small>{code.approvalNote}</small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.limit')}</dt>
            <dd>
              <strong>{code.limit}</strong>
              <small>{code.limitNote}</small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.hourly')}</dt>
            <dd>
              <strong>{code.hourly}</strong>
            </dd>
          </div>
          <div>
            <dt>{t('codes.account')}</dt>
            <dd>
              <strong>{code.account}</strong>
            </dd>
          </div>
        </dl>
      </div>

      <footer className="pts-code-foot">
        <button
          type="button"
          className={off ? 'btn btn-sm' : 'btn btn-sm btn-d'}
          onClick={() => setOff(!off)}
        >
          {off ? t('action.turnOn') : t('action.turnOff')}
        </button>
        <Link className="btn btn-sm" to={`/estudos/${studyId}/participantes/codigos/novo`}>
          {t('action.newCode')}
        </Link>
        <Link className="btn btn-sm btn-dk" to={`/estudos/${studyId}/participantes/codigos/cartaz`}>
          <PrinterIcon />
          {t('action.seePrintPoster')}
        </Link>
      </footer>
    </article>
  )
}
