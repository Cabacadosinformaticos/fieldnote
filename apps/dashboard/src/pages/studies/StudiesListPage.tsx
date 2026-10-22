import { useState } from 'react'
import { Link } from 'react-router-dom'
import StudyStatusPill from '../../components/studies/StudyStatusPill'
import { PlusIcon } from '../../components/studies/StudyIcons'
import { myStudies, type StudyMetricKind, type StudyStatus } from '../../fake/studies'
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
  adherence: 'list.metric.adherence',
  adherenceFinal: 'list.metric.adherenceFinal',
}

export default function StudiesListPage() {
  const [filter, setFilter] = useState<Filter>('all')

  const counts = {
    all: myStudies.length,
    ongoing: myStudies.filter((study) => study.status === 'ongoing').length,
    draft: myStudies.filter((study) => study.status === 'draft').length,
    finished: myStudies.filter((study) => study.status === 'finished').length,
  }

  const visible = filter === 'all' ? myStudies : myStudies.filter((study) => study.status === filter)

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

      <div className="st-study-list">
        {visible.map((study) => (
          <article className="st-study-card" key={study.id}>
            <div className="st-study-main">
              <div className="st-pill-row">
                <StudyStatusPill status={study.status} />
                <span className="st-tag">{t(`role.${study.role}`)}</span>
              </div>
              <h2 className="st-study-title">{study.title}</h2>
              <p className="st-study-description">{study.description}</p>
              <div className="st-study-meta">
                <span>{study.period}</span>
                <span>{study.schedule}</span>
              </div>
            </div>

            <div className="st-study-metrics">
              {study.metrics.map((metric) => (
                <div className="st-study-metric" key={metric.kind}>
                  <span className="st-metric-label">{t(metricLabel[metric.kind])}</span>
                  <span className="st-metric-value">{metric.value}</span>
                  <span className="st-metric-note">{metric.note}</span>
                </div>
              ))}
            </div>

            <div className="st-study-actions">
              {study.status === 'ongoing' ? (
                <>
                  <Link
                    className="st-btn st-btn-primary"
                    to={`/estudos/${study.id}/visao-geral`}
                  >
                    {t('list.openOverview')}
                  </Link>
                  <Link className="st-btn st-btn-ghost" to={`/estudos/${study.id}/registos`}>
                    {t('list.viewEntries')}
                  </Link>
                </>
              ) : null}

              {study.status === 'draft' ? (
                <Link className="st-btn st-btn-ghost" to="/estudos/novo">
                  {t('list.continueEditing')}
                </Link>
              ) : null}

              {study.status === 'finished' ? (
                <>
                  <Link
                    className="st-btn st-btn-ghost"
                    to={`/estudos/${study.id}/visao-geral`}
                  >
                    {t('list.viewResults')}
                  </Link>
                  <Link className="st-btn st-btn-ghost" to={`/estudos/${study.id}/exportar`}>
                    {t('list.exportData')}
                  </Link>
                </>
              ) : null}
            </div>
          </article>
        ))}

        {visible.length === 0 ? <p className="st-empty">{t('list.empty')}</p> : null}
      </div>
    </div>
  )
}
