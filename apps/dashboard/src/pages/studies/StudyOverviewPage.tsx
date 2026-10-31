import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckIcon, ExportIcon } from '../../components/icons'
import EntryThumb from '../../components/studies/EntryThumb'
import StudyStatusPill from '../../components/studies/StudyStatusPill'
import {
  FileTextIcon,
  StopIcon,
  UserIcon,
  UsersIcon,
} from '../../components/studies/StudyIcons'
import {
  shortDateLabel,
  statusFromApi,
  studiesErrorMessage,
  studyDay,
  studyRange,
  timeLabel,
  useCloseStudy,
  useStudy,
  useStudyOverview,
  useStudyRole,
  type EntryKind,
  type FeedItem,
  type OverviewAlert,
} from '../../api/studies'
import { t, type StudiesKey } from '../../i18n/studies'
import '../../styles/studies.css'

const entryTypeKeys: Record<
  'text' | 'photo' | 'video' | 'audio' | 'scale' | 'choice',
  StudiesKey
> = {
  photo: 'overview.entryType.photo',
  text: 'overview.entryType.text',
  video: 'overview.entryType.video',
  audio: 'overview.entryType.audio',
  scale: 'overview.entryType.scale',
  choice: 'overview.entryType.choice',
}

// Every prompt already sent, whatever became of it: the denominator of adherence.
function promptsOut(adherence: { answered: number; sent: number; expired: number }): number {
  return adherence.answered + adherence.sent + adherence.expired
}

function entryKind(entryType: keyof typeof entryTypeKeys): EntryKind {
  if (entryType === 'photo') {
    return 'photo'
  }
  if (entryType === 'text' || entryType === 'scale' || entryType === 'choice') {
    return 'text'
  }
  return 'audio'
}

function percentLabel(answered: number, sent: number): string {
  if (sent === 0) {
    return '–'
  }
  return `${Math.round((answered * 100) / sent)} %`
}

function alertTitle(alert: OverviewAlert): string {
  if (alert.kind === 'pending_approval') {
    return t('overview.attention.approvalsTitle', { count: 1 })
  }
  return t('overview.attention.inactiveTitle', { alias: alert.alias ?? '–' })
}

function alertDetail(alert: OverviewAlert, timezone: string): string {
  if (alert.kind === 'pending_approval') {
    return t('overview.attention.approvalsDetail')
  }
  if (!alert.last_entry_at) {
    return t('overview.attention.inactiveNoEntries')
  }
  return t('overview.attention.inactiveDetail', {
    last: timeLabel(alert.last_entry_at, timezone),
  })
}

export default function StudyOverviewPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const studyQuery = useStudy(studyId)
  const overviewQuery = useStudyOverview(studyId)
  const access = useStudyRole(studyId)
  const closeStudy = useCloseStudy(studyId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const study = studyQuery.data
  const overview = overviewQuery.data
  const timezone = overview?.timezone ?? study?.timezone ?? 'Europe/Lisbon'
  const isLoading = (studyQuery.isLoading && !study) || (overviewQuery.isLoading && !overview)
  const error = studyQuery.error ?? overviewQuery.error

  if (isLoading) {
    return (
      <div className="st-page">
        <p className="st-empty">{t('state.loading')}</p>
      </div>
    )
  }

  if (!study || !overview) {
    return (
      <div className="st-page">
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => {
              void studyQuery.refetch()
              void overviewQuery.refetch()
            }}
          >
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const status = statusFromApi(study.status)
  const canClose = access.canManage && status === 'ongoing'
  const { day, total } = studyDay(study, overview.date)
  const dateLabel = shortDateLabel(overview.date, timezone).replace(/^\w/, (character) =>
    character.toUpperCase(),
  )
  const today = overview.adherence_today
  const allTime = overview.adherence_study
  const pendingAlerts = overview.alerts?.filter((alert) => alert.kind === 'pending_approval') ?? []
  const staleAlerts = overview.alerts?.filter((alert) => alert.kind === 'no_entries') ?? []
  const alertCount = overview.alerts?.length ?? 0

  const feed: FeedItem[] = (overview.last_entries ?? []).slice(0, 6).map((entry) => {
    const delayMinutes = Math.max(
      0,
      Math.round((Date.parse(entry.received_at) - Date.parse(entry.recorded_at)) / 60_000),
    )
    return {
      alias: entry.participant_alias ?? '–',
      type: t(entryTypeKeys[entry.entry_type]),
      activity: entry.activity_title ?? t('overview.feed.noActivity'),
      recorded: timeLabel(entry.recorded_at, timezone),
      received: timeLabel(entry.received_at, timezone),
      delay:
        delayMinutes >= 60
          ? `${Math.floor(delayMinutes / 60)} h ${String(delayMinutes % 60).padStart(2, '0')} min`
          : `${delayMinutes} min`,
      late: delayMinutes > 5,
      kind: entryKind(entry.entry_type),
    }
  })

  return (
    <div className="st-page">
      <header className="st-overview-header">
        <div className="st-header-copy">
          <div className="st-overview-title-row">
            <h1 className="st-title st-title-h1">{study.title}</h1>
            <StudyStatusPill status={status} />
          </div>
          <div className="st-overview-meta">
            {total > 0 ? (
              <strong className="st-overview-day">
                {t('overview.dayOf', { day, total })}
              </strong>
            ) : null}
            {total > 0 ? (
              <span
                className="st-day-strip"
                role="img"
                aria-label={t('overview.dayStripAria', { day, total })}
              >
                {Array.from({ length: total }, (_, index) => (
                  <span
                    key={index}
                    className={
                      index < day - 1
                        ? 'st-day st-day-done'
                        : index === day - 1
                          ? 'st-day st-day-current'
                          : 'st-day'
                    }
                  />
                ))}
              </span>
            ) : null}
            <span>{t('overview.range', {
              range: studyRange(study),
              participants: t('common.participantCount', {
                count: overview.participants.total,
              }),
            })}</span>
            <span>{dateLabel}</span>
          </div>
        </div>

        <div className="st-header-actions">
          <Link className="st-btn st-btn-primary" to={`/estudos/${study.id}/registos`}>
            <FileTextIcon />
            {t('overview.viewEntries')}
          </Link>
          <Link className="st-btn st-btn-ghost" to={`/estudos/${study.id}/exportar`}>
            <ExportIcon width={18} height={18} />
            {t('overview.export')}
          </Link>
          {canClose ? (
            <button
              type="button"
              className="st-btn st-btn-danger"
              aria-haspopup="dialog"
              onClick={() => setDialogOpen(true)}
            >
              <StopIcon />
              {t('overview.endStudy')}
            </button>
          ) : null}
        </div>
      </header>

      {status === 'finished' ? (
        <div className="st-note st-note-success" role="status">
          <CheckIcon width={18} height={18} />
          <span>{t('overview.ended')}</span>
        </div>
      ) : null}

      {error ? (
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => {
              void studyQuery.refetch()
              void overviewQuery.refetch()
            }}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      <section className="st-indicators" aria-label={t('overview.indicatorsAria')}>
        <div className="st-kpi st-kpi-primary">
          <div className="st-kpi-copy">
            <span className="st-kpi-label st-kpi-label-primary">{t('overview.adherenceToday')}</span>
            <span className="st-kpi-hero">{percentLabel(today.answered, promptsOut(today))}</span>
            <span className="st-kpi-note">
              {t('overview.adherenceNote', { answered: today.answered, sent: promptsOut(today) })}
            </span>
          </div>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.entries')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{overview.entries.total}</span>
            <span className="st-badge-up">
              {t('overview.entriesToday', { count: overview.entries.today })}
            </span>
          </span>
          <span className="st-kpi-note">
            {t('overview.entriesNote', {
              answered: overview.entries.today_answered,
              free: overview.entries.today_free,
            })}
          </span>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.activeParticipants')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{overview.participants.active}</span>
            <span className="st-kpi-sub">
              {t('overview.activeOf', { total: overview.participants.total })}
            </span>
          </span>
          <span className="st-kpi-note">
            {t('overview.activeNote', {
              invites: overview.participants.pending_approval,
              declined: overview.participants.declined,
            })}
          </span>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.studyAdherence')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{percentLabel(allTime.answered, promptsOut(allTime))}</span>
          </span>
          <span className="st-kpi-note">
            {t('overview.adherenceStudyNote', {
              answered: allTime.answered,
              sent: promptsOut(allTime),
            })}
          </span>
        </div>
      </section>

      <div className="st-grid-2 st-grid-stretch">
        <section className="card st-attention-card" aria-labelledby="h-atencao">
          <div className="st-card-head st-card-head-spaced">
            <h2 className="h2" id="h-atencao">
              {t('overview.attention.title')}
            </h2>
            <span className="st-count-warning">
              {t('overview.attention.points', { count: alertCount })}
            </span>
          </div>
          <div className="st-attention-list">
            {pendingAlerts.length > 0 ? (
              <div className="st-attention-row">
                <span className="st-attention-icon st-tone-warning" aria-hidden="true">
                  <UsersIcon />
                </span>
                <span className="st-attention-copy">
                  <span className="st-attention-title">
                    {t('overview.attention.approvalsTitle', { count: pendingAlerts.length })}
                  </span>
                  <span className="st-attention-detail">
                    {t('overview.attention.approvalsDetail')}
                  </span>
                </span>
                <Link
                  className="st-btn st-btn-ghost st-btn-xs"
                  to={`/estudos/${study.id}/participantes`}
                >
                  {t('overview.attention.review')}
                </Link>
              </div>
            ) : null}

            {staleAlerts.slice(0, 4).map((alert) => (
              <div className="st-attention-row" key={alert.participant_id}>
                <span className="st-attention-icon st-tone-warning" aria-hidden="true">
                  <UserIcon />
                </span>
                <span className="st-attention-copy">
                  <span className="st-attention-title">{alertTitle(alert)}</span>
                  <span className="st-attention-detail">{alertDetail(alert, timezone)}</span>
                </span>
                <Link
                  className="st-btn st-btn-ghost st-btn-xs"
                  to={`/estudos/${study.id}/participantes`}
                >
                  {t('overview.attention.viewParticipant')}
                </Link>
              </div>
            ))}

            {alertCount === 0 ? (
              <p className="st-empty">{t('overview.attention.empty')}</p>
            ) : null}
          </div>
        </section>

        <section className="card" aria-labelledby="h-adesao-resumo">
          <div className="st-card-head st-card-head-spaced">
            <h2 className="h2" id="h-adesao-resumo">
              {t('overview.adherence.title')}
            </h2>
            <span className="st-muted-small">{dateLabel}</span>
          </div>

          <div className="st-mini-stats">
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.adherenceToday')}</span>
              <span className="st-mini-stat-value">
                {percentLabel(today.answered, promptsOut(today))}
              </span>
              <span className="st-mini-stat-note">
                {t('overview.adherenceNote', { answered: today.answered, sent: promptsOut(today) })}
              </span>
            </div>
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.studyAdherence')}</span>
              <span className="st-mini-stat-value">
                {percentLabel(allTime.answered, promptsOut(allTime))}
              </span>
              <span className="st-mini-stat-note">
                {t('overview.adherenceStudyNote', {
                  answered: allTime.answered,
                  sent: promptsOut(allTime),
                })}
              </span>
            </div>
          </div>

          <div className="st-plan-stats">
            <div className="st-plan-stat">
              <span className="st-plan-stat-label">{t('overview.prompts.answered')}</span>
              <span className="st-plan-stat-value">{today.answered}</span>
              <span className="st-plan-stat-note">
                {t('overview.inStudy')}: {allTime.answered}
              </span>
            </div>
            <div className="st-plan-stat">
              <span className="st-plan-stat-label">{t('overview.prompts.sent')}</span>
              <span className="st-plan-stat-value">{today.sent}</span>
              <span className="st-plan-stat-note">
                {t('overview.inStudy')}: {allTime.sent}
              </span>
            </div>
            <div className="st-plan-stat">
              <span className="st-plan-stat-label">{t('overview.prompts.expired')}</span>
              <span className="st-plan-stat-value">{today.expired}</span>
              <span className="st-plan-stat-note">
                {t('overview.inStudy')}: {allTime.expired}
              </span>
            </div>
            <div className="st-plan-stat">
              <span className="st-plan-stat-label">{t('overview.prompts.planned')}</span>
              <span className="st-plan-stat-value">{today.planned}</span>
              <span className="st-plan-stat-note">
                {t('overview.inStudy')}: {allTime.planned}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="st-grid-adherence">
        <section className="card st-feed-card" aria-labelledby="h-feed">
          <div className="st-card-head st-card-head-spaced">
            <h2 className="h2" id="h-feed">
              {t('overview.feed.title')}
            </h2>
            <span className="st-live">
              <span className="st-status-dot" aria-hidden="true" />
              {t('overview.feed.live')}
            </span>
          </div>

          <div className="st-feed-list">
            {feed.map((item, index) => (
              <div className="st-feed-row" key={`${item.alias}-${item.recorded}-${index}`}>
                <EntryThumb item={item} />
                <div className="st-feed-copy">
                  <span className="st-feed-title">
                    <span className="mono">{item.alias}</span> · {item.type}
                  </span>
                  <span className="st-feed-activity">{item.activity}</span>
                  <span className="st-feed-time mono">
                    {t('overview.feed.recorded', {
                      recorded: item.recorded,
                      received: item.received,
                    })}
                  </span>
                  {item.late ? (
                    <span className="st-feed-late">
                      {t('overview.feed.late', { delay: item.delay })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {feed.length === 0 ? <p className="st-empty">{t('overview.feed.empty')}</p> : null}
          </div>

          <Link className="st-link st-link-sm" to={`/estudos/${study.id}/registos`}>
            {t('overview.feed.viewAll')}
          </Link>
        </section>

        <section className="card" aria-labelledby="h-participantes">
          <div className="st-card-head st-card-head-spaced">
            <h2 className="h2" id="h-participantes">
              {t('overview.activeParticipants')}
            </h2>
            <Link className="st-link st-link-sm" to={`/estudos/${study.id}/participantes`}>
              {t('overview.adherence.viewParticipants', {
                count: overview.participants.total,
              })}
            </Link>
          </div>

          <div className="st-mini-stats">
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.activeParticipants')}</span>
              <span className="st-mini-stat-value">{overview.participants.active}</span>
            </div>
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.participants.pending')}</span>
              <span className="st-mini-stat-value">{overview.participants.pending_approval}</span>
            </div>
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.participants.declined')}</span>
              <span className="st-mini-stat-value">{overview.participants.declined}</span>
            </div>
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.participants.left')}</span>
              <span className="st-mini-stat-value">
                {overview.participants.withdrawn + overview.participants.removed}
              </span>
            </div>
          </div>
        </section>
      </div>

      {dialogOpen ? (
        <div className="st-modal-backdrop" onClick={() => setDialogOpen(false)}>
          <div
            className="st-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-study-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="h2" id="end-study-title">
              {t('overview.endDialog.title')}
            </h2>
            <p className="sub">{t('overview.endDialog.body')}</p>
            {closeStudy.error ? (
              <p className="st-note st-note-error" role="alert">
                {studiesErrorMessage(closeStudy.error)}
              </p>
            ) : null}
            <div className="st-modal-actions">
              <button
                type="button"
                className="st-btn st-btn-ghost"
                onClick={() => setDialogOpen(false)}
                disabled={closeStudy.isPending}
              >
                {t('overview.endDialog.cancel')}
              </button>
              <button
                type="button"
                className="st-btn st-btn-danger-solid"
                disabled={closeStudy.isPending}
                onClick={() =>
                  closeStudy.mutate(undefined, {
                    onSuccess: () => setDialogOpen(false),
                  })
                }
              >
                {closeStudy.isPending
                  ? t('overview.endDialog.pending')
                  : t('overview.endDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
