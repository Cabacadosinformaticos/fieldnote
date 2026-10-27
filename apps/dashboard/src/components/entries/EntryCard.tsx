import { useState, type KeyboardEvent } from 'react'
import { t } from '../../i18n/entries'
import {
  entryAlias,
  entryKindMeta,
  entryStatusOf,
  formatReceived,
  formatStamp,
  isFree,
  isLate,
  lateMinutes,
  type EntryOut,
  type TagOut,
} from './entryMeta'
import { EntryTypeIcon, RefreshIcon } from './EntryIcons'
import EntryArtwork from './EntryArtwork'

type EntryCardProps = {
  entry: EntryOut
  tags: TagOut[]
  timeZone: string
  selected: boolean
  layout: 'grid' | 'rows'
  onSelect: () => void
}

export default function EntryCard({
  entry,
  tags,
  timeZone,
  selected,
  layout,
  onSelect,
}: EntryCardProps) {
  // Local fallback: the API has no endpoint to retry media processing, so the button only
  // shows the processing state until the entry is reloaded.
  const [retrying, setRetrying] = useState(false)
  const kind = entryKindMeta[entry.entry_type]
  const status = retrying ? 'processing' : entryStatusOf(entry)
  const failed = status === 'failed'
  const late = !retrying && isLate(entry)
  const activity = entry.activity_title ?? t('activity.unknown')
  const alias = entryAlias(entry)

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  const statusPill =
    status === 'processing' ? (
      <span className="pill wa">{t('status.processing')}</span>
    ) : failed ? (
      <span className="pill da">{t('status.failed')}</span>
    ) : null

  const latePill = late ? (
    <span className="pill wa en-late-pill">
      {t('list.lateBy', { minutes: lateMinutes(entry) })}
    </span>
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
        <span className="en-row-participant mono">{alias}</span>
        <span className="en-row-type">
          <EntryTypeIcon kind={entry.entry_type} width={14} height={14} />
          {t(kind.labelKey)}
        </span>
        <span className="en-row-activity">{activity}</span>
        <span className="en-row-times mono">
          {formatStamp(entry.recorded_at, timeZone)} → {formatReceived(entry, timeZone)}
        </span>
        <span className="en-row-tags">
          {isFree(entry) ? <span className="pill ne">{t('list.free')}</span> : null}
          {tags.map((tag) => (
            <span key={tag.id} className="en-tag">
              {tag.name}
            </span>
          ))}
        </span>
        <span className="en-row-status">
          {statusPill}
          {latePill}
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
          <span className="mono en-card-participant">{alias}</span>
          <span className="en-card-type">
            <EntryTypeIcon kind={entry.entry_type} width={14} height={14} />
            {t(kind.labelKey)}
          </span>
        </div>
        <span className="en-card-activity">{activity}</span>
        <div className="en-card-times">
          <span>{t('list.recorded')}</span>
          <span className="mono">{formatStamp(entry.recorded_at, timeZone)}</span>
          <span>{t('list.received')}</span>
          <span className="mono">{formatReceived(entry, timeZone)}</span>
        </div>
        <div className="en-card-tags">
          {isFree(entry) ? <span className="pill ne">{t('list.free')}</span> : null}
          {tags.map((tag) => (
            <span key={tag.id} className="en-tag">
              {tag.name}
            </span>
          ))}
          {latePill}
          {statusPill}
        </div>
        {retryButton}
      </div>
    </article>
  )
}
