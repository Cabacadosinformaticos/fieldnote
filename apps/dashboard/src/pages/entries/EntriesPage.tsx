import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  useActivities,
  useCreateTag,
  useEntries,
  useEntry,
  useParticipants,
  useSetEntryTags,
  useStudy,
  useStudyEvents,
  useTags,
  type EntryFilters,
  type EntryOut,
  type EntryType,
  type StudyOut,
} from '../../api/entries'
import EntryCard from '../../components/entries/EntryCard'
import EntryDetailPanel from '../../components/entries/EntryDetailPanel'
import {
  EntryErrorState,
  EntryLoadingState,
} from '../../components/entries/EntryStates'
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
  addDays,
  dayStartIso,
  entryAlias,
  entryKindMeta,
  formatShortDate,
  isFree,
  isLate,
  shortId,
} from '../../components/entries/entryMeta'
import { t, type EntriesKey } from '../../i18n/entries'
import '../../styles/entries.css'

const PAGE_SIZE = 12

type FilterState = {
  participant: string
  activity: string
  kind: string
  tag: string
  dates: string
}

type DateOption = { value: string; label: string; from?: string; to?: string }

function buildDateOptions(study: StudyOut | undefined, timeZone: string): DateOption[] {
  const all: DateOption = { value: 'all', label: t('dates.all') }
  if (!study?.starts_on) {
    return [all]
  }
  const end = study.ends_on ?? study.starts_on
  const days: DateOption[] = []
  let cursor = study.starts_on
  let guard = 0
  while (cursor <= end && guard < 60) {
    days.push({
      value: cursor,
      label: formatShortDate(cursor),
      from: dayStartIso(cursor, timeZone),
      to: dayStartIso(addDays(cursor, 1), timeZone),
    })
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return [all, ...days]
}

function matchesSearch(entry: EntryOut, query: string): boolean {
  const haystack = [
    entryAlias(entry),
    entry.body ?? '',
    entry.choice ?? '',
    entry.activity_title ?? '',
    (entry.tags ?? []).map((tag) => tag.name).join(' '),
    t(entryKindMeta[entry.entry_type].labelKey),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

const kindCountKeys: Record<EntryType, EntriesKey> = {
  photo: 'count.photo',
  text: 'count.text',
  audio: 'count.audio',
  video: 'count.video',
  scale: 'count.scale',
  choice: 'count.choice',
}

export default function EntriesPage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? ''
  const base = `/estudos/${studyId}`
  const [searchParams] = useSearchParams()

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
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get('registo'),
  )

  const studyQuery = useStudy(studyId)
  const timeZone = studyQuery.data?.timezone ?? 'Europe/Lisbon'
  const activitiesQuery = useActivities(studyId)
  const participantsQuery = useParticipants(studyId)
  const tagsQuery = useTags(studyId)
  const createTag = useCreateTag(studyId)
  const setEntryTags = useSetEntryTags(studyId)
  const eventStatus = useStudyEvents(studyId)

  const dateOptions = useMemo(
    () => buildDateOptions(studyQuery.data, timeZone),
    [studyQuery.data, timeZone],
  )
  const selectedDate = dateOptions.find((option) => option.value === filters.dates)
  const cursor = cursorStack[cursorStack.length - 1] ?? null

  const apiFilters: EntryFilters = {
    participantId: filters.participant !== 'all' ? filters.participant : undefined,
    activityId: filters.activity !== 'all' ? filters.activity : undefined,
    entryType: filters.kind !== 'all' ? (filters.kind as EntryType) : undefined,
    tagId: filters.tag !== 'all' ? filters.tag : undefined,
    dateFrom: selectedDate?.from,
    dateTo: selectedDate?.to,
    cursor,
    limit: PAGE_SIZE,
  }

  const entriesQuery = useEntries(studyId, apiFilters)
  const items = entriesQuery.data?.items ?? []
  const nextCursor = entriesQuery.data?.next_cursor ?? null

  // Local fallback: the list endpoint has no search, free-entry or late filter, so these three
  // narrow the page the API returned instead of changing the server query.
  const visible = items.filter((entry) => {
    if (freeOnly && !isFree(entry)) {
      return false
    }
    if (lateOnly && !isLate(entry)) {
      return false
    }
    if (query.trim() && !matchesSearch(entry, query)) {
      return false
    }
    return true
  })

  const selectedEntryId = selectedId ?? visible[0]?.id ?? items[0]?.id ?? null
  const detailQuery = useEntry(studyId, selectedEntryId)
  const selectedEntry =
    detailQuery.data ?? items.find((entry) => entry.id === selectedEntryId) ?? null
  const selectedTags = selectedEntry?.tags ?? []

  function resetPagination() {
    setCursorStack([null])
  }

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    resetPagination()
  }

  async function addTag(name: string) {
    if (!selectedEntry) {
      return
    }
    const current = selectedEntry.tags ?? []
    if (current.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
      return
    }
    const known = (tagsQuery.data ?? []).find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    )
    try {
      const tag = known ?? (await createTag.mutateAsync(name))
      setEntryTags.mutate({
        entryId: selectedEntry.id,
        tagIds: [...current.map((item) => item.id), tag.id],
      })
    } catch {
      // The mutation error is rendered by the detail panel.
    }
  }

  function removeTag(tagId: string) {
    if (!selectedEntry) {
      return
    }
    setEntryTags.mutate({
      entryId: selectedEntry.id,
      tagIds: (selectedEntry.tags ?? [])
        .filter((tag) => tag.id !== tagId)
        .map((tag) => tag.id),
    })
  }

  const participantOptions = [
    { value: 'all', label: t('list.allParticipants') },
    ...(participantsQuery.data ?? []).map((participant) => ({
      value: participant.id,
      label: participant.alias ?? shortId(participant.id),
    })),
  ]

  const activityOptions = [
    { value: 'all', label: t('list.allActivities') },
    ...(activitiesQuery.data ?? []).map((activity) => ({
      value: activity.id,
      label: activity.title,
    })),
  ]

  const kindOptions = [
    { value: 'all', label: t('list.allTypes') },
    ...(Object.keys(entryKindMeta) as EntryType[]).map((kind) => ({
      value: kind,
      label: t(entryKindMeta[kind].labelKey),
    })),
  ]

  const tagOptions = [
    { value: 'all', label: t('list.allTags') },
    ...(tagsQuery.data ?? []).map((tag) => ({ value: tag.id, label: tag.name })),
  ]

  const datesOptions = dateOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  const kindCounts = visible.reduce<Record<EntryType, number>>(
    (counts, entry) => {
      counts[entry.entry_type] += 1
      return counts
    },
    { photo: 0, text: 0, video: 0, audio: 0, scale: 0, choice: 0 },
  )

  const tagCounts = (tagsQuery.data ?? [])
    .map((tag) => ({
      tag,
      count: visible.filter((entry) =>
        (entry.tags ?? []).some((item) => item.id === tag.id),
      ).length,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)

  const freeCount = items.filter(isFree).length
  const lateCount = items.filter(isLate).length
  const taggedCount = items.filter((entry) => (entry.tags ?? []).length > 0).length
  const page = cursorStack.length

  return (
    <div className="en-page">
      <header className="en-page-header">
        <div className="en-header-copy">
          <h1 className="en-title">{t('list.title')}</h1>
          <p className="en-subtitle">
            {t('list.subtitle', { total: items.length, tagged: taggedCount })}
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
          <span className={`en-live en-live-${eventStatus}`} aria-live="polite">
            {eventStatus === 'live' ? t('list.live') : t('list.offline')}
          </span>
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
                    resetPagination()
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
                  resetPagination()
                }}
              >
                {t('list.freeOnly')}
                <span className="mono">{freeCount}</span>
              </button>
              <button
                type="button"
                className={`en-toggle${lateOnly ? ' is-on' : ''}`}
                aria-pressed={lateOnly}
                aria-label={t('list.lateToggleAria')}
                onClick={() => {
                  setLateOnly((value) => !value)
                  resetPagination()
                }}
              >
                {t('list.lateOnly')}
                <span className="mono">{lateCount}</span>
              </button>
              <span className="en-hint">{t('list.lateHint')}</span>
            </div>

            <div className="en-filter-row en-tag-row">
              <span className="en-tag-label">{t('list.tags')}</span>
              {tagCounts.map(({ tag, count }) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`en-tag-pill${filters.tag === tag.id ? ' is-on' : ''}`}
                  aria-pressed={filters.tag === tag.id}
                  aria-label={t('list.tagFilterAria', { tag: tag.name })}
                  onClick={() =>
                    updateFilter('tag', filters.tag === tag.id ? 'all' : tag.id)
                  }
                >
                  <TagIcon width={14} height={14} />
                  {tag.name}
                  <span className="mono">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="en-results-meta">
            <span>
              {visible.length === 0
                ? t('list.showingNone')
                : t('list.showingPage', { count: visible.length })}
            </span>
            <span className="en-kind-counts">
              {(Object.keys(kindCounts) as EntryType[]).map((kind) => (
                <span key={kind}>
                  {t(kindCountKeys[kind])} {kindCounts[kind]}
                </span>
              ))}
            </span>
          </div>

          {entriesQuery.isError ? (
            <EntryErrorState
              error={entriesQuery.error}
              onRetry={() => void entriesQuery.refetch()}
            />
          ) : entriesQuery.isLoading ? (
            <EntryLoadingState />
          ) : visible.length > 0 ? (
            <section
              className={viewMode === 'grid' ? 'en-grid' : 'en-rows'}
              aria-label={t('list.title')}
            >
              {visible.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  tags={entry.tags ?? []}
                  timeZone={timeZone}
                  selected={entry.id === selectedEntry?.id}
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
              disabled={cursorStack.length <= 1}
              onClick={() =>
                setCursorStack((current) =>
                  current.length > 1 ? current.slice(0, -1) : current,
                )
              }
            >
              <ChevronLeftIcon width={18} height={18} />
            </button>
            <span>{t('list.page', { page })}</span>
            <button
              type="button"
              className="btn en-page-button"
              aria-label={t('list.nextPage')}
              disabled={!nextCursor}
              onClick={() => {
                if (nextCursor) {
                  setCursorStack((current) => [...current, nextCursor])
                }
              }}
            >
              <ChevronRightIcon width={18} height={18} />
            </button>
          </div>
        </div>

        {selectedEntry ? (
          <EntryDetailPanel
            key={selectedEntry.id}
            entry={selectedEntry}
            tags={selectedTags}
            knownTags={tagsQuery.data ?? []}
            timeZone={timeZone}
            busy={detailQuery.isLoading && !detailQuery.data}
            tagError={Boolean(createTag.error ?? setEntryTags.error)}
            onAddTag={addTag}
            onRemoveTag={removeTag}
          />
        ) : (
          <aside className="card en-detail" aria-busy="true">
            <EntryLoadingState />
          </aside>
        )}
      </div>
    </div>
  )
}
