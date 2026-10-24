import { useState, type KeyboardEvent } from 'react'
import {
  activityFullLabel,
  entryKindMeta,
  formatReceived,
  formatStamp,
  type Entry,
} from '../../fake/entries'
import { t } from '../../i18n/entries'
import { EntryTypeIcon, RefreshIcon } from './EntryIcons'
import EntryArtwork from './EntryArtwork'

type EntryCardProps = {
  entry: Entry
  tags: string[]
  selected: boolean
  layout: 'grid' | 'rows'
  onSelect: () => void
}

export default function EntryCard({ entry, tags, selected, layout, onSelect }: EntryCardProps) {
  const [retrying, setRetrying] = useState(false)
  const kind = entryKindMeta[entry.kind]
  const processing = entry.status === 'processing' || retrying
  const failed = entry.status === 'failed' && !retrying

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  const statusPill = processing ? (
    <span className="pill wa">{t('status.processing')}</span>
  ) : failed ? (
    <span className="pill da">{t('status.failed')}</span>
  ) : null

  const retryButton = failed ? (
    <button
      type="button"
      className="btn btn-sm en-retry"
      onClick={(event) => {
        event.stopPropagation()
        setRetrying(true)
      }}
    >
      <RefreshIcon width={16} height={16} />
      {t('list.retry')}
    </button>
  ) : null

  if (layout === 'rows') {
    return (
      <article
        className={`en-row${selected ? ' is-selected' : ''}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <div className="en-row-art">
          <EntryArtwork entry={entry} retrying={retrying} />
        </div>
        <span className="en-row-participant mono">{entry.participantId}</span>
        <span className="en-row-type">
          <EntryTypeIcon kind={entry.kind} width={14} height={14} />
          {t(kind.labelKey)}
        </span>
        <span className="en-row-activity">{activityFullLabel(entry.activityCode, entry.free)}</span>
        <span className="en-row-times mono">
          {formatStamp(entry.recordedDate, entry.recordedTime)} → {formatReceived(entry)}
        </span>
        <span className="en-row-tags">
          {entry.free ? <span className="pill ne">{t('list.free')}</span> : null}
          {tags.map((tag) => (
            <span key={tag} className="en-tag">
              {tag}
            </span>
          ))}
        </span>
        <span className="en-row-status">
          {statusPill}
          {entry.lateLabel ? <span className="pill wa en-late-pill">{entry.lateLabel}</span> : null}
        </span>
        {retryButton}
      </article>
    )
  }

  return (
    <article
      className={`en-card${selected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <EntryArtwork entry={entry} retrying={retrying} />
      <div className="en-card-body">
        <div className="en-card-top">
          <span className="mono en-card-participant">{entry.participantId}</span>
          <span className="en-card-type">
            <EntryTypeIcon kind={entry.kind} width={14} height={14} />
            {t(kind.labelKey)}
          </span>
        </div>
        <span className="en-card-activity">
          {activityFullLabel(entry.activityCode, entry.free)}
        </span>
        <div className="en-card-times">
          <span>{t('list.recorded')}</span>
          <span className="mono">{formatStamp(entry.recordedDate, entry.recordedTime)}</span>
          <span>{t('list.received')}</span>
          <span className="mono">{formatReceived(entry)}</span>
        </div>
        <div className="en-card-tags">
          {entry.free ? <span className="pill ne">{t('list.free')}</span> : null}
          {tags.map((tag) => (
            <span key={tag} className="en-tag">
              {tag}
            </span>
          ))}
          {entry.lateLabel ? <span className="pill wa en-late-pill">{entry.lateLabel}</span> : null}
          {statusPill}
        </div>
        {retryButton}
      </div>
    </article>
  )
}
