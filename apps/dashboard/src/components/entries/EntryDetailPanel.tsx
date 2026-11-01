import { useRef, useState, type KeyboardEvent } from 'react'
import { t } from '../../i18n/entries'
import { CheckIcon } from '../icons'
import {
  entryAlias,
  entryKindMeta,
  entryStatusMeta,
  entryStatusOf,
  formatReceived,
  formatStamp,
  isFree,
  scaleAnswer,
  scaleTypeKey,
  paletteFor,
  shortId,
  type EntryOut,
  type TagOut,
} from './entryMeta'
import {
  AlertTriangleIcon,
  FullscreenIcon,
  InfoIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  TagIcon,
} from './EntryIcons'
import { ScenicFrame, ScaleDots, Waveform } from './EntryArtwork'

type EntryDetailPanelProps = {
  entry: EntryOut
  tags: TagOut[]
  knownTags: TagOut[]
  timeZone: string
  busy?: boolean
  tagError?: boolean
  onAddTag: (name: string) => void
  onRemoveTag: (tagId: string) => void
}

export default function EntryDetailPanel({
  entry,
  tags,
  knownTags,
  timeZone,
  busy,
  tagError,
  onAddTag,
  onRemoveTag,
}: EntryDetailPanelProps) {
  const [playing, setPlaying] = useState(false)
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [newTag, setNewTag] = useState('')
  const kind = entryKindMeta[entry.entry_type]
  const status = entryStatusOf(entry)
  const statusMeta = entryStatusMeta[status]
  const scale = scaleAnswer(entry)
  const mediaPrefix =
    entry.entry_type === 'photo'
      ? 'image/'
      : entry.entry_type === 'video'
        ? 'video/'
        : entry.entry_type === 'audio'
          ? 'audio/'
          : null
  const media =
    (mediaPrefix
      ? entry.media?.find((item) => item.mime_type.startsWith(mediaPrefix))
      : undefined) ?? entry.media?.[0]
  const availableTags = knownTags.filter(
    (tag) => !tags.some((current) => current.name === tag.name),
  )
  const activity = entry.activity_title ?? t('activity.unknown')
  const alias = entryAlias(entry)

  function toggleAudio() {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false))
    } else {
      audio.pause()
    }
  }

  async function openVideoFullscreen() {
    const video = videoRef.current
    if (!video) {
      return
    }
    try {
      await video.requestFullscreen()
    } catch {
      // The browser may refuse fullscreen; the inline controls still work.
    }
  }

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

  function renderMedia() {
    if (status === 'processing') {
      return (
        <div className="en-detail-media en-detail-state">
          <RefreshIcon width={28} height={28} />
          <span>{t('list.processingTitle')}</span>
          <small>{t('detail.mediaProcessing')}</small>
        </div>
      )
    }

    if (status === 'failed') {
      return (
        <div className="en-detail-media en-detail-state en-detail-state-failed">
          <AlertTriangleIcon width={28} height={28} />
          <span>{t('list.failedTitle')}</span>
          <small>{t('detail.mediaFailed')}</small>
        </div>
      )
    }

    if (entry.entry_type === 'text') {
      return (
        <div className="en-detail-text">
          <p>{entry.body ?? t('detail.mediaUnavailable')}</p>
        </div>
      )
    }

    if (entry.entry_type === 'choice') {
      return (
        <div className="en-detail-text">
          <p>{entry.choice ?? t('detail.mediaUnavailable')}</p>
        </div>
      )
    }

    if (entry.entry_type === 'scale' && scale) {
      return (
        <div className="en-detail-scale">
          <span className="en-scale-number">
            {scale.value}
            {scale.points > 0 ? <span> de {scale.points}</span> : null}
          </span>
          <ScaleDots scale={scale} />
          <div className="en-scale-meta">
            <span className="en-scale-meta-label">{t('detail.scaleShown')}</span>
            <strong>
              {t(scaleTypeKey(scale.type))}
              {scale.points > 0 ? ` · ${scale.points}` : ''}
            </strong>
            <span className="en-scale-labels">
              {scale.labels.map((label, index) => (
                <span
                  key={`${label}-${index}`}
                  className={index + 1 === scale.value ? 'is-chosen' : undefined}
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

    if (!media || !media.url) {
      return (
        <div className="en-detail-media en-detail-state">
          <ScenicFrame palette={paletteFor(entry.id)} className="en-detail-scenic" />
          <small>{t('detail.mediaUnavailable')}</small>
        </div>
      )
    }

    if (entry.entry_type === 'audio') {
      return (
        <div className="en-detail-media en-detail-audio">
          <button
            type="button"
            className="en-audio-play"
            aria-label={playing ? t('detail.pause') : t('detail.play')}
            onClick={toggleAudio}
          >
            {playing ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
          </button>
          <Waveform color="#7FD3BF" />
          <audio
            ref={audioRef}
            controls
            src={media.url}
            className="en-detail-media-file"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </div>
      )
    }

    if (entry.entry_type === 'video') {
      return (
        <div className="en-detail-media">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            src={media.url}
            className="en-detail-media-file"
          />
          <div className="en-video-controls">
            <button
              type="button"
              aria-label={t('detail.fullscreen')}
              onClick={() => void openVideoFullscreen()}
            >
              <FullscreenIcon width={20} height={20} />
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="en-detail-media">
        <img
          src={media.url}
          alt={t('detail.photoAlt', { alias })}
          className="en-detail-media-file"
        />
      </div>
    )
  }

  const latitude = entry.latitude
  const longitude = entry.longitude

  return (
    <aside className="card en-detail" aria-label={t('detail.selected')}>
      <div className="en-detail-head">
        <div className="en-detail-heading">
          <span className="en-detail-kicker">{t('detail.selected')}</span>
          <span className="en-detail-title">
            <span className="mono">{alias}</span> · {t(kind.labelKey)}
          </span>
          <span className="en-detail-activity">{activity}</span>
        </div>
        <span className={`pill ${statusMeta.tone}`}>
          {status === 'ready' ? <CheckIcon width={14} height={14} /> : null}
          {t(statusMeta.labelKey)}
        </span>
      </div>

      {busy ? (
        <div className="en-detail-media en-detail-state" aria-busy="true">
          <RefreshIcon width={28} height={28} />
          <span>{t('list.loading')}</span>
        </div>
      ) : (
        renderMedia()
      )}

      {entry.entry_type !== 'text' && entry.entry_type !== 'scale' && entry.body ? (
        <p className="en-detail-quote">{entry.body}</p>
      ) : null}

      <div className="en-detail-rows">
        <div>
          <span>{t('detail.recorded')}</span>
          <span className="mono">{formatStamp(entry.recorded_at, timeZone)}</span>
        </div>
        <div>
          <span>{t('detail.received')}</span>
          <span className="mono">{formatReceived(entry, timeZone)}</span>
        </div>
      </div>

      <div className="en-detail-section">
        <span className="en-detail-h3">{t('detail.requestTitle')}</span>
        {isFree(entry) ? (
          <p className="sub">{t('detail.noRequest')}</p>
        ) : (
          <div className="en-request-steps">
            <div className="en-request-step">
              <span className="en-request-dot is-answered" aria-hidden="true" />
              <span className="mono">{entry.prompt_id ? shortId(entry.prompt_id) : '–'}</span>
              <span>{t('detail.requestRef')}</span>
            </div>
            <div className="en-request-step">
              <span className="en-request-dot" aria-hidden="true" />
              <span className="mono">{formatStamp(entry.recorded_at, timeZone)}</span>
              <span>{t('detail.requestAnswered')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="en-detail-section">
        <span className="en-detail-h3">{t('detail.location')}</span>
        {latitude !== null && longitude !== null ? (
          <>
            <div
              className="en-map"
              role="img"
              aria-label={t('detail.locationCoords', {
                lat: latitude.toFixed(4),
                lon: longitude.toFixed(4),
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
              {t('detail.locationCoords', {
                lat: latitude.toFixed(4),
                lon: longitude.toFixed(4),
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
            <span key={tag.id} className="en-tag en-tag-removable">
              {tag.name}
              <button
                type="button"
                aria-label={t('detail.removeTag', { tag: tag.name })}
                onClick={() => onRemoveTag(tag.id)}
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
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    onAddTag(tag.name)
                    setTagMenuOpen(false)
                  }}
                >
                  <TagIcon width={14} height={14} />
                  {tag.name}
                </button>
              ))
            ) : (
              <span className="sub">{t('detail.allTagsUsed')}</span>
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
        {tagError ? (
          <p className="sub en-detail-note" role="alert">
            <AlertTriangleIcon width={16} height={16} />
            {t('detail.tagsError')}
          </p>
        ) : (
          <p className="sub en-detail-note">{t('detail.tagsSaved')}</p>
        )}
      </div>

      {status === 'failed' ? (
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
