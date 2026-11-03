import { t } from '../../i18n/participants'
import { LogoMark } from '../icons'
import { formatDate } from './format'
import QrCode from './QrCode'

export type PosterStyle = 'info' | 'solid' | 'circle' | 'band' | 'minimal'

export type PosterContent = 'code' | 'qr' | 'both'

export default function PosterPreview({
  style,
  content,
  studyTitle,
  startsOn,
  endsOn,
  team,
  code,
  expiresAt,
  minutesPerDay,
}: {
  style: PosterStyle
  content: PosterContent
  studyTitle: string
  startsOn: string | null
  endsOn: string | null
  team: string[]
  code: string
  expiresAt: string
  minutesPerDay: number | null
}) {
  const showQr = content === 'qr' || content === 'both'
  const showCode = content === 'code' || content === 'both'
  const dateRange = t('poster.dateRange', {
    start: formatDate(startsOn),
    end: formatDate(endsOn),
  })

  return (
    <article className={`poster-sheet poster-style-${style} poster-content-${content}`}>
      <div className="poster-deco" aria-hidden="true">
        <span className="poster-deco-one" />
        <span className="poster-deco-two" />
        <span className="poster-deco-three" />
        <span className="poster-deco-four" />
      </div>

      <header className="poster-top">
        <div className="poster-brand">
          <span className="poster-logo">
            <LogoMark width={22} height={27} />
          </span>
          <span className="poster-brand-text">
            <strong>Fieldnote</strong>
            <small>{t('poster.studyKind')}</small>
          </span>
        </div>
        <span className="poster-dates">{t('poster.signupsUntil', { date: formatDate(expiresAt) })}</span>
      </header>

      <div className="poster-main">
        <h1>{studyTitle}</h1>
        <p className="poster-tagline">{t('poster.tagline')}</p>
        <div className="poster-pills">
          {minutesPerDay !== null ? (
            <span>
              {minutesPerDay === 1
                ? t('poster.pillMinutesOne')
                : t('poster.pillMinutes', { count: minutesPerDay })}
            </span>
          ) : null}
          <span>{dateRange}</span>
        </div>

        <div className="poster-entry">
          <p className="poster-entry-lead">
            {content === 'code'
              ? t('poster.writeInApp')
              : content === 'qr'
                ? t('poster.readWithApp')
                : t('poster.codeLead')}
          </p>
          <div className="poster-entry-grid">
            {showQr ? (
              <div className="poster-qr-card">
                <QrCode value={code} className="poster-qr" label={code} />
              </div>
            ) : null}
            {showCode ? (
              <div className="poster-code-card">
                <span>{t('poster.codeEntry')}</span>
                <strong className="mono">{code}</strong>
                {content === 'both' ? <small>{t('poster.codeOr')}</small> : null}
              </div>
            ) : null}
          </div>
        </div>

        <ol className="poster-steps">
          <li>{t('poster.step1')}</li>
          {showQr ? <li>{t('poster.step2')}</li> : null}
          {showCode ? <li>{t('poster.step3')}</li> : null}
        </ol>
      </div>

      <footer className="poster-foot">
        <div className="poster-foot-grid">
          <div>
            <span>{t('poster.team')}</span>
            <strong>{team.length > 0 ? team.join(', ') : t('poster.teamEmpty')}</strong>
          </div>
          <div>
            <span>{t('poster.signups')}</span>
            <strong>{t('poster.signupsUntil', { date: formatDate(expiresAt) })}</strong>
          </div>
          <div>
            <span>{t('poster.dates')}</span>
            <strong>{dateRange}</strong>
          </div>
        </div>
        <p className="poster-privacy">{t('poster.privacyValue')}</p>
      </footer>
    </article>
  )
}
