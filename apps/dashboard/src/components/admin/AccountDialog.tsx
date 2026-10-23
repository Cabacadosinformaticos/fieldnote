import { useState, type FormEvent } from 'react'
import type { AccountRole, AdminAccount } from '../../fake/admin'
import { t } from '../../i18n/admin'
import { CloseIcon, MailIcon } from './icons'

export type AccountDraft = { name: string; email: string; role: AccountRole }

type Props = {
  mode: 'create' | 'edit'
  account?: AdminAccount
  onClose: () => void
  onSubmit: (draft: AccountDraft) => void
}

export default function AccountDialog({ mode, account, onClose, onSubmit }: Props) {
  const [name, setName] = useState(account?.name ?? '')
  const [email, setEmail] = useState(account?.email ?? '')
  const [role, setRole] = useState<AccountRole>(account?.role ?? 'researcher')

  const isCreate = mode === 'create'
  const canSubmit = name.trim().length > 0 && email.trim().length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    onSubmit({ name: name.trim(), email: email.trim(), role })
  }

  return (
    <div className="ad-overlay">
      <form
        className="ad-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-dialog-title"
        onSubmit={handleSubmit}
      >
        <div className="ad-dialog-head">
          <div className="ad-dialog-heading">
            <h2 id="ad-dialog-title" className="ad-dialog-title">
              {isCreate ? t('acct.dialog.createTitle') : t('acct.dialog.editTitle')}
            </h2>
            <p className="ad-dialog-sub">
              {isCreate ? t('acct.dialog.createSubtitle') : t('acct.dialog.editSubtitle')}
            </p>
          </div>
          <button
            type="button"
            className="ad-dialog-close"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="ad-dialog-body">
          <div className="ad-field">
            <label htmlFor="ad-account-name" className="ad-label">
              {t('acct.dialog.name')}
            </label>
            <input
              id="ad-account-name"
              type="text"
              className="ad-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="ad-field">
            <label htmlFor="ad-account-email" className="ad-label">
              {t('common.email')}
            </label>
            <input
              id="ad-account-email"
              type="email"
              className="ad-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby="ad-account-email-hint"
              required
            />
            <span id="ad-account-email-hint" className="ad-hint">
              {t('acct.dialog.emailHint')}
            </span>
          </div>

          <fieldset className="ad-fieldset">
            <legend className="ad-label">{t('acct.dialog.role')}</legend>
            <label className={role === 'researcher' ? 'ad-role is-selected' : 'ad-role'}>
              <input
                type="radio"
                name="ad-account-role"
                checked={role === 'researcher'}
                onChange={() => setRole('researcher')}
              />
              <span className="ad-role-text">
                <span className="ad-role-title">{t('acct.dialog.researcherTitle')}</span>
                <span className="ad-role-desc">{t('acct.dialog.researcherText')}</span>
              </span>
            </label>
            <label className={role === 'admin' ? 'ad-role is-selected' : 'ad-role'}>
              <input
                type="radio"
                name="ad-account-role"
                checked={role === 'admin'}
                onChange={() => setRole('admin')}
              />
              <span className="ad-role-text">
                <span className="ad-role-title">{t('acct.dialog.adminTitle')}</span>
                <span className="ad-role-desc">{t('acct.dialog.adminText')}</span>
              </span>
            </label>
          </fieldset>

          {isCreate ? (
            <div className="ad-note-box">
              <MailIcon width={20} height={20} />
              <p>
                {t('acct.dialog.linkNoteBefore')}
                <strong>{t('acct.dialog.linkNoteStrong')}</strong>
                {t('acct.dialog.linkNoteAfter')}
              </p>
            </div>
          ) : null}
        </div>

        <div className="ad-dialog-foot">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-p" disabled={!canSubmit}>
            {isCreate ? t('acct.dialog.createSubmit') : t('acct.dialog.saveSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
