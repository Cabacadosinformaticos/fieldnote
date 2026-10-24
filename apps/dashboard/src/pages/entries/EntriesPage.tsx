import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntryCard from '../../components/entries/EntryCard'
import EntryDetailPanel from '../../components/entries/EntryDetailPanel'
import FilterMenu from '../../components/entries/FilterMenu'
import {
  GridIcon,
  RowsIcon,
  SearchIcon,
  TagIcon,
  TimelineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../components/entries/EntryIcons'
import { ExportIcon } from '../../components/icons'
import {
  defaultSelectedEntryId,
  entries,
  entriesStudy,
  entryActivities,
  entryKindMeta,
  entryMatchesSearch,
  entryParticipants,
  entryStats,
  type EntryKind,
} from '../../fake/entries'
import { t } from '../../i18n/entries'
import '../../styles/entries.css'

const PAGE_SIZE = 12

type FilterState = {
  participant: string
  activity: string
  kind: string
  tag: string
  dates: string
}

const dateFilters: Record<string, string | undefined> = {
  all: undefined,
  today: '2026-10-09',
  day6: '2026-10-06',
  day7: '2026-10-07',
  day8: '2026-10-08',
}

const kindCountKeys = {
  photo: 'count.photo',
  text: 'count.text',
  audio: 'count.audio',
  video: 'count.video',
  scale: 'count.scale',
} as const

export default function EntriesPage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? entriesStudy.id
  const base = `/estudos/${studyId}`

  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'rows'>('grid')
  const [filters, setFilters] = useState<FilterState>({
    participant: 'all',
    activity: 'all',
    kind: 'all',
    tag: 'all',
    dates: 'all',
  })
  const [freeOnly, setFreeOnly] = useState(false)
  const [lateOnly, setLateOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(defaultSelectedEntryId)
  const [tagsByEntry, setTagsByEntry] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.tags])),
  )

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const filtered = entries.filter((entry) => {
    const currentTags = tagsByEntry[entry.id] ?? entry.tags
    const date = dateFilters[filters.dates]

    if (filters.participant !== 'all' && entry.participantId !== filters.participant) {
      return false
    }
    if (filters.activity !== 'all' && entry.activityCode !== filters.activity) {
      return false
    }
    if (filters.kind !== 'all' && entry.kind !== filters.kind) {
      return false
    }
    if (filters.tag !== 'all' && !currentTags.includes(filters.tag)) {
      return false
    }
    if (date && entry.recordedDate !== date) {
      return false
    }
    if (freeOnly && !entry.free) {
      return false
    }
    if (lateOnly && !entry.lateLabel) {
      return false
    }
    if (query.trim() && !entryMatchesSearch(entry, query)) {
      return false
    }
    return true
  })

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const pageEntries = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length)

  const kindCounts = filtered.reduce<Record<EntryKind, number>>(
    (counts, entry) => {
      counts[entry.kind] += 1
      return counts
    },
    { photo: 0, text: 0, video: 0, audio: 0, scale: 0 },
  )

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? entries[0]
  const selectedTags = tagsByEntry[selectedEntry.id] ?? selectedEntry.tags

  function addTag(tag: string) {
    setTagsByEntry((current) => {
      const existing = current[selectedEntry.id] ?? selectedEntry.tags
      return {
        ...current,
        [selectedEntry.id]: existing.includes(tag) ? existing : [...existing, tag],
      }
    })
  }

  function removeTag(tag: string) {
    setTagsByEntry((current) => {
      const existing = current[selectedEntry.id] ?? selectedEntry.tags
      return { ...current, [selectedEntry.id]: existing.filter((item) => item !== tag) }
    })
  }

  const participantOptions = [
    { value: 'all', label: t('list.allParticipants') },
    ...entryParticipants.map((participant) => ({ value: participant, label: participant })),
  ]

  const activityOptions = [
    { value: 'all', label: t('list.allActivities') },
    ...entryActivities.map((activity) => ({
      value: activity.code,
      label: `${activity.code} · ${activity.title}`,
    })),
  ]

  const kindOptions = [
    { value: 'all', label: t('list.allTypes') },
    ...(Object.keys(entryKindMeta) as EntryKind[]).map((kind) => ({
      value: kind,
      label: t(entryKindMeta[kind].labelKey),
    })),
  ]

  const tagOptions = [
    { value: 'all', label: t('list.allTags') },
    ...entryStats.tagCounts.map(({ tag }) => ({ value: tag, label: tag })),
  ]

  const datesOptions = [
    { value: 'all', label: t('dates.all') },
    { value: 'today', label: t('dates.today') },
    { value: 'day6', label: t('dates.day6') },
    { value: 'day7', label: t('dates.day7') },
    { value: 'day8', label: t('dates.day8') },
  ]

  return (
    <div className="en-page">
      <header className="en-page-header">
        <div className="en-header-copy">
          <h1 className="en-title">{t('list.title')}</h1>
          <p className="en-subtitle">
            {t('list.subtitle', { total: entryStats.total, tagged: entryStats.tagged })}
          </p>
        </div>
        <div className="en-header-actions">
          <div className="en-segmented" role="group" aria-label={t('list.viewModes')}>
            <span className="en-segment is-active" aria-current="true">
              <RowsIcon width={18} height={18} />
              {t('list.viewList')}
            </span>
            <Link className="en-segment" to={`${base}/registos/linha-do-tempo`}>
              <TimelineIcon width={18} height={18} />
              {t('list.viewTimeline')}
            </Link>
          </div>
          <Link className="btn" to={`${base}/exportar`}>
            <ExportIcon width={18} height={18} />
            {t('list.export')}
          </Link>
        </div>
      </header>

      <div className="en-layout">
        <div className="en-main">
          <section className="en-filters" aria-label={t('list.filters')}>
            <div className="en-search-row">
              <label className="en-search">
                <span className="en-visually-hidden">{t('list.searchLabel')}</span>
                <SearchIcon width={18} height={18} />
                <input
                  value={query}
                  placeholder={t('list.searchPlaceholder')}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <div className="en-view-toggle" role="group" aria-label={t('list.view')}>
                <button
                  type="button"
                  aria-pressed={viewMode === 'grid'}
                  aria-label={t('list.viewGrid')}
                  onClick={() => setViewMode('grid')}
                >
                  <GridIcon width={18} height={18} />
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'rows'}
                  aria-label={t('list.viewRows')}
                  onClick={() => setViewMode('rows')}
                >
                  <RowsIcon width={18} height={18} />
                </button>
              </div>
            </div>

            <div className="en-filter-row">
              <FilterMenu
                label={t('list.filterParticipant')}
                value={filters.participant}
                options={participantOptions}
                onChange={(value) => updateFilter('participant', value)}
              />
              <FilterMenu
                label={t('list.filterActivity')}
                value={filters.activity}
                options={activityOptions}
                onChange={(value) => updateFilter('activity', value)}
              />
              <FilterMenu
                label={t('list.filterType')}
                value={filters.kind}
                options={kindOptions}
                onChange={(value) => updateFilter('kind', value)}
              />
              <FilterMenu
                label={t('list.filterTag')}
                value={filters.tag}
                options={tagOptions}
                onChange={(value) => updateFilter('tag', value)}
              />
              <FilterMenu
                label={t('list.filterDates')}
                value={filters.dates}
                options={datesOptions}
                onChange={(value) => updateFilter('dates', value)}
              />
            </div>

            <div className="en-filter-row">
              <button
                type="button"
                className={`en-toggle${freeOnly ? ' is-on' : ''}`}
                aria-pressed={freeOnly}
                aria-label={t('list.freeToggleAria')}
                onClick={() => {
                  setFreeOnly((value) => !value)
                  setPage(1)
                }}
              >
                {t('list.freeOnly')}
                <span className="mono">{entryStats.free}</span>
              </button>
              <button
                type="button"
                className={`en-toggle${lateOnly ? ' is-on' : ''}`}
                aria-pressed={lateOnly}
                aria-label={t('list.lateToggleAria')}
                onClick={() => {
                  setLateOnly((value) => !value)
                  setPage(1)
                }}
              >
                {t('list.lateOnly')}
                <span className="mono">{entryStats.late}</span>
              </button>
              <span className="en-hint">{t('list.lateHint')}</span>
            </div>

            <div className="en-filter-row en-tag-row">
              <span className="en-tag-label">{t('list.tags')}</span>
              {entryStats.tagCounts.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  className={`en-tag-pill${filters.tag === tag ? ' is-on' : ''}`}
                  aria-pressed={filters.tag === tag}
                  aria-label={t('list.tagFilterAria', { tag })}
                  onClick={() => updateFilter('tag', filters.tag === tag ? 'all' : tag)}
                >
                  <TagIcon width={14} height={14} />
                  {tag}
                  <span className="mono">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="en-results-meta">
            <span>
              {filtered.length === 0 ? t('list.showingNone') : t('list.showing', { from, to, total: filtered.length })}
            </span>
            <span className="en-kind-counts">
              {(Object.keys(kindCounts) as EntryKind[]).map((kind) => (
                <span key={kind}>
                  {t(kindCountKeys[kind])} {kindCounts[kind]}
                </span>
              ))}
            </span>
          </div>

          {pageEntries.length > 0 ? (
            <section
              className={viewMode === 'grid' ? 'en-grid' : 'en-rows'}
              aria-label={t('list.title')}
            >
              {pageEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  tags={tagsByEntry[entry.id] ?? entry.tags}
                  selected={entry.id === selectedEntry.id}
                  layout={viewMode}
                  onSelect={() => setSelectedId(entry.id)}
                />
              ))}
            </section>
          ) : (
            <p className="en-empty">{t('list.empty')}</p>
          )}

          <div className="en-pagination">
            <button
              type="button"
              className="btn en-page-button"
              aria-label={t('list.prevPage')}
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeftIcon width={18} height={18} />
            </button>
            <span>{t('list.page', { page: currentPage, pages })}</span>
            <button
              type="button"
              className="btn en-page-button"
              aria-label={t('list.nextPage')}
              disabled={currentPage >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              <ChevronRightIcon width={18} height={18} />
            </button>
          </div>
        </div>

        <EntryDetailPanel
          key={selectedEntry.id}
          entry={selectedEntry}
          tags={selectedTags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
        />
      </div>
    </div>
  )
}
