import { useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  LayersIcon,
  MapPinIcon,
  ShieldIcon,
  UserIcon,
  type IconProps,
} from '../../components/entries/EntryIcons'
import { CheckIcon, ExportIcon } from '../../components/icons'
import {
  activityFullLabel,
  entriesStudy,
  entryKindMeta,
  entryStats,
  exportCurrentUser,
  exportPreviewRows,
  previousExports,
  previewPrompt,
  previewTimestamp,
  type Entry,
  type ExportOptionId,
  type ExportRecord,
} from '../../fake/entries'
import { t, type EntriesKey } from '../../i18n/entries'
import '../../styles/entries.css'

type OptionDefinition = {
  id: ExportOptionId
  nameKey: EntriesKey
  descriptionKey: EntriesKey
  Icon: ComponentType<IconProps>
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

const previewColumns: { key: EntriesKey; className?: string }[] = [
  { key: 'export.column.participant' },
  { key: 'export.column.activity' },
  { key: 'export.column.prompt' },
  { key: 'export.column.type' },
  { key: 'export.column.content' },
  { key: 'export.column.recorded' },
  { key: 'export.column.received' },
  { key: 'export.column.tags' },
]

function previewContent(entry: Entry): string {
  if (entry.kind === 'text') {
    return entry.text ?? entry.excerpt
  }
  if (entry.kind === 'scale' && entry.scale) {
    return String(entry.scale.value)
  }
  return t('export.preview.noFile')
}

export default function ExportPage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? entriesStudy.id
  const base = `/estudos/${studyId}`

  const [scope, setScope] = useState<'all' | 'filtered'>('all')
  const [options, setOptions] = useState<Record<ExportOptionId, boolean>>({
    location: false,
    media: false,
    identity: false,
  })
  const [history, setHistory] = useState<ExportRecord[]>(previousExports)
  const [success, setSuccess] = useState(false)

  const count = scope === 'all' ? entryStats.total : 14
  const selectedIds = optionDefinitions
    .filter((option) => options[option.id])
    .map((option) => option.id)
  const selectedNames = optionDefinitions
    .filter((option) => options[option.id])
    .map((option) => t(option.nameKey))
  const optionsSummary =
    selectedNames.length === 0 ? t('export.summary.none') : selectedNames.join(', ')

  function toggleOption(id: ExportOptionId) {
    setOptions((current) => ({ ...current, [id]: !current[id] }))
    setSuccess(false)
  }

  function runExport() {
    const record: ExportRecord = {
      id: `x-${history.length + 1}`,
      who: exportCurrentUser,
      when: `9 out. ${entriesStudy.now}`,
      count,
      options: selectedIds,
      format: 'CSV',
    }
    setHistory((current) => [record, ...current])
    setSuccess(true)
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
              <label className={`en-scope-card${scope === 'all' ? ' is-selected' : ''}`}>
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  onChange={() => {
                    setScope('all')
                    setSuccess(false)
                  }}
                />
                <span className="en-radio" aria-hidden="true">
                  {scope === 'all' ? <i /> : null}
                </span>
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.all')}</span>
                  <span className="en-scope-meta">
                    {t('export.scope.allMeta', {
                      count: entryStats.total,
                      range: entriesStudy.dateRange,
                    })}
                  </span>
                </span>
              </label>
              <label className={`en-scope-card${scope === 'filtered' ? ' is-selected' : ''}`}>
                <input
                  className="en-visually-hidden"
                  type="radio"
                  name="export-scope"
                  checked={scope === 'filtered'}
                  onChange={() => {
                    setScope('filtered')
                    setSuccess(false)
                  }}
                />
                <span className="en-radio" aria-hidden="true">
                  {scope === 'filtered' ? <i /> : null}
                </span>
                <span className="en-scope-copy">
                  <span className="en-scope-name">{t('export.scope.filtered')}</span>
                  <span className="en-scope-meta">
                    {t('export.scope.filteredMeta', { count: 14 })}{' '}
                    <Link to={`${base}/registos`}>Registos</Link>.
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
                {t('export.format.csv')}
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
                  {exportPreviewRows.map((entry) => (
                    <tr key={entry.id}>
                      <td className="en-td mono">{entry.participantId}</td>
                      <td className="en-td">{activityFullLabel(entry.activityCode, entry.free)}</td>
                      <td className="en-td">{previewPrompt(entry)}</td>
                      <td className="en-td">{t(entryKindMeta[entry.kind].labelKey)}</td>
                      <td className="en-td en-export-content">{previewContent(entry)}</td>
                      <td className="en-td mono">{previewTimestamp(entry, 'recorded')}</td>
                      <td className="en-td mono">{previewTimestamp(entry, 'received')}</td>
                      <td className="en-td">{entry.tags.length ? entry.tags.join('; ') : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub">{t('export.preview.note')}</p>
          </section>

          <section className="card en-export-section en-export-options" aria-label={t('export.options.title')}>
            <div className="en-export-section-head">
              <span className="en-step">3</span>
              <div className="en-export-section-copy">
                <h2 className="h2">{t('export.options.title')}</h2>
                <span className="sub">{t('export.options.sub')}</span>
              </div>
            </div>
            {optionDefinitions.map((option) => {
              const Icon = option.Icon
              const on = options[option.id]
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
                  </div>
                  <div className="en-export-option-switch">
                    <span>{on ? t('export.option.on') : t('export.option.off')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
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

          <section className="card en-export-section en-export-history" aria-label={t('export.previous.title')}>
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
                {history.map((record) => (
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
                    <td className="en-td en-history-meta">{record.format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="card en-export-summary" aria-label={t('export.summary.title')}>
          <h2 className="h2">{t('export.summary.title')}</h2>
          <div className="en-summary-rows">
            <div>
              <span>{t('export.summary.entries')}</span>
              <b>{count}</b>
            </div>
            <div>
              <span>{t('export.summary.format')}</span>
              <b>CSV</b>
            </div>
            <div>
              <span>{t('export.summary.columns')}</span>
              <b>8</b>
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
              {t('export.success')}
            </p>
          ) : null}
          <button type="button" className="btn btn-dk en-export-button" onClick={runExport}>
            <ExportIcon width={20} height={20} />
            {t('export.button', { count })}
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
