import {
  studyName,
  waitingCode,
  type PosterContent,
  type PosterStyle,
} from '../../fake/participants'
import { t } from '../../i18n/participants'
import { LogoMark } from '../icons'
import QrCode from './QrCode'

export default function PosterPreview({
  style,
  content,
}: {
  style: PosterStyle
  content: PosterContent
}) {
  const showQr = content === 'qr' || content === 'both'
  const showCode = content === 'code' || content === 'both'

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
        <span className="poster-dates">{t('poster.pillDates')}</span>
      </header>

      <div className="poster-main">
        <h1>{studyName}</h1>
        <p className="poster-tagline">{t('poster.tagline')}</p>
        <div className="poster-pills">
          <span>{t('poster.pillMinutes')}</span>
          <span>{t('poster.pillDates')}</span>
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
                <QrCode seed={7} className="poster-qr" label={waitingCode} />
              </div>
            ) : null}
            {showCode ? (
              <div className="poster-code-card">
                <span>{t('poster.codeEntry')}</span>
                <strong className="mono">{waitingCode}</strong>
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
            <strong>{t('poster.teamValue')}</strong>
            <small>{t('poster.institution')}</small>
          </div>
          <div>
            <span>{t('poster.signups')}</span>
            <strong>{t('poster.signupsValue')}</strong>
          </div>
          <div>
            <span>{t('poster.dates')}</span>
            <strong>{t('poster.pillDates')}</strong>
          </div>
        </div>
        <p className="poster-privacy">{t('poster.privacyValue')}</p>
      </footer>
    </article>
  )
}
