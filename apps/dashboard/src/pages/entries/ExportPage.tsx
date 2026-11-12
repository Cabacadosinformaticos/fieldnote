import { useMemo, useState, type ComponentType } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  downloadStudyExport,
  useActivities,
  useEntries,
  useExportHistory,
  useParticipants,
  useStudy,
  useStudyPermissions,
  useTags,
  type EntryFilters,
  type EntryOut,
  type EntryType,
  type ExportHistoryItem,
  type ExportMediaType,
  type ExportScope,
} from '../../api/entries'
import { participantLabel } from '../../api/participants'
import { useStudyOverview } from '../../api/studies'
import {
  MapPinIcon,
  ShieldIcon,
  UserIcon,
  type IconProps,
} from '../../components/entries/EntryIcons'
import {
  entriesErrorMessage,
  EntryErrorState,
  EntryLoadingState,
} from '../../components/entries/EntryStates'
import { CheckIcon, ExportIcon } from '../../components/icons'
import {
  entryKindMeta,
  formatRange,
  formatReceived,
  formatShortDate,
  formatStamp,
  isFree,
  shortId,
  zonedParts,
} from '../../components/entries/entryMeta'
import { t, type EntriesKey } from '../../i18n/entries'
import '../../styles/entries.css'

type OptionId = 'location' | 'media' | 'identity'

type OptionDefinition = {
  id: OptionId
  nameKey: EntriesKey
  descriptionKey: EntriesKey
  Icon: ComponentType<IconProps>
}

const ENTRY_TYPES: EntryType[] = ['text', 'photo', 'audio', 'video', 'scale', 'choice']
const MEDIA_TYPE_ORDER: ExportMediaType[] = ['photo', 'audio', 'video']

const mediaTypeKeys: Record<ExportMediaType, EntriesKey> = {
  photo: 'export.media.photo',
  audio: 'export.media.audio',
  video: 'export.media.video',
}

function MediaIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

const optionDefinitions: OptionDefinition[] = [
  {
    id: 'location',
    nameKey: 'export.option.location',
    descriptionKey: 'export.option.locationDesc',
    Icon: MapPinIcon,
  },
  {
    id: 'media',
    nameKey: 'export.option.media',
    descriptionKey: 'export.option.mediaDesc',
    Icon: MediaIcon,
  },
  {
    id: 'identity',
    nameKey: 'export.option.identity',
    descriptionKey: 'export.option.identityDesc',
    Icon: UserIcon,
  },
]

const previewColumns: { key: EntriesKey }[] = [
  { key: 'export.column.participant' },
  { key: 'export.column.activity' },
  { key: 'export.column.prompt' },
  { key: 'export.column.type' },
  { key: 'export.column.content' },
  { key: 'export.column.recorded' },
  { key: 'export.column.received' },
  { key: 'export.column.tags' },
]

function readFilter(searchParams: URLSearchParams): EntryFilters {
  const entryType = searchParams.get('entry_type')
  return {
    participantId: searchParams.get('participant_id') ?? undefined,
    activityId: searchParams.get('activity_id') ?? undefined,
    entryType: ENTRY_TYPES.includes(entryType as EntryType)
      ? (entryType as EntryType)
      : undefined,
    tagId: searchParams.get('tag_id') ?? undefined,
    dateFrom: searchParams.get('date_from') ?? undefined,
    dateTo: searchParams.get('date_to') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    freeOnly: searchParams.get('free_only') === 'true',
    lateOnly: searchParams.get('late_only') === 'true',
  }
}

function hasAnyFilter(filters: EntryFilters): boolean {
  return Boolean(
    filters.participantId ||
      filters.activityId ||
      filters.entryType ||
      filters.tagId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.q ||
      filters.freeOnly ||
      filters.lateOnly,
  )
}

function previewContent(entry: EntryOut): string {
  if (entry.entry_type === 'text') {
    return entry.body ?? t('export.preview.noFile')
  }
  if (entry.entry_type === 'choice') {
    return entry.choice ?? t('export.preview.noFile')
  }
  if (entry.entry_type === 'scale') {
    return entry.value === null ? t('export.preview.noFile') : String(entry.value)
  }
  return t('export.preview.noFile')
}

function previewPrompt(entry: EntryOut): string {
  if (isFree(entry)) {
    return t('list.free')
  }
  // The entry carries no planned prompt time, only an internal id; leave the cell empty.
  return '–'
}

function historyOptions(record: ExportHistoryItem): { key: string; label: string; tone: string }[] {
  const options: { key: string; label: string; tone: string }[] = []
  if (record.include_location) {
    options.push({ key: 'location', label: t('export.option.location'), tone: 'wa' })
  }
  if (record.include_media) {
    const allTypes = record.media_types.length === MEDIA_TYPE_ORDER.length
    options.push({
      key: 'media',
      label: allTypes
        ? t('export.option.media')
        : t('export.option.mediaTypes', {
            types: record.media_types.map((type) => t(mediaTypeKeys[type])).join(', '),
          }),
      tone: 'wa',
    })
    if (!record.include_csv) {
      options.push({ key: 'noCsv', label: t('export.previous.noCsv'), tone: 'ne' })
    }
  }
  if (record.include_identity) {
    options.push({ key: 'identity', label: t('export.option.identity'), tone: 'wa' })
  }
  return options
}

function historyFormat(record: ExportHistoryItem): string {
  if (!record.include_media) {
    return t('export.format.csv')
  }
  return record.include_csv ? t('export.format.csvMedia') : t('export.format.media')
}

export default function ExportPage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? ''
  const base = `/estudos/${studyId}`
  const [searchParams] = useSearchParams()
  const filterKey = searchParams.toString()
  const filters = useMemo(() => readFilter(new URLSearchParams(filterKey)), [filterKey])
  const filtered = hasAnyFilter(filters)

  const permissions = useStudyPermissions(studyId)
  const studyQuery = useStudy(studyId)
  const timeZone = studyQuery.data?.timezone ?? 'Europe/Lisbon'
  const overviewQuery = useStudyOverview(studyId)
  const participantsQuery = useParticipants(studyId)
  const activitiesQuery = useActivities(studyId)
  const tagsQuery = useTags(studyId)
  const filteredCountQuery = useEntries(studyId, { ...filters, limit: 1 })
  const historyQuery = useExportHistory(studyId)

  const [scope, setScope] = useState<ExportScope>('all')
  const [toggles, setToggles] = useState<Record<OptionId, boolean>>({
    location: false,
    media: false,
    identity: false,
  })
  const [mediaTypes, setMediaTypes] = useState<Record<ExportMediaType, boolean>>({
    photo: true,
    audio: true,
    video: true,
  })
  const [includeCsv, setIncludeCsv] = useState(true)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [exportError, setExportError] = useState<unknown>(null)

  const previewFilters: EntryFilters = scope === 'filtered' ? filters : {}
  const entriesQuery = useEntries(studyId, { ...previewFilters, limit: 4 })
  const preview = (entriesQuery.data?.items ?? []).slice(0, 4)

  const total =
    scope === 'all' ? overviewQuery.data?.entries.total : filteredCountQuery.data?.total
  const countLabel = total === undefined ? '–' : String(total)
  const range =
    studyQuery.data?.starts_on && studyQuery.data.ends_on
      ? formatRange(studyQuery.data.starts_on, studyQuery.data.ends_on)
      : '—'

  const filterDescription = useMemo(() => {
    const parts: string[] = []
    const participant = participantsQuery.data?.find(
      (item) => item.id === filters.participantId,
    )
    if (participant) {
      parts.push(t('export.filter.participant', { value: participantLabel(participant) }))
    }
    const activity = activitiesQuery.data?.find((item) => item.id === filters.activityId)
    if (activity) {
      parts.push(t('export.filter.activity', { value: activity.title }))
    }
    if (filters.entryType) {
      parts.push(
        t('export.filter.type', { value: t(entryKindMeta[filters.entryType].labelKey) }),
      )
    }
    const tag = tagsQuery.data?.find((item) => item.id === filters.tagId)
    if (tag) {
      parts.push(t('export.filter.tag', { value: tag.name }))
    }
    if (filters.dateFrom) {
      parts.push(
        t('export.filter.date', {
          value: formatShortDate(zonedParts(filters.dateFrom, timeZone).date),
        }),
      )
    } else if (filters.dateTo) {
      parts.push(
        t('export.filter.date', {
          value: formatShortDate(zonedParts(filters.dateTo, timeZone).date),
        }),
      )
    }
    if (filters.q) {
      parts.push(t('export.filter.q', { value: filters.q }))
    }
    if (filters.freeOnly) {
      parts.push(t('export.filter.freeOnly'))
    }
    if (filters.lateOnly) {
      parts.push(t('export.filter.lateOnly'))
    }
    return parts.join(', ')
  }, [
    filters,
    participantsQuery.data,
    activitiesQuery.data,
    tagsQuery.data,
    timeZone,
  ])

  const selectedMediaTypes = MEDIA_TYPE_ORDER.filter((type) => mediaTypes[type])
  const mediaOn = toggles.media && selectedMediaTypes.length > 0
  const mediaMissing = toggles.media && selectedMediaTypes.length === 0
  // Without the CSV tables there are no rows or columns to carry location or identity.
  const csvOff = mediaOn && !includeCsv
  const locationSelected = toggles.location && !csvOff
  const identitySelected = toggles.identity && permissions.canIncludeIdentity && !csvOff
  const selectedIds: OptionId[] = [
    ...(locationSelected ? (['location'] as const) : []),
    ...(mediaOn ? (['media'] as const) : []),
    ...(identitySelected ? (['identity'] as const) : []),
  ]
  const selectedNames = selectedIds.map((id) => {
    if (id === 'media') {
      return selectedMediaTypes.length === MEDIA_TYPE_ORDER.length
        ? t('export.option.media')
        : t('export.option.mediaTypes', {
            types: selectedMediaTypes.map((type) => t(mediaTypeKeys[type])).join(', '),
          })
    }
    const definition = optionDefinitions.find((option) => option.id === id)
    return definition ? t(definition.nameKey) : id
  })
  const optionsSummary =
    selectedNames.length === 0 ? t('export.summary.none') : selectedNames.join(', ')
  const formatLabel = !mediaOn
    ? t('export.format.csv')
    : includeCsv
      ? t('export.format.csvMedia')
      : t('export.format.media')
  const columnCount =
    mediaOn && !includeCsv
      ? null
      : 8 +
        (mediaOn ? 1 : 0) +
        (locationSelected ? 2 : 0) +
        (identitySelected ? 2 : 0)

  function changeScope(next: ExportScope) {
    setScope(next)
    setSuccess(null)
    setExportError(null)
  }

  function toggleOption(id: OptionId) {
    if (id === 'identity' && !permissions.canIncludeIdentity) {
      return
    }
    setToggles((current) => ({ ...current, [id]: !current[id] }))
    setSuccess(null)
    setExportError(null)
  }

  function toggleMediaType(type: ExportMediaType) {
    setMediaTypes((current) => ({ ...current, [type]: !current[type] }))
    setSuccess(null)
    setExportError(null)
  }

  async function runExport() {
    setBusy(true)
    setSuccess(null)
    setExportError(null)
    try {
      const filename = await downloadStudyExport(studyId, {
        includeLocation: locationSelected,
        includeIdentity: identitySelected,
        scope,
        filter: filters,
        includeMedia: mediaOn,
        mediaTypes: selectedMediaTypes,
        includeCsv: mediaOn ? includeCsv : true,
      })
      setSuccess(filename)
      void historyQuery.refetch()
    } catch (error) {
      setExportError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="en-page">
      <header className="en-page-header">
        <div className="en-header-copy">
          <h1 className="en-title">{t('export.title')}</h1>
          <p className="en-subtitle">{t('export.subtitle')}</p>
        </div>
        <div className="en-header-actions" />
      </header>

      <div className="en-export-layout">
        <div className="en-export-main">
          <section className="card en-export-section" aria-label={t('export.scope.title')}>
            <div className="en-export-section-head">
              <span className="en-step">1</span>
              <h2 className="h2">{t('export.scope.title')}</h2>
            </div>
            <div className="en-scope-grid" role="radiogroup" aria-label={t('export.scope.aria')}>
              <label
                className={`en-scope-card${scope === 'all' ? ' is-selected' : ''}`}
              >
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  onChange={() => changeScope('all')}
                />
                <span className="en-radio" aria-hidden="true">
                  <i />
                </span>
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.all')}</span>
                  <span className="en-scope-meta">
                    {t(total === 1 ? 'export.scope.allMetaOne' : 'export.scope.allMeta', {
                      count: countLabel,
                      range,
                    })}
                  </span>
                </span>
              </label>
              <label
                className={`en-scope-card${scope === 'filtered' ? ' is-selected' : ''}`}
              >
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked={scope === 'filtered'}
                  onChange={() => changeScope('filtered')}
                />
                <span className="en-radio" aria-hidden="true">
                  <i />
                </span>
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.filtered')}</span>
                  <span className="en-scope-meta">
                    {t(
                      filteredCountQuery.data?.total === 1
                        ? 'export.scope.filteredMetaOne'
                        : 'export.scope.filteredMeta',
                      {
                        filter: filtered ? filterDescription : t('export.scope.noFilter'),
                        count:
                          filteredCountQuery.data === undefined
                            ? '–'
                            : String(filteredCountQuery.data.total),
                      },
                    )}{' '}
                    <Link to={`${base}/registos`}>{t('export.scope.entries')}</Link>.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="card en-export-section" aria-label={t('export.format.title')}>
            <div className="en-export-section-head">
              <span className="en-step">2</span>
              <h2 className="h2">{t('export.format.title')}</h2>
            </div>
            <div className="en-format-row">
              <span className="en-format-chip">
                <CheckIcon width={16} height={16} />
                {formatLabel}
              </span>
              <span className="sub">
                {!mediaOn
                  ? t('export.format.note')
                  : includeCsv
                    ? t('export.format.noteMediaCsv')
                    : t('export.format.noteMedia')}
              </span>
            </div>
            <div className="en-export-table-wrap">
              <table className="en-export-table">
                <colgroup>
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {previewColumns.map((column) => (
                      <th key={column.key} className="en-th">
                        {t(column.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((entry) => (
                    <tr key={entry.id}>
                      <td className="en-td mono">
                        {entry.participant_alias ?? shortId(entry.participant_id)}
                      </td>
                      <td className="en-td">
                        {entry.activity_title ?? t('activity.unknown')}
                      </td>
                      <td className="en-td">{previewPrompt(entry)}</td>
                      <td className="en-td">{t(entryKindMeta[entry.entry_type].labelKey)}</td>
                      <td className="en-td en-export-content">{previewContent(entry)}</td>
                      <td className="en-td mono">{formatStamp(entry.recorded_at, timeZone)}</td>
                      <td className="en-td mono">{formatReceived(entry, timeZone)}</td>
                      <td className="en-td">
                        {(entry.tags ?? []).length
                          ? (entry.tags ?? []).map((tag) => tag.name).join('; ')
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {entriesQuery.isLoading ? <EntryLoadingState /> : null}
            {entriesQuery.isError ? (
              <EntryErrorState
                error={entriesQuery.error}
                onRetry={() => void entriesQuery.refetch()}
              />
            ) : null}
            <p className="sub">
              {!mediaOn
                ? t('export.preview.note', {
                    shown: preview.length,
                    total: countLabel,
                  })
                : includeCsv
                  ? t('export.preview.noteMedia', {
                      shown: preview.length,
                      total: countLabel,
                    })
                  : t('export.preview.noteNoCsv', { shown: preview.length })}
            </p>
          </section>

          <section
            className="card en-export-section en-export-options"
            aria-label={t('export.options.title')}
          >
            <div className="en-export-section-head">
              <span className="en-step">3</span>
              <div className="en-export-section-copy">
                <h2 className="h2">{t('export.options.title')}</h2>
                <span className="sub">{t('export.options.sub')}</span>
              </div>
            </div>
            {optionDefinitions.map((option) => {
              const Icon = option.Icon
              const identityLocked = option.id === 'identity' && !permissions.canIncludeIdentity
              const withoutCsv = option.id !== 'media' && csvOff
              const locked = identityLocked || withoutCsv
              const on = toggles[option.id] && !locked
              const name = t(option.nameKey)
              const lockedNote = identityLocked
                ? t('export.option.identityLocked')
                : withoutCsv
                  ? t('export.option.csvOffNote')
                  : null
              return (
                <div className="en-export-option" key={option.id}>
                  <span className="en-export-option-icon">
                    <Icon width={22} height={22} />
                  </span>
                  <div className="en-export-option-copy">
                    <span className="en-export-option-name">
                      {name}
                      {option.id === 'identity' ? (
                        <span className="pill ne">{t('export.option.identityPill')}</span>
                      ) : null}
                    </span>
                    <span className="en-export-option-desc">{t(option.descriptionKey)}</span>
                    {lockedNote ? (
                      <span className="en-export-option-note">{lockedNote}</span>
                    ) : null}
                    {option.id === 'media' && on ? (
                      <div className="en-media-choices">
                        {MEDIA_TYPE_ORDER.map((type) => (
                          <label className="en-check" key={type}>
                            <input
                              type="checkbox"
                              checked={mediaTypes[type]}
                              onChange={() => toggleMediaType(type)}
                            />
                            <span>{t(mediaTypeKeys[type])}</span>
                          </label>
                        ))}
                        <label className="en-check en-check-csv">
                          <input
                            type="checkbox"
                            checked={includeCsv}
                            onChange={() => {
                              setIncludeCsv((current) => !current)
                              setSuccess(null)
                              setExportError(null)
                            }}
                          />
                          <span>{t('export.option.includeCsv')}</span>
                        </label>
                        {mediaMissing ? (
                          <span className="en-export-option-note">
                            {t('export.option.mediaNone')}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="en-export-option-switch">
                    <span>{on ? t('export.option.on') : t('export.option.off')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={locked}
                      aria-label={t('export.option.switchAria', {
                        name,
                        state: on ? t('export.option.on') : t('export.option.off'),
                      })}
                      className={`en-switch${on ? ' is-on' : ''}`}
                      onClick={() => toggleOption(option.id)}
                    >
                      <i />
                    </button>
                  </div>
                </div>
              )
            })}
          </section>

          <section
            className="card en-export-section en-export-history"
            aria-label={t('export.previous.title')}
          >
            <div className="en-export-history-head">
              <h2 className="h2">{t('export.previous.title')}</h2>
              <p className="sub">{t('export.previous.sub')}</p>
            </div>
            <table className="en-export-table en-history-table">
              <thead>
                <tr>
                  <th className="en-th">{t('export.previous.who')}</th>
                  <th className="en-th">{t('export.previous.when')}</th>
                  <th className="en-th">{t('export.previous.scope')}</th>
                  <th className="en-th">{t('export.previous.options')}</th>
                  <th className="en-th">{t('export.previous.format')}</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.isLoading ? (
                  <tr>
                    <td className="en-td en-history-meta" colSpan={5}>
                      {t('export.previous.loading')}
                    </td>
                  </tr>
                ) : historyQuery.isError ? (
                  <tr>
                    <td className="en-td en-history-meta" colSpan={5}>
                      {t('export.previous.error')}
                    </td>
                  </tr>
                ) : (historyQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td className="en-td en-history-meta" colSpan={5}>
                      {t('export.previous.empty')}
                    </td>
                  </tr>
                ) : (
                  (historyQuery.data ?? []).map((record) => {
                    const options = historyOptions(record)
                    return (
                      <tr key={record.id}>
                        <td className="en-td en-history-who">{record.who || '–'}</td>
                        <td className="en-td en-history-meta">
                          {formatStamp(record.when, timeZone)}
                        </td>
                        <td className="en-td en-history-meta">
                          {record.entry_count === null
                            ? '–'
                            : t(
                                record.entry_count === 1
                                  ? 'export.previous.entriesOne'
                                  : 'export.previous.entries',
                                { count: record.entry_count },
                              )}
                          {record.scope === 'filtered' ? (
                            <span className="pill ne">{t('export.previous.filtered')}</span>
                          ) : null}
                        </td>
                        <td className="en-td">
                          {options.length === 0 ? (
                            <span className="en-history-meta">
                              {t('export.previous.none')}
                            </span>
                          ) : (
                            options.map((option) => (
                              <span key={option.key} className={`pill ${option.tone}`}>
                                {option.label}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="en-td en-history-meta">{historyFormat(record)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="card en-export-summary" aria-label={t('export.summary.title')}>
          <h2 className="h2">{t('export.summary.title')}</h2>
          <div className="en-summary-rows">
            <div>
              <span>{t('export.summary.entries')}</span>
              <b>{total === undefined ? '–' : countLabel}</b>
            </div>
            <div>
              <span>{t('export.summary.format')}</span>
              <b>{formatLabel}</b>
            </div>
            <div>
              <span>{t('export.summary.columns')}</span>
              <b>{columnCount ?? '–'}</b>
            </div>
            <div>
              <span>{t('export.summary.options')}</span>
              <b>{optionsSummary}</b>
            </div>
          </div>
          <div className={`en-summary-note${identitySelected ? ' is-warning' : ''}`}>
            <span>
              {selectedNames.length === 0
                ? t('export.summary.safe')
                : t('export.summary.includes', { options: selectedNames.join(', ') })}
            </span>
            {identitySelected ? (
              <span>{t('export.summary.identityWarning')}</span>
            ) : null}
          </div>
          {success ? (
            <p className="en-export-success" role="status">
              <CheckIcon width={16} height={16} />
              {t('export.successFile', { file: success })}
            </p>
          ) : null}
          {exportError ? (
            <p className="en-export-error" role="alert">
              {entriesErrorMessage(exportError)}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-dk en-export-button"
            disabled={
              busy ||
              mediaMissing ||
              overviewQuery.isLoading ||
              overviewQuery.isError ||
              filteredCountQuery.isLoading ||
              filteredCountQuery.isError ||
              entriesQuery.isLoading ||
              entriesQuery.isError
            }
            onClick={() => void runExport()}
          >
            <ExportIcon width={20} height={20} />
            {busy
              ? t('export.preparing')
              : t(total === 1 ? 'export.buttonOne' : 'export.button', { count: countLabel })}
          </button>
          <p className="sub en-detail-note">
            <ShieldIcon width={16} height={16} />
            <span>{t('export.auditNote')}</span>
          </p>
        </aside>
      </div>
    </div>
  )
}
