import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthError } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { CheckIcon, EyeIcon, LogoMark } from '../components/icons'
import { t } from '../i18n'

const heroBullets = [
  t('signIn.heroBullet1'),
  t('signIn.heroBullet2'),
  t('signIn.heroBullet3'),
] as const

function errorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code === 'account_locked') {
      return t('signIn.accountLocked')
    }
    if (error.code === 'totp_enrolment_required') {
      return t('signIn.totpEnrolmentRequired')
    }
  }
  return t('signIn.error')
}

export default function SignInPage() {
  const navigate = useNavigate()
  const { status, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/estudos', { replace: true })
    }
  }, [status, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const outcome = await signIn(email, password)
      if (outcome === 'totp_required') {
        navigate('/entrar/codigo', { replace: true })
        return
      }
      navigate('/estudos', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
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
          <h2 className="signin-hero-title">{t('signIn.heroTitle')}</h2>
          <p className="signin-hero-text">{t('signIn.heroBody')}</p>
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
            <h1 className="signin-title">{t('signIn.title')}</h1>
            <span className="signin-subtitle">{t('signIn.subtitle')}</span>
          </div>

          <form className="signin-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">{t('signIn.email')}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder={t('signIn.emailPlaceholder')}
                className="field-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">{t('signIn.password')}</label>
              <div className="password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="field-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={t('signIn.showPassword')}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <EyeIcon />
                </button>
              </div>
            </div>

            <div className="signin-alert" role="alert" aria-live="polite">
              {error}
            </div>

            <button type="submit" className="signin-submit" disabled={submitting}>
              {submitting ? t('signIn.submitting') : t('signIn.submit')}
            </button>

            <button type="button" className="signin-forgot">
              {t('signIn.forgot')}
            </button>
          </form>

          <div className="signin-notes">
            <span>{t('signIn.forgotNote')}</span>
            <span className="signin-admin-note">{t('signIn.adminNote')}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
