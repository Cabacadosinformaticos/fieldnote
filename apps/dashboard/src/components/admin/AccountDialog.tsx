import { useState, type FormEvent } from 'react'
import type { UserRole } from '../../api/admin'
import { t } from '../../i18n/admin'
import { CloseIcon, MailIcon } from './icons'

export type AccountDraft = { email: string; name: string | null; role: UserRole }

type Props = {
  mode: 'create' | 'edit'
  account?: { email: string; name?: string | null; role: UserRole }
  submitting?: boolean
  error?: string
  onClose: () => void
  onSubmit: (draft: AccountDraft) => void
}

export default function AccountDialog({
  mode,
  account,
  submitting = false,
  error = '',
  onClose,
  onSubmit,
}: Props) {
  const [email, setEmail] = useState(account?.email ?? '')
  const [name, setName] = useState(account?.name ?? '')
  const [role, setRole] = useState<UserRole>(account?.role ?? 'researcher')

  const isCreate = mode === 'create'
  const canSubmit = email.trim().length > 0 && !submitting

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    const trimmedName = name.trim()
    onSubmit({ email: email.trim(), name: trimmedName || null, role })
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
            disabled={submitting}
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
              maxLength={200}
              autoFocus={isCreate}
              disabled={submitting}
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
              readOnly={!isCreate}
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
                disabled={submitting}
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
                disabled={submitting}
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
                {t('acct.dialog.passwordNoteBefore')}
                <strong>{t('acct.dialog.passwordNoteStrong')}</strong>
                {t('acct.dialog.passwordNoteAfter')}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="ad-form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="ad-dialog-foot">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
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
