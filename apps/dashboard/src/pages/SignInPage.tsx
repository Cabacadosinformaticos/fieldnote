import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthError, requestPasswordReset } from '../api/auth'
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
  }
  return t('signIn.error')
}

function forgotErrorMessage(error: unknown): string {
  if (error instanceof AuthError && error.code === 'mail_unavailable') {
    return t('signIn.forgotMailUnavailable')
  }
  return t('signIn.forgotError')
}

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, user, signIn } = useAuth()
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [notice] = useState(() => {
    const state = location.state as { passwordReset?: boolean } | null
    return state?.passwordReset ? t('signIn.resetDone') : ''
  })

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(user?.role === 'admin' ? '/admin/contas' : '/estudos', { replace: true })
    }
  }, [status, user, navigate])

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
      if (outcome === 'totp_enrolment_required') {
        navigate('/entrar/ativar', { replace: true })
        return
      }
      // The authenticated effect above picks the landing page for the role.
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setForgotError('')
    setForgotSubmitting(true)

    try {
      await requestPasswordReset(email)
      setForgotSent(true)
    } catch (caught) {
      setForgotError(forgotErrorMessage(caught))
    } finally {
      setForgotSubmitting(false)
    }
  }

  function openForgot() {
    setMode('forgot')
    setError('')
    setForgotError('')
    setForgotSent(false)
  }

  function backToSignIn() {
    setMode('signin')
    setForgotError('')
    setForgotSent(false)
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
            <h1 className="signin-title">
              {mode === 'signin' ? t('signIn.title') : t('signIn.forgotTitle')}
            </h1>
            <span className="signin-subtitle">
              {mode === 'signin' ? t('signIn.subtitle') : t('signIn.forgotSubtitle')}
            </span>
          </div>

          {notice ? (
            <div className="signin-alert is-success" role="status">
              {notice}
            </div>
          ) : null}

          {mode === 'signin' ? (
            <>
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

                <button type="button" className="signin-forgot" onClick={openForgot}>
                  {t('signIn.forgot')}
                </button>
              </form>

              <div className="signin-notes">
                <span>{t('signIn.forgotNote')}</span>
                <span className="signin-admin-note">{t('signIn.adminNote')}</span>
              </div>
            </>
          ) : forgotSent ? (
            <div className="signin-form">
              <div className="signin-alert is-success" role="status">
                {t('signIn.forgotSent')}
              </div>
              <span className="signin-subtitle">{t('signIn.forgotSentNote')}</span>
              <button type="button" className="signin-forgot" onClick={backToSignIn}>
                {t('signIn.forgotBack')}
              </button>
            </div>
          ) : (
            <form className="signin-form" onSubmit={handleForgot}>
              <div className="field">
                <label htmlFor="forgot-email">{t('signIn.email')}</label>
                <input
                  id="forgot-email"
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

              <div className="signin-alert" role="alert" aria-live="polite">
                {forgotError}
              </div>

              <button type="submit" className="signin-submit" disabled={forgotSubmitting}>
                {forgotSubmitting ? t('signIn.forgotSubmitting') : t('signIn.forgotSubmit')}
              </button>

              <button type="button" className="signin-forgot" onClick={backToSignIn}>
                {t('signIn.forgotBack')}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
