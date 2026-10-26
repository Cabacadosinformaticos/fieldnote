import { Link } from 'react-router-dom'
import { useStudies, type AdminStudy } from '../../api/admin'
import { formatDateOnly } from '../../components/admin/format'
import { LockIcon } from '../../components/admin/icons'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

type StudyStatus = AdminStudy['status']
type StudyRole = AdminStudy['team'][number]['role']

const stateMeta: Record<StudyStatus, { key: AdminKey; noteKey: AdminKey; pill: 'ok' | 'ne' | 'pr'; dot: string }> = {
  draft: { key: 'studies.state.draft', noteKey: 'studies.datesNote.draft', pill: 'ne', dot: '' },
  running: {
    key: 'studies.state.running',
    noteKey: 'studies.datesNote.running',
    pill: 'ok',
    dot: 'is-active',
  },
  closed: {
    key: 'studies.state.closed',
    noteKey: 'studies.datesNote.closed',
    pill: 'pr',
    dot: 'is-finished',
  },
}

const roleLabel: Record<StudyRole, AdminKey> = {
  principal_investigator: 'studies.role.principal_investigator',
  co_investigator: 'studies.role.co_investigator',
  member: 'studies.role.member',
}

function datesLabel(study: AdminStudy): string {
  if (!study.starts_on && !study.ends_on) {
    return t('studies.noDates')
  }
  return `${formatDateOnly(study.starts_on)} a ${formatDateOnly(study.ends_on)}`
}

export default function AdminStudiesPage() {
  const studiesQuery = useStudies()
  const studies = studiesQuery.data ?? []

  const running = studies.filter((study) => study.status === 'running').length
  const draft = studies.filter((study) => study.status === 'draft').length
  const closed = studies.filter((study) => study.status === 'closed').length
  const investigators = new Set(studies.flatMap((study) => study.team.map((member) => member.user_id)))
  const participants = studies.reduce((total, study) => total + study.participants, 0)
  const entries = studies.reduce((total, study) => total + study.entries, 0)

  const kpis: { labelKey: AdminKey; value: string; note: string }[] = [
    {
      labelKey: 'studies.kpi.platform',
      value: String(studies.length),
      note: t('studies.kpi.platformNote', { running, draft, closed }),
    },
    {
      labelKey: 'studies.kpi.investigators',
      value: String(investigators.size),
      note: t('studies.kpi.investigatorsNote'),
    },
    {
      labelKey: 'studies.kpi.participants',
      value: String(participants),
      note: t('studies.kpi.participantsNote'),
    },
    {
      labelKey: 'studies.kpi.entries',
      value: String(entries),
      note: t('studies.kpi.entriesNote'),
    },
  ]

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('studies.title')}</h1>
          <p className="ad-subtitle">{t('studies.subtitle')}</p>
        </div>
      </header>

      <section className="ad-kpis" aria-label={t('studies.title')}>
        {kpis.map((kpi) => (
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
            <span />
          </div>

          {studiesQuery.isPending ? (
            <div className="ad-empty" aria-busy="true">
              {t('studies.loading')}
            </div>
          ) : null}

          {studiesQuery.isError ? (
            <div className="ad-empty">
              <p>{t('studies.loadError')}</p>
              <button type="button" className="ad-btn-sm" onClick={() => void studiesQuery.refetch()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {!studiesQuery.isPending && !studiesQuery.isError
            ? studies.map((study) => {
                const meta = stateMeta[study.status]
                return (
                  <div key={study.id} className="ad-studies-grid ad-studies-row">
                    <div className="ad-study-identity">
                      <span className="ad-study-title">{study.title}</span>
                      {study.owner_email ? (
                        <span className="ad-study-meta">{study.owner_email}</span>
                      ) : null}
                    </div>

                    <div>
                      <span className={`pill ${meta.pill} ad-state-pill`}>
                        <span className={`ad-state-dot ${meta.dot}`} aria-hidden="true" />
                        {t(meta.key)}
                      </span>
                    </div>

                    <div className="ad-stack">
                      <span className="ad-cell-strong">{datesLabel(study)}</span>
                      <span className="ad-cell-note">{t(meta.noteKey)}</span>
                    </div>

                    <div className="ad-team">
                      {study.team.length === 0 ? (
                        <span className="ad-cell-muted">{t('studies.noTeam')}</span>
                      ) : (
                        study.team.map((member) => (
                          <span key={member.user_id} className="ad-team-line">
                            <strong>{member.email}</strong>{' '}
                            <span className="ad-cell-muted">{t(roleLabel[member.role])}</span>
                          </span>
                        ))
                      )}
                    </div>

                    <span className="ad-metric">{study.participants}</span>

                    <span className="ad-metric">{study.entries}</span>

                    <div className="ad-row-end">
                      <Link
                        className="ad-btn-sm"
                        to={`/estudos/${study.id}/visao-geral`}
                        aria-label={t('studies.openAria', { title: study.title })}
                      >
                        {t('studies.open')}
                      </Link>
                    </div>
                  </div>
                )
              })
            : null}

          {!studiesQuery.isPending && !studiesQuery.isError && studies.length === 0 ? (
            <div className="ad-empty">{t('studies.empty')}</div>
          ) : null}
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
