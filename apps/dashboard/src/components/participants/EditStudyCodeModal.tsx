import { useEffect, useState } from 'react'
import {
  ParticipantsApiError,
  useUpdateStudyCode,
  type StudyCodeOut,
} from '../../api/participants'
import { errorKey, t } from '../../i18n/participants'
import { CloseIcon } from './icons'
import Switch from './Switch'

export default function EditStudyCodeModal({
  studyId,
  code,
  onClose,
}: {
  studyId: string
  code: StudyCodeOut
  onClose: () => void
}) {
  const update = useUpdateStudyCode(studyId)
  const [name, setName] = useState(code.name)
  const [end, setEnd] = useState(code.expires_at.slice(0, 10))
  const [limitOn, setLimitOn] = useState(code.max_uses !== null)
  const [limit, setLimit] = useState(String(code.max_uses ?? 10))
  const [hourlyOn, setHourlyOn] = useState(code.max_per_hour !== null)
  const [hourly, setHourly] = useState(String(code.max_per_hour ?? 20))
  const [approvalOn, setApprovalOn] = useState(code.requires_approval)
  const [accountOn, setAccountOn] = useState(code.requires_account)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    update.mutate(
      {
        codeId: code.id,
        payload: {
          name: name.trim(),
          end_date: end,
          max_uses: limitOn ? Number(limit) || null : null,
          max_per_hour: hourlyOn ? Number(hourly) || null : null,
          requires_approval: approvalOn,
          requires_account: accountOn,
        },
      },
      { onSuccess: onClose },
    )
  }

  const error = update.error instanceof ParticipantsApiError ? update.error.code : null

  return (
    <div className="pts-modal-backdrop">
      <div
        className="pts-modal pts-code-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pts-edit-code-title"
      >
        <header className="pts-modal-head">
          <div>
            <h2 id="pts-edit-code-title">{t('codes.editTitle')}</h2>
            <p className="sub">{t('codes.editSub')}</p>
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
          <label className="pts-field">
            <span className="pts-label">{t('newCode.name')}</span>
            <input className="pts-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="pts-field pts-field-narrow">
            <span className="pts-label">{t('newCode.end')}</span>
            <input
              className="pts-input"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>

          <div className="pts-switch-list">
            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.limit')}</span>
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
              </div>
              <Switch checked={approvalOn} onChange={setApprovalOn} label={t('newCode.approval')} />
            </div>

            <div className="pts-switch-row">
              <div>
                <span className="pts-label">{t('newCode.account')}</span>
              </div>
              <Switch checked={accountOn} onChange={setAccountOn} label={t('newCode.account')} />
            </div>
          </div>

          {error ? <p className="pts-error">{t(errorKey(error))}</p> : null}
        </div>

        <footer className="pts-modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            {t('action.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-p"
            disabled={!name.trim() || !end || update.isPending}
            onClick={submit}
          >
            {update.isPending ? t('codes.saving') : t('codes.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}
