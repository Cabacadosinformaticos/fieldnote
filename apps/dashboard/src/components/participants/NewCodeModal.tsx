import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParticipantsApiError, useCreateStudyCode } from '../../api/participants'
import { errorKey, t } from '../../i18n/participants'
import { CloseIcon } from './icons'
import Switch from './Switch'

function defaultEndDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

export default function NewCodeModal({ studyId }: { studyId: string }) {
  const navigate = useNavigate()
  const createCode = useCreateStudyCode(studyId)
  const [name, setName] = useState('')
  const [end, setEnd] = useState(defaultEndDate)
  const [limitOn, setLimitOn] = useState(false)
  const [limit, setLimit] = useState('10')
  const [hourlyOn, setHourlyOn] = useState(false)
  const [hourly, setHourly] = useState('20')
  const [approvalOn, setApprovalOn] = useState(true)
  const [accountOn, setAccountOn] = useState(false)
  const close = () => navigate(`/estudos/${studyId}/participantes/codigos`)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const submit = () => {
    createCode.mutate(
      {
        name: name.trim(),
        end_date: end,
        max_uses: limitOn ? Number(limit) || null : null,
        max_per_hour: hourlyOn ? Number(hourly) || null : null,
        requires_approval: approvalOn,
        requires_account: accountOn,
      },
      { onSuccess: close },
    )
  }

  const error = createCode.error instanceof ParticipantsApiError ? createCode.error.code : null

  return (
    <div className="pts-modal-backdrop">
      <div
        className="pts-modal pts-code-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pts-code-title"
      >
        <header className="pts-modal-head">
          <div>
            <h2 id="pts-code-title">{t('newCode.title')}</h2>
            <p className="sub">{t('newCode.sub')}</p>
          </div>
          <button type="button" className="pts-icon-button" aria-label={t('action.close')} onClick={close}>
            <CloseIcon />
          </button>
        </header>

        <div className="pts-modal-body">
          <label className="pts-field">
            <span className="pts-label">{t('newCode.name')}</span>
            <input className="pts-input" value={name} onChange={(event) => setName(event.target.value)} />
            <span className="pts-help">{t('newCode.nameHelp')}</span>
          </label>

          <label className="pts-field pts-field-narrow">
            <span className="pts-label">{t('newCode.end')}</span>
            <input
              className="pts-input"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
            <span className="pts-help">{t('newCode.endHelp')}</span>
          </label>

          <div className="pts-switch-list">
            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.limit')}</span>
                <span className="pts-help">{t('newCode.limitHelp')}</span>
                {limitOn ? (
                  <input
                    className="pts-input pts-input-inline"
                    type="number"
                    min={1}
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    aria-label={t('newCode.limit')}
                  />
                ) : null}
              </div>
              <Switch checked={limitOn} onChange={setLimitOn} label={t('newCode.limit')} />
            </div>

            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.hourly')}</span>
                <span className="pts-help">{t('newCode.hourlyHelp')}</span>
                {hourlyOn ? (
                  <input
                    className="pts-input pts-input-inline"
                    type="number"
                    min={1}
                    value={hourly}
                    onChange={(event) => setHourly(event.target.value)}
                    aria-label={t('newCode.hourly')}
                  />
                ) : null}
              </div>
              <Switch checked={hourlyOn} onChange={setHourlyOn} label={t('newCode.hourly')} />
            </div>

            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.approval')}</span>
                <span className="pts-help">{t('newCode.approvalHelp')}</span>
              </div>
              <Switch checked={approvalOn} onChange={setApprovalOn} label={t('newCode.approval')} />
            </div>

            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.account')}</span>
                <span className="pts-help">{t('newCode.accountHelp')}</span>
              </div>
              <Switch checked={accountOn} onChange={setAccountOn} label={t('newCode.account')} />
            </div>
          </div>

          <p className="pts-note">{t('newCode.note')}</p>
          {error ? <p className="pts-error">{t(errorKey(error))}</p> : null}
        </div>

        <footer className="pts-modal-foot">
          <button type="button" className="btn" onClick={close}>
            {t('action.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-p"
            disabled={!name.trim() || !end || createCode.isPending}
            onClick={submit}
          >
            {createCode.isPending ? t('newCode.creating') : t('newCode.create')}
          </button>
        </footer>
      </div>
    </div>
  )
}
