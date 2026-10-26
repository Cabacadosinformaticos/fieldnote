import { useState } from 'react'
import { Link } from 'react-router-dom'
import StudyStatusPill from '../../components/studies/StudyStatusPill'
import { PlusIcon } from '../../components/studies/StudyIcons'
import {
  studiesErrorMessage,
  useStudies,
  useStudyCard,
  type Study,
  type StudyMetricKind,
  type StudyStatus,
} from '../../api/studies'
import { t, type StudiesKey } from '../../i18n/studies'
import '../../styles/studies.css'

type Filter = 'all' | StudyStatus

const filters: { id: Filter; labelKey: StudiesKey }[] = [
  { id: 'all', labelKey: 'list.filter.all' },
  { id: 'ongoing', labelKey: 'status.ongoing' },
  { id: 'draft', labelKey: 'status.draft' },
  { id: 'finished', labelKey: 'status.finished' },
]

const metricLabel: Record<StudyMetricKind, StudiesKey> = {
  participants: 'list.metric.participants',
  entries: 'list.metric.entries',
  activities: 'list.metric.activities',
}

function StudyCard({ study }: { study: Study }) {
  const summary = useStudyCard(study)

  return (
    <article className="st-study-card">
      <div className="st-study-main">
        <div className="st-pill-row">
          <StudyStatusPill status={summary.status} />
          {summary.role ? (
            <span className="st-tag">{t(`role.${summary.role}`)}</span>
          ) : null}
        </div>
        <h2 className="st-study-title">{summary.title}</h2>
        <p className="st-study-description">{summary.description}</p>
        <div className="st-study-meta">
          <span>{summary.period}</span>
          <span>{summary.schedule}</span>
        </div>
      </div>

      <div className="st-study-metrics">
        {summary.metrics.map((metric) => (
          <div className="st-study-metric" key={metric.kind}>
            <span className="st-metric-label">{t(metricLabel[metric.kind])}</span>
            <span className="st-metric-value">{metric.value}</span>
            <span className="st-metric-note">{metric.note}</span>
          </div>
        ))}
      </div>

      <div className="st-study-actions">
        {summary.status === 'ongoing' ? (
          <>
            <Link className="st-btn st-btn-primary" to={`/estudos/${summary.id}/visao-geral`}>
              {t('list.openOverview')}
            </Link>
            <Link className="st-btn st-btn-ghost" to={`/estudos/${summary.id}/registos`}>
              {t('list.viewEntries')}
            </Link>
          </>
        ) : null}

        {summary.status === 'draft' ? (
          <Link className="st-btn st-btn-ghost" to={`/estudos/${summary.id}/visao-geral`}>
            {t('list.openOverview')}
          </Link>
        ) : null}

        {summary.status === 'finished' ? (
          <>
            <Link className="st-btn st-btn-ghost" to={`/estudos/${summary.id}/visao-geral`}>
              {t('list.viewResults')}
            </Link>
            <Link className="st-btn st-btn-ghost" to={`/estudos/${summary.id}/exportar`}>
              {t('list.exportData')}
            </Link>
          </>
        ) : null}
      </div>
    </article>
  )
}

export default function StudiesListPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const studiesQuery = useStudies()
  const studies = studiesQuery.data ?? []

  const counts = {
    all: studies.length,
    ongoing: studies.filter((study) => study.status === 'running').length,
    draft: studies.filter((study) => study.status === 'draft').length,
    finished: studies.filter((study) => study.status === 'closed').length,
  }

  const visible =
    filter === 'all'
      ? studies
      : studies.filter((study) =>
          filter === 'ongoing'
            ? study.status === 'running'
            : filter === 'draft'
              ? study.status === 'draft'
              : study.status === 'closed',
        )

  return (
    <div className="st-page">
      <header className="st-page-header st-page-header-split">
        <div className="st-header-copy">
          <h1 className="st-title">{t('list.title')}</h1>
          <p className="st-subtitle">
            {t('list.subtitle', {
              count: counts.all,
              ongoing: counts.ongoing,
              draft: counts.draft,
              finished: counts.finished,
            })}
          </p>
        </div>
        <Link className="st-btn st-btn-primary st-btn-lg" to="/estudos/novo">
          <PlusIcon />
          {t('list.newStudy')}
        </Link>
      </header>

      <div className="st-tabs" role="tablist" aria-label={t('list.filter.label')}>
        {filters.map((item) => {
          const active = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'st-tab st-tab-active' : 'st-tab'}
              onClick={() => setFilter(item.id)}
            >
              {t(item.labelKey)}
              <span className="st-tab-count">{counts[item.id]}</span>
            </button>
          )
        })}
      </div>

      {studiesQuery.error ? (
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(studiesQuery.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void studiesQuery.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      <div className="st-study-list">
        {studiesQuery.isLoading ? <p className="st-empty">{t('state.loading')}</p> : null}
        {visible.map((study) => (
          <StudyCard study={study} key={study.id} />
        ))}
        {!studiesQuery.isLoading && !studiesQuery.error && visible.length === 0 ? (
          <p className="st-empty">{t('list.empty')}</p>
        ) : null}
      </div>
    </div>
  )
}
