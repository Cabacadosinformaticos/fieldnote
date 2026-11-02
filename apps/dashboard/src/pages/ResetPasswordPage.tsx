import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthError, confirmPasswordReset } from '../api/auth'
import { CheckIcon, EyeIcon, LogoMark } from '../components/icons'
import { t } from '../i18n'

const heroBullets = [
  t('signIn.heroBullet1'),
  t('signIn.heroBullet2'),
  t('signIn.heroBullet3'),
] as const

function resetErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid_reset_token':
        return t('reset.error.invalidToken')
      case 'password_too_short':
        return t('reset.error.tooShort')
      case 'password_is_email':
        return t('reset.error.isEmail')
      default:
        break
    }
  }
  return t('reset.error.generic')
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [token] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return params.get('token') ?? ''
  })
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }, [token])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!token) {
      setError(t('reset.error.invalidToken'))
      return
    }
    if (password.length < 12) {
      setError(t('reset.error.tooShort'))
      return
    }
    if (password !== repeat) {
      setError(t('reset.error.mismatch'))
      return
    }

    setSubmitting(true)
    try {
      await confirmPasswordReset(token, password)
      navigate('/entrar', { replace: true, state: { passwordReset: true } })
    } catch (caught) {
      setError(resetErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="signin-shell">
      <section className="signin-hero">
        <div className="signin-brand">
          <LogoMark width={30} height={36} />
          <span className="signin-brand-name">{t('app.name')}</span>
        </div>

        <div className="signin-hero-body">
          <h2 className="signin-hero-title">{t('reset.heroTitle')}</h2>
          <p className="signin-hero-text">{t('reset.heroBody')}</p>
          <ul className="signin-list">
            {heroBullets.map((bullet) => (
              <li key={bullet} className="signin-list-item">
                <CheckIcon />
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        <span className="signin-footer">{t('signIn.footer')}</span>
      </section>

      <main className="signin-main">
        <div className="signin-card">
          <div className="signin-heading">
            <h1 className="signin-title">
              {token ? t('reset.title') : t('reset.invalidTitle')}
            </h1>
            <span className="signin-subtitle">
              {token ? t('reset.subtitle') : t('reset.invalidBody')}
            </span>
          </div>

          {token ? (
            <form className="signin-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="new-password">{t('reset.newPassword')}</label>
                <div className="password-wrap">
                  <input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    className="field-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={t('reset.showPassword')}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    <EyeIcon />
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="repeat-password">{t('reset.repeatPassword')}</label>
                <input
                  id="repeat-password"
                  name="repeat-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={12}
                  className="field-input"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  required
                />
              </div>

              <div className="signin-alert" role="alert" aria-live="polite">
                {error}
              </div>

              <button type="submit" className="signin-submit" disabled={submitting}>
                {submitting ? t('reset.submitting') : t('reset.submit')}
              </button>

              <Link className="signin-forgot" to="/entrar">
                {t('reset.back')}
              </Link>
            </form>
          ) : (
            <div className="signin-form">
              <Link className="signin-submit" to="/entrar">
                {t('reset.back')}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
