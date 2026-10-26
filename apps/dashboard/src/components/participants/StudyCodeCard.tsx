import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ParticipantsApiError,
  useRegenerateStudyCode,
  useUpdateStudyCode,
  type StudyCodeOut,
} from '../../api/participants'
import { errorKey, t, type ParticipantsKey } from '../../i18n/participants'
import { formatDate, formatDateTime } from './format'
import { CheckIcon, CopyIcon, PrinterIcon } from './icons'
import QrCode from './QrCode'

function stateLabel(code: StudyCodeOut): { key: ParticipantsKey; tone: string; off: boolean } {
  if (!code.active || code.state === 'off') {
    return { key: 'codes.off', tone: 'ne', off: true }
  }
  if (code.state === 'ended') {
    return { key: 'codes.stateEnded', tone: 'ne', off: true }
  }
  if (code.state === 'limit_reached') {
    return { key: 'codes.stateLimit', tone: 'ne', off: true }
  }
  return { key: 'codes.active', tone: 'ok', off: false }
}

function usesLabel(code: StudyCodeOut): ParticipantsKey {
  if (code.uses === 1) return 'codes.usesOne'
  if (code.uses === 0) return 'codes.usesNone'
  return 'codes.usesCount'
}

export default function StudyCodeCard({
  studyId,
  code,
  onEdit,
}: {
  studyId: string
  code: StudyCodeOut
  onEdit: (code: StudyCodeOut) => void
}) {
  const [copied, setCopied] = useState(false)
  const update = useUpdateStudyCode(studyId)
  const regenerate = useRegenerateStudyCode(studyId)
  const state = stateLabel(code)
  const error =
    update.error instanceof ParticipantsApiError
      ? update.error.code
      : regenerate.error instanceof ParticipantsApiError
        ? regenerate.error.code
        : null

  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard
      .writeText(code.code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  const toggle = () => {
    update.mutate({
      codeId: code.id,
      payload: { active: !code.active },
    })
  }

  const regenerateCode = () => {
    if (!window.confirm(t('codes.regenerateConfirm'))) return
    regenerate.mutate(code.id)
  }

  return (
    <article className={state.off ? 'card pts-code-card is-off' : 'card pts-code-card'}>
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
        <span className={`pill ${state.tone}`}>{t(state.key)}</span>
      </header>

      <div className="pts-code-body">
        <div className="pts-code-qr">
          <QrCode value={code.code} label={code.code} />
        </div>
        <dl className="pts-code-facts">
          <div>
            <dt>{t('codes.uses')}</dt>
            <dd>
              <strong>
                {t(usesLabel(code), { count: code.uses })}
              </strong>
              <small>
                {t('codes.usesCounts', {
                  approved: code.approved_count,
                  declined: code.declined_count,
                  waiting: code.waiting_count,
                })}
              </small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.until')}</dt>
            <dd>
              <strong>{formatDate(code.expires_at)}</strong>
              <small>{t('codes.createdAt', { date: formatDateTime(code.created_at) })}</small>
            </dd>
          </div>
          <div>
            <dt>{t('codes.approval')}</dt>
            <dd>
              <strong>
                {code.requires_approval ? t('codes.approvalOn') : t('codes.approvalOff')}
              </strong>
            </dd>
          </div>
          <div>
            <dt>{t('codes.limit')}</dt>
            <dd>
              <strong>
                {code.max_uses === null
                  ? t('codes.noMaximum')
                  : t('codes.limitCount', { count: code.max_uses })}
              </strong>
            </dd>
          </div>
          <div>
            <dt>{t('codes.hourly')}</dt>
            <dd>
              <strong>
                {code.max_per_hour === null
                  ? t('codes.noMaximum')
                  : t('codes.hourlyCount', { count: code.max_per_hour })}
              </strong>
            </dd>
          </div>
          <div>
            <dt>{t('codes.account')}</dt>
            <dd>
              <strong>
                {code.requires_account ? t('codes.accountYes') : t('codes.accountNo')}
              </strong>
            </dd>
          </div>
        </dl>
      </div>

      {error ? <p className="pts-error">{t(errorKey(error))}</p> : null}

      <footer className="pts-code-foot">
        <button
          type="button"
          className={code.active ? 'btn btn-sm btn-d' : 'btn btn-sm'}
          disabled={update.isPending}
          onClick={toggle}
        >
          {code.active ? t('action.turnOff') : t('action.turnOn')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onEdit(code)}>
          {t('codes.edit')}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={regenerate.isPending}
          onClick={regenerateCode}
        >
          {t('action.newCode')}
        </button>
        <Link
          className="btn btn-sm btn-dk"
          to={`/estudos/${studyId}/participantes/codigos/cartaz?code=${code.id}`}
        >
          <PrinterIcon />
          {t('action.seePrintPoster')}
        </Link>
      </footer>
    </article>
  )
}
