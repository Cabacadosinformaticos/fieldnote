import { useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  downloadStudyExport,
  useEntries,
  useStudy,
  useStudyPermissions,
  type EntryOut,
} from '../../api/entries'
import { useStudyOverview } from '../../api/studies'
import {
  LayersIcon,
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
  formatStamp,
  isFree,
  shortId,
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

type ExportRecord = {
  id: string
  who: string
  when: string
  count: string
  options: OptionId[]
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
    Icon: LayersIcon,
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
  return entry.prompt_id ? shortId(entry.prompt_id) : '–'
}

export default function ExportPage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? ''
  const base = `/estudos/${studyId}`
  const { user } = useAuth()
  const permissions = useStudyPermissions(studyId)
  const studyQuery = useStudy(studyId)
  const timeZone = studyQuery.data?.timezone ?? 'Europe/Lisbon'
  const overviewQuery = useStudyOverview(studyId)
  const entriesQuery = useEntries(studyId, { limit: 4 })
  const entries = entriesQuery.data?.items ?? []
  const preview = entries.slice(0, 4)

  const [options, setOptions] = useState<Record<OptionId, boolean>>({
    location: false,
    media: false,
    identity: false,
  })
  const [history, setHistory] = useState<ExportRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [exportError, setExportError] = useState<unknown>(null)

  const total = overviewQuery.data?.entries.total
  const countLabel = total === undefined ? '–' : String(total)
  const range =
    studyQuery.data?.starts_on && studyQuery.data.ends_on
      ? formatRange(studyQuery.data.starts_on, studyQuery.data.ends_on)
      : '—'

  const selectedIds: OptionId[] = optionDefinitions
    .filter((option) => options[option.id])
    .map((option) => option.id)
    .filter((id) => id !== 'media')
    .filter((id) => id !== 'identity' || permissions.canIncludeIdentity)
  const selectedNames = optionDefinitions
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => t(option.nameKey))
  const optionsSummary =
    selectedNames.length === 0 ? t('export.summary.none') : selectedNames.join(', ')

  function toggleOption(id: OptionId) {
    if (id === 'media') {
      return
    }
    if (id === 'identity' && !permissions.canIncludeIdentity) {
      return
    }
    setOptions((current) => ({ ...current, [id]: !current[id] }))
    setSuccess(null)
    setExportError(null)
  }

  async function runExport() {
    setBusy(true)
    setSuccess(null)
    setExportError(null)
    try {
      const filename = await downloadStudyExport(studyId, {
        includeLocation: options.location,
        includeIdentity: options.identity && permissions.canIncludeIdentity,
      })
      setHistory((current) => [
        {
          id: `local-${current.length + 1}`,
          who: user?.email ?? '—',
          when: formatStamp(new Date().toISOString(), timeZone),
          count: countLabel,
          options: selectedIds,
        },
        ...current,
      ])
      setSuccess(filename)
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
              <label className="en-scope-card is-selected">
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked
                  readOnly
                />
                <span className="en-radio" aria-hidden="true">
                  <i />
                </span>
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.all')}</span>
                  <span className="en-scope-meta">
                    {t('export.scope.allMeta', {
                      count: countLabel,
                      range,
                    })}
                  </span>
                </span>
              </label>
              {/* Local fallback: the export endpoint always exports the whole study. */}
              <label className="en-scope-card is-disabled">
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked={false}
                  disabled
                  readOnly
                />
                <span className="en-radio" aria-hidden="true" />
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.filtered')}</span>
                  <span className="en-scope-meta">{t('export.scope.filteredUnavailable')}</span>
                </span>
              </label>
            </div>
            <p className="sub en-export-source">
              <Link to={`${base}/registos`}>{t('export.scope.openList')}</Link>
            </p>
          </section>

          <section className="card en-export-section" aria-label={t('export.format.title')}>
            <div className="en-export-section-head">
              <span className="en-step">2</span>
              <h2 className="h2">{t('export.format.title')}</h2>
            </div>
            <div className="en-format-row">
              <span className="en-format-chip">
                <CheckIcon width={16} height={16} />
                {t('export.format.zip')}
              </span>
              <span className="sub">{t('export.format.note')}</span>
            </div>
            <div className="en-export-table-wrap">
              <table className="en-export-table">
                <colgroup>
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
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
              {t('export.preview.note', { shown: preview.length, total: countLabel })}
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
              const locked =
                option.id === 'media' ||
                (option.id === 'identity' && !permissions.canIncludeIdentity)
              const on = options[option.id] && !locked
              const name = t(option.nameKey)
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
                    {option.id === 'media' ? (
                      <span className="en-export-option-note">
                        {t('export.option.mediaUnavailable')}
                      </span>
                    ) : null}
                    {option.id === 'identity' && locked ? (
                      <span className="en-export-option-note">
                        {t('export.option.identityLocked')}
                      </span>
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
              <p className="sub">{t('export.previous.local')}</p>
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
                {history.length === 0 ? (
                  <tr>
                    <td className="en-td en-history-meta" colSpan={5}>
                      {t('export.previous.empty')}
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr key={record.id}>
                      <td className="en-td en-history-who">{record.who}</td>
                      <td className="en-td en-history-meta">{record.when}</td>
                      <td className="en-td en-history-meta">
                        {t('export.previous.entries', { count: record.count })}
                      </td>
                      <td className="en-td">
                        {record.options.length === 0 ? (
                          <span className="en-history-meta">{t('export.previous.none')}</span>
                        ) : (
                          record.options.map((option) => (
                            <span key={option} className="pill wa">
                              {t(
                                optionDefinitions.find((item) => item.id === option)?.nameKey ??
                                  'export.summary.options',
                              )}
                            </span>
                          ))
                        )}
                      </td>
                      <td className="en-td en-history-meta">ZIP</td>
                    </tr>
                  ))
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
              <b>{entriesQuery.isLoading ? '–' : countLabel}</b>
            </div>
            <div>
              <span>{t('export.summary.format')}</span>
              <b>ZIP</b>
            </div>
            <div>
              <span>{t('export.summary.files')}</span>
              <b>2</b>
            </div>
            <div>
              <span>{t('export.summary.options')}</span>
              <b>{optionsSummary}</b>
            </div>
          </div>
          <div
            className={`en-summary-note${selectedIds.includes('identity') ? ' is-warning' : ''}`}
          >
            <span>
              {selectedNames.length === 0
                ? t('export.summary.safe')
                : t('export.summary.includes', { options: selectedNames.join(', ') })}
            </span>
            {selectedIds.includes('identity') ? (
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
              overviewQuery.isLoading ||
              overviewQuery.isError ||
              entriesQuery.isLoading ||
              entriesQuery.isError
            }
            onClick={() => void runExport()}
          >
            <ExportIcon width={20} height={20} />
            {busy ? t('export.preparing') : t('export.button', { count: countLabel })}
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
