import { useState, type KeyboardEvent } from 'react'
import {
  activityFullLabel,
  entryKindMeta,
  entryStatusMeta,
  entryTags,
  formatReceived,
  formatStamp,
  type Entry,
} from '../../fake/entries'
import { t } from '../../i18n/entries'
import { CheckIcon } from '../icons'
import {
  FullscreenIcon,
  InfoIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  TagIcon,
  AlertTriangleIcon,
} from './EntryIcons'
import { ScenicFrame, ScaleDots, Waveform } from './EntryArtwork'

type EntryDetailPanelProps = {
  entry: Entry
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

function secondsOf(duration: string): number {
  const [minutes, seconds] = duration.split(':').map(Number)
  return minutes * 60 + seconds
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function EntryDetailPanel({
  entry,
  tags,
  onAddTag,
  onRemoveTag,
}: EntryDetailPanelProps) {
  const [playing, setPlaying] = useState(false)
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const kind = entryKindMeta[entry.kind]
  const status = entryStatusMeta[entry.status]
  const availableTags = entryTags.filter((tag) => !tags.includes(tag))

  function submitTag(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    const value = newTag.trim()
    if (!value) {
      return
    }
    onAddTag(value)
    setNewTag('')
  }

  const totalSeconds = entry.duration ? secondsOf(entry.duration) : 0
  const elapsed = Math.floor(totalSeconds * 0.25)

  const media = (() => {
    if (entry.status === 'processing') {
      return (
        <div className="en-detail-media en-detail-state">
          <RefreshIcon width={28} height={28} />
          <span>{t('list.processingTitle')}</span>
          <small>{t('detail.mediaProcessing')}</small>
        </div>
      )
    }

    if (entry.status === 'failed') {
      return (
        <div className="en-detail-media en-detail-state en-detail-state-failed">
          <AlertTriangleIcon width={28} height={28} />
          <span>{t('list.failedTitle')}</span>
          <small>{t('detail.mediaFailed')}</small>
        </div>
      )
    }

    if (entry.kind === 'text') {
      return (
        <div className="en-detail-text">
          <p>{entry.text ?? entry.excerpt}</p>
        </div>
      )
    }

    if (entry.kind === 'scale' && entry.scale) {
      return (
        <div className="en-detail-scale">
          <span className="en-scale-number">
            {entry.scale.value}
            <span> de {entry.scale.points}</span>
          </span>
          <ScaleDots scale={entry.scale} />
          <div className="en-scale-meta">
            <span className="en-scale-meta-label">{t('detail.scaleShown')}</span>
            <strong>
              {entry.scale.type === 'numeric'
                ? t('detail.scaleNumeric')
                : t('detail.scaleFaces')}{' '}
              · {entry.scale.points}
            </strong>
            <span className="en-scale-labels">
              {entry.scale.labels.map((label) => (
                <span
                  key={label}
                  className={
                    entry.scale && entry.scale.labels.indexOf(label) + 1 === entry.scale.value
                      ? 'is-chosen'
                      : undefined
                  }
                >
                  {label}
                </span>
              ))}
            </span>
            <span className="en-scale-ordinal">{t('detail.scaleOrdinal')}</span>
          </div>
        </div>
      )
    }

    if (entry.kind === 'audio') {
      return (
        <div className="en-detail-media en-detail-audio">
          <button
            type="button"
            className="en-audio-play"
            aria-label={playing ? t('detail.pause') : t('detail.play')}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
          </button>
          <Waveform color="#7FD3BF" />
          <span className="mono">
            {playing ? '0:10' : '0:00'} / {entry.duration ?? '0:00'}
          </span>
        </div>
      )
    }

    return (
      <div className="en-detail-media">
        <ScenicFrame palette={entry.palette} className="en-detail-scenic" />
        {entry.kind === 'video' ? (
          <>
            <button
              type="button"
              className="en-detail-play"
              aria-label={playing ? t('detail.pause') : t('detail.play')}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <PauseIcon width={24} height={24} /> : <PlayIcon width={24} height={24} />}
            </button>
            <div className="en-video-controls">
              <button
                type="button"
                aria-label={playing ? t('detail.pause') : t('detail.play')}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
              </button>
              <span className="mono">
                {formatSeconds(elapsed)} / {entry.duration}
              </span>
              <div className="en-video-progress">
                <div style={{ width: `${(elapsed / Math.max(totalSeconds, 1)) * 100}%` }} />
                <i style={{ left: `${(elapsed / Math.max(totalSeconds, 1)) * 100}%` }} />
              </div>
              <button type="button" aria-label={t('detail.fullscreen')}>
                <FullscreenIcon width={20} height={20} />
              </button>
            </div>
          </>
        ) : null}
      </div>
    )
  })()

  return (
    <aside className="card en-detail" aria-label={t('detail.selected')}>
      <div className="en-detail-head">
        <div className="en-detail-heading">
          <span className="en-detail-kicker">{t('detail.selected')}</span>
          <span className="en-detail-title">
            <span className="mono">{entry.participantId}</span> · {t(kind.labelKey)}
          </span>
          <span className="en-detail-activity">
            {activityFullLabel(entry.activityCode, entry.free)}
          </span>
        </div>
        <span className={`pill ${status.tone}`}>
          {entry.status === 'ready' ? <CheckIcon width={14} height={14} /> : null}
          {t(status.labelKey)}
        </span>
      </div>

      {media}

      {entry.kind !== 'text' && entry.kind !== 'scale' && entry.excerpt ? (
        <p className="en-detail-quote">{entry.excerpt}</p>
      ) : null}

      <div className="en-detail-rows">
        <div>
          <span>{t('detail.recorded')}</span>
          <span className="mono">{formatStamp(entry.recordedDate, entry.recordedTime)}</span>
        </div>
        <div>
          <span>{t('detail.received')}</span>
          <span className="mono">{formatReceived(entry)}</span>
        </div>
        {entry.duration ? (
          <div>
            <span>{t('detail.duration')}</span>
            <span className="mono">{entry.duration}</span>
          </div>
        ) : null}
      </div>

      <div className="en-detail-section">
        <span className="en-detail-h3">{t('detail.requestTitle')}</span>
        {entry.request ? (
          <div className="en-request-steps">
            {[
              { label: t('detail.requestSent'), time: entry.request.sent, done: true },
              { label: t('detail.requestOpened'), time: entry.request.opened, done: true },
              { label: t('detail.requestAnswered'), time: entry.request.answered, done: true },
            ].map((step, index) => (
              <div key={step.label} className="en-request-step">
                <span
                  className={`en-request-dot${index === 2 ? ' is-answered' : ''}`}
                  aria-hidden="true"
                />
                <span className="mono">{step.time}</span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="sub">{t('detail.noRequest')}</p>
        )}
      </div>

      <div className="en-detail-section">
        <span className="en-detail-h3">{t('detail.location')}</span>
        {entry.location ? (
          <>
            <div
              className="en-map"
              role="img"
              aria-label={t('detail.locationRequested', {
                label: entry.location.label,
                code: entry.location.requestedBy,
              })}
            >
              <svg viewBox="0 0 340 116" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect width="340" height="116" fill="#E8EEE3" />
                <rect x="40" y="18" width="150" height="80" rx="8" fill="#BFD9BE" />
                <path d="M0 100 L340 60" stroke="#fff" strokeWidth="10" />
                <path d="M210 0 L240 116" stroke="#fff" strokeWidth="8" />
                <path d="M0 30 L120 20" stroke="#fff" strokeWidth="5" />
                <circle cx="118" cy="58" r="30" fill="#2F5BEA" opacity="0.15" />
                <path
                  d="M118 70c-7 0-12-5-12-11 0-8 12-22 12-22s12 14 12 22c0 6-5 11-12 11z"
                  fill="#2F5BEA"
                />
                <circle cx="118" cy="58" r="4" fill="#fff" />
              </svg>
            </div>
            <span className="en-detail-location">
              <MapPinIcon width={16} height={16} />
              {t('detail.locationRequested', {
                label: entry.location.label,
                code: entry.location.requestedBy,
              })}
            </span>
          </>
        ) : (
          <p className="sub">{t('detail.locationNone')}</p>
        )}
      </div>

      <div className="en-detail-section">
        <span className="en-detail-h3">{t('detail.tags')}</span>
        <div className="en-detail-tags">
          {tags.map((tag) => (
            <span key={tag} className="en-tag en-tag-removable">
              {tag}
              <button
                type="button"
                aria-label={t('detail.removeTag', { tag })}
                onClick={() => onRemoveTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="en-tag-add"
            onClick={() => setTagMenuOpen((value) => !value)}
            aria-expanded={tagMenuOpen}
          >
            <PlusIcon width={14} height={14} />
            {t('detail.addTag')}
          </button>
        </div>
        {tagMenuOpen ? (
          <div className="en-tag-menu">
            {availableTags.length > 0 ? (
              availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onAddTag(tag)
                    setTagMenuOpen(false)
                  }}
                >
                  <TagIcon width={14} height={14} />
                  {tag}
                </button>
              ))
            ) : (
              <span className="sub">Todas as etiquetas já estão neste registo.</span>
            )}
          </div>
        ) : null}
        <label className="en-tag-input">
          <TagIcon width={16} height={16} />
          <input
            value={newTag}
            placeholder={t('detail.tagInput')}
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={submitTag}
          />
        </label>
      </div>

      {entry.status === 'failed' ? (
        <p className="sub en-detail-failed-note">
          <AlertTriangleIcon width={16} height={16} />
          {t('detail.mediaFailed')}
        </p>
      ) : null}

      <p className="sub en-detail-note">
        <InfoIcon width={16} height={16} />
        <span>{t('detail.auditNote')}</span>
      </p>
    </aside>
  )
}
