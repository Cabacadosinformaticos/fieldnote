import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthError } from '../api/auth'
import { CheckIcon, ChevronLeftIcon } from '../components/admin/icons'
import { LogoMark } from '../components/icons'
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
  }
  return t('totp.error.invalid')
}

export default function TotpPage() {
  const navigate = useNavigate()
  const { status, pendingEmail, signInTotp } = useAuth()
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const [digits, setDigits] = useState<string[]>(emptyDigits)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const complete = digits.every((digit) => /^\d$/.test(digit))

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
    if (!complete || submitting) {
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await signInTotp(digits.join(''))
      navigate('/estudos', { replace: true })
    } catch (caught) {
      if (caught instanceof AuthError && caught.code === 'totp_session_missing') {
        navigate('/entrar', { replace: true })
        return
      }
      if (caught instanceof AuthError && caught.code === 'totp_enrolment_required') {
        navigate('/entrar/ativar', { replace: true })
        return
      }
      setError(errorMessage(caught))
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
    return <Navigate to={status === 'authenticated' ? '/estudos' : '/entrar'} replace />
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
        <div className="ad-totp-card">
          <Link className="ad-totp-back" to="/entrar">
            <ChevronLeftIcon />
            {tAdmin('totp.back')}
          </Link>

          <div className="ad-totp-heading">
            <h1 className="ad-totp-title">{tAdmin('totp.title')}</h1>
            <p className="ad-totp-sub">
              {tAdmin('totp.subtitleBefore')}
              <strong>{pendingEmail}</strong>
              {tAdmin('totp.subtitleAfter')}
            </p>
          </div>

          <form className="ad-totp-form" onSubmit={handleSubmit}>
            <fieldset className="ad-totp-fieldset">
              <legend className="ad-totp-legend">{tAdmin('totp.code')}</legend>
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

            <div className="ad-totp-alert" role="alert" aria-live="polite">
              {error}
            </div>

            <button type="submit" className="ad-totp-submit" disabled={!complete || submitting}>
              {submitting ? t('totp.submitting') : tAdmin('totp.submit')}
            </button>
          </form>

          <p className="ad-totp-note">{tAdmin('totp.noAccess')}</p>
        </div>
      </main>
    </div>
  )
}
