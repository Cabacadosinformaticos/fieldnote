import { Link } from 'react-router-dom'
import { LockIcon } from '../../components/admin/icons'
import { adminStudies, studyKpis, type AdminStudyState } from '../../fake/admin'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

const stateLabel: Record<
  AdminStudyState,
  { key: AdminKey; pill: 'ok' | 'ne' | 'pr'; dot: string }
> = {
  ongoing: { key: 'studies.state.ongoing', pill: 'ok', dot: 'is-active' },
  draft: { key: 'studies.state.draft', pill: 'ne', dot: '' },
  finished: { key: 'studies.state.finished', pill: 'pr', dot: 'is-finished' },
}

export default function AdminStudiesPage() {
  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('studies.title')}</h1>
          <p className="ad-subtitle">{t('studies.subtitle')}</p>
        </div>
      </header>

      <section className="ad-kpis" aria-label={t('studies.title')}>
        {studyKpis.map((kpi) => (
          <div key={kpi.labelKey} className="ad-kpi">
            <span className="ad-kpi-label">{t(kpi.labelKey)}</span>
            <span className="ad-kpi-value">{kpi.value}</span>
            <span className="ad-kpi-note">{kpi.note}</span>
          </div>
        ))}
      </section>

      <section className="ad-table-card" aria-label={t('studies.title')}>
        <div className="ad-table-scroll">
          <div className="ad-studies-grid ad-table-head">
            <span>{t('studies.col.study')}</span>
            <span>{t('studies.col.state')}</span>
            <span>{t('studies.col.dates')}</span>
            <span>{t('studies.col.team')}</span>
            <span>{t('studies.col.participants')}</span>
            <span>{t('studies.col.entries')}</span>
            <span>{t('studies.col.adherence')}</span>
            <span />
          </div>

          {adminStudies.map((study) => {
            const meta = stateLabel[study.state]
            return (
              <div key={study.id} className="ad-studies-grid ad-studies-row">
                <div className="ad-study-identity">
                  <span className="ad-study-title">{study.title}</span>
                  <span className="ad-study-meta">
                    <span className="ad-mono ad-study-id">{study.id}</span> ·{' '}
                    {t('studies.style', { style: study.style })}
                  </span>
                </div>

                <div>
                  <span className={`pill ${meta.pill} ad-state-pill`}>
                    <span className={`ad-state-dot ${meta.dot}`} aria-hidden="true" />
                    {t(meta.key)}
                  </span>
                </div>

                <div className="ad-stack">
                  <span className="ad-cell-strong">{study.dates}</span>
                  <span className="ad-cell-note">{study.datesNote}</span>
                </div>

                <div className="ad-team">
                  {study.team.map((member) => (
                    <span key={member.name} className="ad-team-line">
                      <strong>{member.name}</strong>{' '}
                      <span className="ad-cell-muted">{member.role}</span>
                    </span>
                  ))}
                </div>

                <div className="ad-stack">
                  <span className="ad-metric">{study.people}</span>
                  <span className="ad-cell-note">{study.peopleNote}</span>
                </div>

                <span className="ad-metric">{study.entries}</span>

                <div className="ad-stack">
                  <span className="ad-metric">{study.adherence}</span>
                  <span className="ad-cell-note">{study.adherenceNote}</span>
                </div>

                <div className="ad-row-end">
                  <Link
                    className="ad-btn-sm"
                    to={`/estudos/${study.slug}/visao-geral`}
                    aria-label={t('studies.openAria', { title: study.title })}
                  >
                    {t('studies.open')}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="ad-info-card">
        <LockIcon />
        <div>
          <h2 className="ad-info-title">{t('studies.identityTitle')}</h2>
          <p className="ad-info-text">{t('studies.identityText')}</p>
        </div>
      </section>
    </div>
  )
}
