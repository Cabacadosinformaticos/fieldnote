import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthError, changePassword } from '../../api/auth'
import { EyeIcon } from '../../components/icons'
import { t } from '../../i18n'
import '../../styles/activities.css'

const MIN_LENGTH = 12

function errorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid_credentials':
        return t('password.currentWrong')
      case 'account_locked':
        return t('password.locked')
      case 'password_too_short':
        return t('password.tooShort')
      case 'password_too_long':
        return t('password.tooLong')
      case 'password_is_email':
        return t('password.isEmail')
      case 'password_unchanged':
        return t('password.unchanged')
      default:
        break
    }
  }
  return t('password.error')
}

export default function ChangePasswordPage() {
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (newPassword.length < MIN_LENGTH) {
      setError(t('password.tooShort'))
      return
    }
    if (newPassword !== repeat) {
      setError(t('password.mismatch'))
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      navigate('/estudos', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">{t('password.title')}</h1>
          <p className="ac-subtitle">{t('password.subtitle')}</p>
        </div>
      </header>

      <form
        className="card ac-form-narrow"
        aria-label={t('password.title')}
        onSubmit={handleSubmit}
      >
        <div className="ac-field">
          <label className="ac-label" htmlFor="current-password">
            {t('password.current')}
          </label>
          <div className="password-wrap">
            <input
              id="current-password"
              name="current-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="ac-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={t('password.show')}
              onClick={() => setShowPassword((current) => !current)}
            >
              <EyeIcon />
            </button>
          </div>
        </div>

        <div className="ac-field">
          <label className="ac-label" htmlFor="new-password">
            {t('password.new')}
          </label>
          <div className="password-wrap">
            <input
              id="new-password"
              name="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              className="ac-input"
              style={{ paddingRight: 52 }}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={t('password.show')}
              onClick={() => setShowPassword((current) => !current)}
            >
              <EyeIcon />
            </button>
          </div>
          <span className="ac-sub">{t('password.hint')}</span>
        </div>

        <div className="ac-field">
          <label className="ac-label" htmlFor="repeat-password">
            {t('password.repeat')}
          </label>
          <div className="password-wrap">
            <input
              id="repeat-password"
              name="repeat-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              className="ac-input"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={t('password.show')}
              onClick={() => setShowPassword((current) => !current)}
            >
              <EyeIcon />
            </button>
          </div>
        </div>

        {error ? (
          <p className="ac-field-error" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}

        <div>
          <button type="submit" className="btn btn-p" disabled={submitting}>
            {submitting ? t('password.submitting') : t('password.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
