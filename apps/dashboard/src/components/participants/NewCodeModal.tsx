import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { newStudyCodeDefaults } from '../../fake/participants'
import { t } from '../../i18n/participants'
import { CloseIcon } from './icons'
import Switch from './Switch'

export default function NewCodeModal({ studyId }: { studyId: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState(newStudyCodeDefaults.name)
  const [end, setEnd] = useState('2026-10-16')
  const [limitOn, setLimitOn] = useState(newStudyCodeDefaults.limitOn)
  const [hourlyOn, setHourlyOn] = useState(newStudyCodeDefaults.hourlyOn)
  const [approvalOn, setApprovalOn] = useState(newStudyCodeDefaults.approvalOn)
  const [accountOn, setAccountOn] = useState(newStudyCodeDefaults.accountOn)
  const close = () => navigate(`/estudos/${studyId}/participantes/codigos`)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
                    defaultValue={10}
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
                    defaultValue={20}
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
        </div>

        <footer className="pts-modal-foot">
          <button type="button" className="btn" onClick={close}>
            {t('action.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-p"
            disabled={!name.trim() || !end}
            onClick={close}
          >
            {t('newCode.create')}
          </button>
        </footer>
      </div>
    </div>
  )
}
