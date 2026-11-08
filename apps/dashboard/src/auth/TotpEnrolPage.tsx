import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthError, type TotpEnrolment } from '../api/auth'
import { CheckIcon, ChevronLeftIcon } from '../components/admin/icons'
import { LogoMark } from '../components/icons'
import QrCode from '../components/participants/QrCode'
import { t } from '../i18n'
import { t as tAdmin } from '../i18n/admin'
import '../styles/admin.css'
import { useAuth } from './useAuth'

const LENGTH = 6
const emptyDigits = Array.from({ length: LENGTH }, () => '')

function errorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code === 'account_locked') {
      return t('totp.error.locked')
    }
    if (error.code === 'invalid_credentials') {
      return tAdmin('totp.enrol.error.invalid')
    }
  }
  const code = error instanceof AuthError ? error.code : 'unknown'
  return tAdmin('totp.enrol.error.generic', { code })
}

export default function TotpEnrolPage() {
  const navigate = useNavigate()
  const { status, pendingEmail, enrolTotp, confirmTotpEnrolment } = useAuth()
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const startedForAttempt = useRef(-1)
  const [attempt, setAttempt] = useState(0)
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null)
  const [loadError, setLoadError] = useState('')
  const [digits, setDigits] = useState<string[]>(emptyDigits)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const complete = digits.every((digit) => /^\d$/.test(digit))

  // The secret is provisional until the first code confirms it, so asking again is safe. The
  // guard keeps StrictMode's double effect from replacing the secret shown on screen.
  useEffect(() => {
    if (!pendingEmail || startedForAttempt.current === attempt) {
      return
    }
    startedForAttempt.current = attempt
    setEnrolment(null)
    setLoadError('')
    void enrolTotp()
      .then((data) => setEnrolment(data))
      .catch((caught) => {
        if (caught instanceof AuthError && caught.code === 'totp_session_missing') {
          navigate('/entrar', { replace: true })
          return
        }
        if (caught instanceof AuthError && caught.code === 'totp_already_enrolled') {
          navigate('/entrar/codigo', { replace: true })
          return
        }
        setLoadError(errorMessage(caught))
      })
  }, [attempt, enrolTotp, navigate, pendingEmail])

  function retry() {
    setAttempt((current) => current + 1)
  }

  function setDigitAt(index: number, value: string) {
    setDigits((current) => current.map((digit, position) => (position === index ? value : digit)))
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    setDigitAt(index, digit)
    if (digit && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus()
      setDigitAt(index - 1, '')
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault()
      inputs.current[index + 1]?.focus()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (pasted.length === 0) {
      return
    }
    event.preventDefault()
    const next = [...emptyDigits]
    pasted.split('').forEach((digit, index) => {
      next[index] = digit
    })
    setDigits(next)
    inputs.current[Math.min(pasted.length, LENGTH - 1)]?.focus()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete || submitting || !enrolment) {
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await confirmTotpEnrolment(digits.join(''))
      navigate('/admin/contas', { replace: true })
    } catch (caught) {
      if (caught instanceof AuthError && caught.code === 'totp_session_missing') {
        navigate('/entrar', { replace: true })
        return
      }
      if (caught instanceof AuthError && caught.code === 'totp_already_enrolled') {
        navigate('/entrar/codigo', { replace: true })
        return
      }
      setError(errorMessage(caught))
      if (caught instanceof AuthError && caught.code === 'invalid_credentials') {
        setDigits(emptyDigits)
        inputs.current[0]?.focus()
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }} aria-busy="true">
        {t('auth.loading')}
      </div>
    )
  }

  if (!pendingEmail) {
    return <Navigate to={status === 'authenticated' ? '/admin/contas' : '/entrar'} replace />
  }

  return (
    <div className="signin-shell">
      <section className="signin-hero">
        <div className="signin-brand">
          <LogoMark width={30} height={36} />
          <span className="signin-brand-name">{tAdmin('app.name')}</span>
        </div>

        <div className="signin-hero-body">
          <h2 className="signin-hero-title">{tAdmin('totp.heroTitle')}</h2>
          <p className="signin-hero-text">{tAdmin('totp.heroBody')}</p>
          <ul className="signin-list">
            {[tAdmin('totp.heroBullet1'), tAdmin('totp.heroBullet2'), tAdmin('totp.heroBullet3')].map(
              (bullet) => (
                <li key={bullet} className="signin-list-item">
                  <CheckIcon />
                  {bullet}
                </li>
              ),
            )}
          </ul>
        </div>

        <span className="signin-footer">{tAdmin('totp.footer')}</span>
      </section>

      <main className="signin-main">
        <div className="ad-totp-card ad-totp-enrol-card">
          <Link className="ad-totp-back" to="/entrar">
            <ChevronLeftIcon />
            {tAdmin('totp.back')}
          </Link>

          <div className="ad-totp-heading">
            <h1 className="ad-totp-title">{tAdmin('totp.enrol.title')}</h1>
            <p className="ad-totp-sub">
              {tAdmin('totp.enrol.subtitleBefore')}
              <strong>{pendingEmail}</strong>
              {tAdmin('totp.enrol.subtitleAfter')}
            </p>
          </div>

          {enrolment ? (
            <>
              <div className="ad-totp-enrol-block">
                <h2 className="ad-totp-enrol-title">{tAdmin('totp.enrol.step1Title')}</h2>
                <p className="ad-totp-enrol-text">{tAdmin('totp.enrol.step1Body')}</p>
                <div className="ad-totp-qr">
                  <QrCode
                    value={enrolment.otpauth_uri}
                    label={tAdmin('totp.enrol.qrLabel')}
                  />
                </div>
                <p className="ad-totp-enrol-text">{tAdmin('totp.enrol.manualBody')}</p>
                <code className="ad-totp-secret">{enrolment.secret}</code>
                <a className="ad-totp-link" href={enrolment.otpauth_uri}>
                  {tAdmin('totp.enrol.openLink')}
                </a>
              </div>

              <form className="ad-totp-form" onSubmit={handleSubmit}>
                <fieldset className="ad-totp-fieldset">
                  <legend className="ad-totp-legend">{tAdmin('totp.enrol.step2Title')}</legend>
                  <div className="ad-totp-inputs">
                    {digits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          inputs.current[index] = element
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        pattern="[0-9]*"
                        className="ad-totp-digit"
                        aria-label={tAdmin('totp.digitAria', { n: index + 1 })}
                        value={digit}
                        onChange={(event) => handleChange(index, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(index, event)}
                        onPaste={handlePaste}
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                  <span className="ad-hint">{tAdmin('totp.hint')}</span>
                </fieldset>

                <div className="ad-totp-alert ad-totp-error" role="alert" aria-live="polite">
                  {error}
                </div>

                <button type="submit" className="ad-totp-submit" disabled={!complete || submitting}>
                  {submitting ? t('totp.submitting') : tAdmin('totp.enrol.submit')}
                </button>
              </form>
            </>
          ) : loadError ? (
            <div className="ad-totp-load" role="alert">
              <p>{loadError}</p>
              <button type="button" className="ad-totp-submit" onClick={retry}>
                {tAdmin('common.retry')}
              </button>
            </div>
          ) : (
            <p className="ad-totp-load" aria-busy="true">
              {tAdmin('totp.enrol.loading')}
            </p>
          )}

          <p className="ad-totp-note">{tAdmin('totp.enrol.note')}</p>
        </div>
      </main>
    </div>
  )
}
