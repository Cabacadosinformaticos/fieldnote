import { Link } from 'react-router-dom'
import { useStudies, type AdminStudy, type ScheduleStyle } from '../../api/admin'
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

const styleLabels: Record<ScheduleStyle, AdminKey> = {
  fixed: 'studies.style.fixed',
  balanced: 'studies.style.balanced',
  varied: 'studies.style.varied',
}

const roleLabel: Record<StudyRole, AdminKey> = {
  principal_investigator: 'studies.role.principal_investigator',
  co_investigator: 'studies.role.co_investigator',
  member: 'studies.role.member',
}

const DAY_MS = 86_400_000

function datesLabel(study: AdminStudy): string {
  if (!study.starts_on && !study.ends_on) {
    return t('studies.noDates')
  }
  return `${formatDateOnly(study.starts_on)} a ${formatDateOnly(study.ends_on)}`
}

function dateValue(value: string | null): number | null {
  if (!value) {
    return null
  }
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }
  return Date.UTC(year, month - 1, day)
}

function localToday(): number {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

function dateNote(study: AdminStudy): string {
  const start = dateValue(study.starts_on)
  const end = dateValue(study.ends_on)
  const today = localToday()
  if (study.status === 'running' && start !== null && end !== null && end >= start) {
    const total = Math.floor((end - start) / DAY_MS) + 1
    const day = Math.min(Math.max(Math.floor((today - start) / DAY_MS) + 1, 1), total)
    return t('studies.datesNote.dayOf', { day, total })
  }
  if (study.status === 'closed' && end !== null) {
    const days = Math.floor((today - end) / DAY_MS)
    if (days <= 0) {
      return t('studies.datesNote.finishedToday')
    }
    return days === 1
      ? t('studies.datesNote.finishedOne')
      : t('studies.datesNote.finishedDays', { days })
  }
  return t(stateMeta[study.status].noteKey)
}

function studyRef(id: string): string {
  return id.slice(0, 8)
}

function joinPt(parts: string[]): string {
  if (parts.length <= 1) {
    return parts.join('')
  }
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

function countLabel(count: number, one: AdminKey, other: AdminKey): string {
  return t(count === 1 ? one : other, { count })
}

function byStudy(studies: AdminStudy[], value: (study: AdminStudy) => number): string {
  return joinPt(
    studies
      .filter((study) => value(study) > 0)
      .map((study) =>
        t('studies.kpi.byStudy', {
          count: value(study).toLocaleString('pt-PT'),
          study: studyRef(study.id),
        }),
      ),
  )
}

function memberName(member: AdminStudy['team'][number]): string {
  return member.name?.trim() || member.email
}

function formatMetric(value: number): string {
  return value.toLocaleString('pt-PT')
}

function formatAdherence(study: AdminStudy): string {
  if (study.adherence_percentage === null) {
    return '-'
  }
  return `${study.adherence_percentage.toLocaleString('pt-PT', {
    maximumFractionDigits: 1,
  })} %`
}

function adherenceNote(study: AdminStudy): string {
  if (study.adherence_period === 'today') {
    return t('studies.adherence.today')
  }
  if (study.adherence_period === 'final') {
    return t('studies.adherence.final')
  }
  return t('studies.adherence.none')
}

export default function AdminStudiesPage() {
  const studiesQuery = useStudies()
  const studies = studiesQuery.data ?? []

  const running = studies.filter((study) => study.status === 'running').length
  const draft = studies.filter((study) => study.status === 'draft').length
  const closed = studies.filter((study) => study.status === 'closed').length
  const investigators = new Map(
    studies.flatMap((study) => study.team.map((member) => [member.user_id, memberName(member)])),
  )
  const participants = studies.reduce((total, study) => total + study.participants, 0)
  const entries = studies.reduce((total, study) => total + study.entries, 0)
  const participantsByStudy = byStudy(studies, (study) => study.participants)
  const entriesByStudy = byStudy(studies, (study) => study.entries)

  const kpis: { labelKey: AdminKey; value: string; note: string }[] = [
    {
      labelKey: 'studies.kpi.platform',
      value: String(studies.length),
      note: joinPt([
        countLabel(running, 'studies.count.runningOne', 'studies.count.runningOther'),
        countLabel(draft, 'studies.count.draftOne', 'studies.count.draftOther'),
        countLabel(closed, 'studies.count.closedOne', 'studies.count.closedOther'),
      ]),
    },
    {
      labelKey: 'studies.kpi.investigators',
      value: String(investigators.size),
      note:
        investigators.size > 0
          ? joinPt([...investigators.values()])
          : t('studies.kpi.investigatorsNote'),
    },
    {
      labelKey: 'studies.kpi.participants',
      value: formatMetric(participants),
      note: participantsByStudy || t('studies.kpi.participantsNote'),
    },
    {
      labelKey: 'studies.kpi.entries',
      value: formatMetric(entries),
      note: entriesByStudy || t('studies.kpi.entriesNote'),
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
            <span>{t('studies.col.adherence')}</span>
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
                      <span className="ad-study-meta">
                        <span className="ad-study-id ad-mono">{studyRef(study.id)}</span>
                        {` · ${t('studies.styleLabel')} ${t(styleLabels[study.schedule_style])}`}
                      </span>
                    </div>

                    <div>
                      <span className={`pill ${meta.pill} ad-state-pill`}>
                        <span className={`ad-state-dot ${meta.dot}`} aria-hidden="true" />
                        {t(meta.key)}
                      </span>
                    </div>

                    <div className="ad-stack">
                      <span className="ad-cell-strong">{datesLabel(study)}</span>
                      <span className="ad-cell-note">{dateNote(study)}</span>
                    </div>

                    <div className="ad-team">
                      {study.team.length === 0 ? (
                        <span className="ad-cell-muted">{t('studies.noTeam')}</span>
                      ) : (
                        study.team.map((member) => (
                          <span key={member.user_id} className="ad-team-line">
                            <strong>{memberName(member)}</strong>{' '}
                            <span className="ad-cell-muted">{t(roleLabel[member.role])}</span>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="ad-stack">
                      <span className="ad-metric">{formatMetric(study.participants)}</span>
                      <span className="ad-cell-note">
                        {t(
                          study.active_participants === 1
                            ? 'studies.peopleNote.one'
                            : 'studies.peopleNote.other',
                          { count: study.active_participants },
                        )}
                      </span>
                    </div>

                    <span className="ad-metric">{formatMetric(study.entries)}</span>

                    <div className="ad-stack">
                      <span className="ad-metric">{formatAdherence(study)}</span>
                      <span className="ad-cell-note">{adherenceNote(study)}</span>
                    </div>

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
