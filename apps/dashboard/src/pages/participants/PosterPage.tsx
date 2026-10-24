import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
import PosterPreview from '../../components/participants/PosterPreview'
import { ArrowLeftIcon, PrinterIcon } from '../../components/participants/icons'
import type { PosterContent, PosterStyle } from '../../fake/participants'
import { t, type ParticipantsKey } from '../../i18n/participants'

const styles: { key: PosterStyle; labelKey: ParticipantsKey }[] = [
  { key: 'info', labelKey: 'poster.styleInfo' },
  { key: 'solid', labelKey: 'poster.styleSolid' },
  { key: 'circle', labelKey: 'poster.styleCircle' },
  { key: 'band', labelKey: 'poster.styleBand' },
  { key: 'minimal', labelKey: 'poster.styleMinimal' },
]

const contents: {
  key: PosterContent
  labelKey: ParticipantsKey
  subKey: ParticipantsKey
}[] = [
  { key: 'code', labelKey: 'poster.contentCode', subKey: 'poster.contentCodeSub' },
  { key: 'qr', labelKey: 'poster.contentQr', subKey: 'poster.contentQrSub' },
  { key: 'both', labelKey: 'poster.contentBoth', subKey: 'poster.contentBothSub' },
]

function StyleThumb({ style }: { style: PosterStyle }) {
  return (
    <span className={`poster-thumb poster-thumb-${style}`} aria-hidden="true">
      <i className="poster-thumb-bar" />
      <i className="poster-thumb-line" />
      <i className="poster-thumb-block" />
      <i className="poster-thumb-dot" />
    </span>
  )
}

export default function PosterPage() {
  const { studyId = 'jardim-da-estrela' } = useParams<{ studyId: string }>()
  const [style, setStyle] = useState<PosterStyle>('info')
  const [content, setContent] = useState<PosterContent>('both')
  const styleName = t(styles.find((item) => item.key === style)?.labelKey ?? 'poster.styleInfo')

  return (
    <div className="pts-page pts-poster-page">
      <Link className="pts-back" to={`/estudos/${studyId}/participantes/codigos`}>
        <ArrowLeftIcon />
        {t('action.backToCodes')}
      </Link>

      <header className="pts-page-head pts-poster-head">
        <div>
          <h1 className="page-title">{t('poster.title')}</h1>
          <p className="sub pts-lead">{t('poster.sub')}</p>
        </div>
        <button type="button" className="btn btn-p" onClick={() => window.print()}>
          <PrinterIcon />
          {t('action.printPoster')}
        </button>
      </header>

      <div className="poster-layout">
        <aside className="poster-controls">
          <section className="card pts-control-card" aria-labelledby="poster-style-title">
            <h2 className="h2" id="poster-style-title">
              {t('poster.style')}
            </h2>
            <p className="sub">{t('poster.styleSub')}</p>
            <div className="poster-style-grid">
              {styles.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={style === item.key ? 'poster-style-button is-active' : 'poster-style-button'}
                  aria-pressed={style === item.key}
                  onClick={() => setStyle(item.key)}
                >
                  <StyleThumb style={item.key} />
                  <span>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card pts-control-card" aria-labelledby="poster-content-title">
            <h2 className="h2" id="poster-content-title">
              {t('poster.content')}
            </h2>
            <p className="sub">{t('poster.contentSub')}</p>
            <div className="poster-content-list">
              {contents.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={content === item.key ? 'poster-content-button is-active' : 'poster-content-button'}
                  aria-pressed={content === item.key}
                  onClick={() => setContent(item.key)}
                >
                  <span>
                    <strong>{t(item.labelKey)}</strong>
                    <small>{t(item.subKey)}</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className="card pts-control-card" aria-labelledby="poster-rules-title">
            <h2 className="h2" id="poster-rules-title">
              {t('poster.rules')}
            </h2>
            <p className="sub">{t('poster.rulesSub')}</p>
            <div className="poster-rule">
              <div>
                <strong>{t('poster.limit')}</strong>
                <p>{t('poster.limitHelp')}</p>
              </div>
              <span className="pill ne">{t('poster.limitValue')}</span>
            </div>
            <div className="poster-rule">
              <div>
                <strong>{t('poster.approval')}</strong>
                <p>{t('poster.approvalHelp')}</p>
              </div>
              <span className="pill ok">{t('poster.approvalValue')}</span>
            </div>
          </section>
        </aside>

        <section className="poster-preview-panel" aria-labelledby="poster-preview-title">
          <div className="pts-poster-preview-head">
            <h2 className="h2" id="poster-preview-title">
              {t('poster.preview')}
            </h2>
            <span className="pill ne">{t('poster.previewStyle', { name: styleName })}</span>
          </div>
          <div className="poster-stage">
            <PosterPreview style={style} content={content} />
          </div>
          <p className="pts-poster-note">{t('poster.previewNote')}</p>
        </section>
      </div>
    </div>
  )
}
