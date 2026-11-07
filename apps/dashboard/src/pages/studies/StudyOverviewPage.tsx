import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckIcon, ExportIcon } from '../../components/icons'
import EntryThumb from '../../components/studies/EntryThumb'
import StudyStatusPill from '../../components/studies/StudyStatusPill'
import {
  formatDateRange,
  formatDayMonth,
  formatDayMonthYear,
  formatWeekdayDayMonth,
} from '../../components/studies/format'
import {
  FileTextIcon,
  StopIcon,
  UserIcon,
  UsersIcon,
} from '../../components/studies/StudyIcons'
import {
  clockInTimezone,
  dateInTimezone,
  nowClockInTimezone,
  statusFromApi,
  studiesErrorMessage,
  studyDay,
  studyKeys,
  timeLabel,
  useCloseStudy,
  useStudy,
  useStudyOverview,
  useStudyPlan,
  useStudyRole,
  type EntryKind,
  type FeedItem,
  type OverviewAlert,
  type StudyPlan,
} from '../../api/studies'
import { participantStatusMeta, useParticipants } from '../../api/participants'
import { useActivities, useStudyLiveRefresh, type EntryType } from '../../api/entries'
import {
  promptCell,
  promptsForParticipant,
  useOverviewDays,
} from '../../components/overview/useOverviewDays'
import { useEntryBreakdowns } from '../../components/overview/useEntryBreakdowns'
import { t, type StudiesKey } from '../../i18n/studies'
import { t as participantT } from '../../i18n/participants'
import '../../styles/studies.css'

const entryTypeKeys: Record<EntryType, StudiesKey> = {
  photo: 'overview.entryType.photo',
  text: 'overview.entryType.text',
  video: 'overview.entryType.video',
  audio: 'overview.entryType.audio',
  scale: 'overview.entryType.scale',
  choice: 'overview.entryType.choice',
}

const typeNameKeys: Record<EntryType, StudiesKey> = {
  photo: 'overview.type.photo',
  text: 'overview.type.text',
  video: 'overview.type.video',
  audio: 'overview.type.audio',
  scale: 'overview.type.scale',
  choice: 'overview.type.choice',
}

const typeColors: Record<EntryType, string> = {
  photo: '#1E3FB0',
  text: '#6C8CF0',
  audio: '#FFB020',
  video: '#9A5700',
  scale: '#8A93A8',
  choice: '#4A72EC',
}

const chartHours = Array.from({ length: 14 }, (_, index) => index + 8)

// Every prompt already sent, whatever became of it: the denominator of adherence.
function promptsOut(adherence: { answered: number; sent: number; expired: number }): number {
  return adherence.answered + adherence.sent + adherence.expired
}

function entryKind(entryType: EntryType): EntryKind {
  if (entryType === 'photo') {
    return 'photo'
  }
  if (entryType === 'text' || entryType === 'scale' || entryType === 'choice') {
    return 'text'
  }
  if (entryType === 'video') {
    return 'video'
  }
  return 'audio'
}

function percentLabel(answered: number, sent: number): string {
  if (sent === 0) {
    return '–'
  }
  return `${Math.round((answered * 100) / sent)} %`
}

function percentValue(answered: number, sent: number): number {
  return sent === 0 ? 0 : Math.round((answered * 100) / sent)
}

function planTotals(plan: StudyPlan | undefined): { answered: number; sent: number } {
  let answered = 0
  let sent = 0
  for (const prompt of plan?.prompts ?? []) {
    if (prompt.status === 'planned' || prompt.status === 'unplanned') {
      continue
    }
    sent += 1
    if (prompt.status === 'answered') {
      answered += 1
    }
  }
  return { answered, sent }
}

function adherenceTier(cell: { answered: number; sent: number } | null) {
  if (!cell || cell.sent === 0) {
    return { text: '–', className: 'st-acell st-acell-none', title: t('overview.adherence.tierNone') }
  }

  const ratio = cell.answered / cell.sent
  const className =
    cell.answered === 0
      ? 'st-acell st-acell-zero'
      : ratio >= 0.75
        ? 'st-acell st-acell-high'
        : ratio >= 0.5
          ? 'st-acell st-acell-medium'
          : 'st-acell st-acell-low'

  return {
    text: `${cell.answered}/${cell.sent}`,
    className,
    title: t('overview.adherence.cellAria', { answered: cell.answered, sent: cell.sent }),
  }
}

function alertTitle(alert: OverviewAlert): string {
  if (alert.kind === 'pending_approval') {
    return t('overview.attention.approvalsTitleOne')
  }
  return t('overview.attention.inactiveTitle', { alias: alert.alias ?? '–' })
}

function alertDetail(
  alert: OverviewAlert,
  lastEntryAt: string | null | undefined,
  timezone: string,
): string {
  if (alert.kind === 'pending_approval') {
    return t('overview.attention.approvalsDetail')
  }
  if (!lastEntryAt) {
    return t('overview.attention.inactiveNoEntries')
  }
  return t('overview.attention.inactiveDetail', {
    last: `${formatDayMonth(dateInTimezone(lastEntryAt, timezone))} ${timeLabel(
      lastEntryAt,
      timezone,
    )}`,
  })
}

export default function StudyOverviewPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const studyQuery = useStudy(studyId)
  const overviewQuery = useStudyOverview(studyId)
  const participantsQuery = useParticipants(studyId)
  const activitiesQuery = useActivities(studyId)
  const access = useStudyRole(studyId)
  const closeStudy = useCloseStudy(studyId)
  const [dialogOpen, setDialogOpen] = useState(false)

  const study = studyQuery.data
  const overview = overviewQuery.data
  const activities = activitiesQuery.data ?? []
  const todayPlanQuery = useStudyPlan(studyId, overview?.date)
  const todayPlan = todayPlanQuery.data
  const days = useOverviewDays(studyId, study, overview?.date)
  const breakdowns = useEntryBreakdowns(studyId, activities)
  useStudyLiveRefresh(studyId, [studyKeys.all])

  const timezone = overview?.timezone ?? study?.timezone ?? 'Europe/Lisbon'
  const daysLoading = days.some((day) => day.isLoading)
  const isLoading =
    (studyQuery.isLoading && !study) ||
    (overviewQuery.isLoading && !overview) ||
    (participantsQuery.isLoading && !participantsQuery.data) ||
    (activitiesQuery.isLoading && !activitiesQuery.data) ||
    (todayPlanQuery.isLoading && !todayPlan) ||
    daysLoading
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
  const dateLabel = formatWeekdayDayMonth(overview.date, timezone).replace(/^\w/, (character) =>
    character.toUpperCase(),
  )
  const periodEnded = study.ends_on !== null && overview.date > study.ends_on
  const now = nowClockInTimezone(timezone)
  const currentTime = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`
  const today = overview.adherence_today
  const pendingAlerts = overview.alerts?.filter((alert) => alert.kind === 'pending_approval') ?? []
  const staleAlerts = overview.alerts?.filter((alert) => alert.kind === 'no_entries') ?? []
  const staleIds = new Set(staleAlerts.map((alert) => alert.participant_id))
  // The overview reports recorded_at; the participants list reports the arrival
  // (received_at). Prefer the latter so both pages show the same last record.
  const lastEntryById = new Map(
    (participantsQuery.data ?? []).map((participant) => [
      participant.id,
      participant.last_entry_at,
    ]),
  )
  const alertCount = overview.alerts?.length ?? 0
  const shownAlertCount = pendingAlerts.length + Math.min(staleAlerts.length, 4)
  const remainingAlerts = Math.max(0, alertCount - shownAlertCount)

  const answeredToday = today.answered
  const openToday = today.sent
  const expiredToday = today.expired
  const sentToday = promptsOut(today)
  const shownToday = today.shown ?? 0
  const openedToday = today.opened ?? 0
  const plannedToday = sentToday + today.planned
  const unplannedToday =
    todayPlan?.prompts.filter((prompt) => prompt.status === 'unplanned').length ?? 0
  const expectedToday = plannedToday + unplannedToday

  const trendDays = days.filter((item) => item.plan !== undefined).slice(-4)
  const trendValues = trendDays.map((item) => {
    const totals = planTotals(item.plan)
    return {
      date: item.date,
      label:
        item.date === overview.date
          ? t('overview.trend.today')
          : t('overview.trend.day', { day: item.dayNumber }),
      text: percentLabel(totals.answered, totals.sent),
      percent: percentValue(totals.answered, totals.sent),
    }
  })
  const trendAria = trendValues.map((point) => `${point.label}, ${point.text}`).join('; ')

  const participants = participantsQuery.data ?? []
  const participantCount = participants.length || overview.participants.total
  const pendingInvites = overview.participants.pending_approval
  const declinedParticipants = overview.participants.declined
  const inviteNote =
    pendingInvites === 0
      ? ''
      : pendingInvites === 1
        ? t('overview.activeNoteInviteOne')
        : t('overview.activeNoteInviteMany', { invites: pendingInvites })
  const declinedNote =
    declinedParticipants === 0
      ? ''
      : declinedParticipants === 1
        ? t('overview.activeNoteDeclinedOne')
        : t('overview.activeNoteDeclinedMany', { declined: declinedParticipants })
  const activeNote =
    [inviteNote, declinedNote].filter(Boolean).join(' e ') || t('overview.activeNoteNone')
  const activeIds = new Set(
    participants.filter((participant) => participant.status === 'active').map((p) => p.id),
  )
  const matrixRows = participants
    .map((participant) => {
      const cells = days.map((item) =>
        promptCell(promptsForParticipant(item.plan, participant.id)),
      )
      const answered = cells.reduce((sum, cell) => sum + cell.answered, 0)
      const sent = cells.reduce((sum, cell) => sum + cell.sent, 0)
      const warn = staleIds.has(participant.id)
      const note = warn
        ? t('overview.adherence.inactive')
        : participant.status !== 'active'
          ? participantT(participantStatusMeta[participant.status].labelKey)
          : ''
      return {
        id: participant.id,
        alias:
          participant.alias ??
          participantT(participantStatusMeta[participant.status].labelKey),
        cells,
        last: lastEntryById.get(participant.id) ?? participant.last_entry_at,
        warn,
        note,
        active: participant.status === 'active',
        ratio: sent > 0 ? answered / sent : null,
      }
    })
    .sort((left, right) => {
      if (left.warn !== right.warn) {
        return left.warn ? -1 : 1
      }
      if (left.active !== right.active) {
        return left.active ? -1 : 1
      }
      if (left.ratio === null && right.ratio === null) {
        return left.alias.localeCompare(right.alias)
      }
      if (left.ratio === null) {
        return 1
      }
      if (right.ratio === null) {
        return -1
      }
      return left.ratio - right.ratio
    })
  const shownRows = matrixRows.slice(0, 12)
  const dayTotals = days.map((item) => {
    let answered = 0
    let sent = 0
    for (const prompt of item.plan?.prompts ?? []) {
      if (!activeIds.has(prompt.participant_id)) {
        continue
      }
      if (prompt.status === 'answered') {
        answered += 1
        sent += 1
      } else if (prompt.status === 'sent' || prompt.status === 'expired') {
        sent += 1
      }
    }
    return sent > 0 ? `${Math.round((answered * 100) / sent)} %` : '–'
  })
  const todayColumn = days.some((item) => item.date === overview.date)

  const hours = chartHours.map((hour) => ({ hour, sent: 0, planned: 0 }))
  for (const prompt of todayPlan?.prompts ?? []) {
    if (prompt.status === 'unplanned') {
      continue
    }
    const at = prompt.scheduled_at ?? prompt.sent_at
    if (!at) {
      continue
    }
    const bucket = hours[clockInTimezone(at, timezone).hour - 8]
    if (!bucket) {
      continue
    }
    if (prompt.status === 'planned') {
      bucket.planned += 1
    } else {
      bucket.sent += 1
    }
  }
  const slotLimit = study.max_prompts_per_slot
  const hourLimit = slotLimit * 4
  const peak = Math.max(0, ...hours.map((hour) => hour.sent + hour.planned))
  const peakHour = hours.find((hour) => hour.sent + hour.planned === peak)?.hour ?? 8
  const axisTop = Math.max(hourLimit, peak, 1)
  const pxPerPrompt = 176 / axisTop
  const axisTicks = [
    axisTop,
    Math.round(axisTop / 2),
    Math.round(axisTop / 4),
    0,
  ]

  const typeTotals = breakdowns.byType.filter((item) => item.total > 0)
  const activityMax = Math.max(1, ...breakdowns.byActivity.map((item) => item.total))

  const effortMinutes = activities.reduce(
    (sum, activity) => sum + activity.expected_minutes * activity.prompts_per_day,
    0,
  )
  const effortBreakdown = activities
    .filter((activity) => activity.prompts_per_day > 0 && activity.expected_minutes > 0)
    .map((activity) =>
      activity.prompts_per_day > 1
        ? `${activity.prompts_per_day} × ${activity.expected_minutes} min`
        : `${activity.expected_minutes} min`,
    )
    .join(' + ')

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
              range: formatDateRange(study.starts_on, study.ends_on),
              participants: t('common.activeParticipantCount', {
                count: overview.participants.active,
              }),
            })}</span>
            <span>{dateLabel}</span>
            {periodEnded ? (
              <span className="st-period-ended">
                {t('overview.periodEnded', {
                  date: formatDayMonthYear(study.ends_on),
                })}
              </span>
            ) : null}
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
            <span className="st-kpi-hero">{percentLabel(today.answered, sentToday)}</span>
            <span className="st-kpi-note">
              {t('overview.adherenceNote', { answered: today.answered, sent: sentToday })}
            </span>
          </div>
          {trendValues.length > 0 ? (
            <div
              className="st-trend"
              role="img"
              aria-label={t('overview.trendAria', { values: trendAria })}
            >
              {trendValues.map((point) => (
                <div className="st-trend-item" key={point.date}>
                  <span className="st-trend-value">{point.text}</span>
                  <span
                    className={
                      point.date === overview.date
                        ? 'st-trend-bar st-trend-bar-current'
                        : 'st-trend-bar'
                    }
                    style={{ height: `${Math.max(2, Math.round(point.percent * 0.6))}px` }}
                  />
                  <span className="st-trend-label">{point.label}</span>
                </div>
              ))}
            </div>
          ) : null}
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
          <span className="st-kpi-note">{activeNote}</span>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.effort')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">
              {activities.length > 0 ? `${effortMinutes} min` : '–'}
            </span>
            <span className="st-kpi-sub">{t('overview.effortPerDay')}</span>
          </span>
          <span className="st-kpi-note">
            {effortBreakdown
              ? t('overview.effortNote', { breakdown: effortBreakdown })
              : t('overview.effortNone')}
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
              {alertCount === 1
                ? t('overview.attention.onePoint')
                : t('overview.attention.points', { count: alertCount })}
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
                    {t(
                      pendingAlerts.length === 1
                        ? 'overview.attention.approvalsTitleOne'
                        : 'overview.attention.approvalsTitle',
                      { count: pendingAlerts.length },
                    )}
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
                  <span className="st-attention-detail">
                    {alertDetail(
                      alert,
                      lastEntryById.get(alert.participant_id) ?? alert.last_entry_at,
                      timezone,
                    )}
                  </span>
                </span>
                <Link
                  className="st-btn st-btn-ghost st-btn-xs"
                  to={`/estudos/${study.id}/participantes`}
                >
                  {t('overview.attention.viewParticipant')}
                </Link>
              </div>
            ))}

            {remainingAlerts > 0 ? (
              <p className="st-attention-more">
                {t(
                  remainingAlerts === 1
                    ? 'overview.attention.moreOne'
                    : 'overview.attention.more',
                  { count: remainingAlerts },
                )}
              </p>
            ) : null}

            {alertCount === 0 ? (
              <p className="st-empty">{t('overview.attention.empty')}</p>
            ) : null}
          </div>
        </section>

        <section className="card st-funnel-card" aria-labelledby="h-funil">
          <div className="st-card-head">
            <h2 className="h2" id="h-funil">
              {t('overview.funnel.title', { time: currentTime })}
            </h2>
            <span className="st-muted-small">{dateLabel}</span>
          </div>

          <div className="st-funnel">
            <div className="st-funnel-row">
              <span className="st-funnel-label">{t('overview.funnel.planned')}</span>
              <div className="st-funnel-track-wrap">
                <div className="st-funnel-track">
                  <div
                    className="st-funnel-fill"
                    style={{ width: '100%', background: '#C9D9FB' }}
                  />
                </div>
                <span className="st-funnel-note">
                  {t('overview.funnel.note', {
                    value: plannedToday,
                    total: expectedToday,
                  })}
                </span>
              </div>
              <span className="st-funnel-value">{plannedToday}</span>
            </div>

            <div className="st-funnel-row">
              <span className="st-funnel-label">{t('overview.funnel.sent')}</span>
              <div className="st-funnel-track-wrap">
                <div className="st-funnel-track">
                  <div
                    className="st-funnel-fill"
                    style={{
                      width: `${plannedToday > 0 ? (sentToday * 100) / plannedToday : 0}%`,
                      background: '#9DB4F7',
                    }}
                  />
                </div>
                <span className="st-funnel-note">
                  {t('overview.funnel.ofPlanned', {
                    percent: percentValue(sentToday, plannedToday),
                  })}
                </span>
              </div>
              <span className="st-funnel-value">{sentToday}</span>
            </div>

            <div className="st-funnel-row">
              <span className="st-funnel-label">{t('overview.funnel.shown')}</span>
              <div className="st-funnel-track-wrap">
                <div className="st-funnel-track">
                  <div
                    className="st-funnel-fill"
                    style={{
                      width: `${plannedToday > 0 ? (shownToday * 100) / plannedToday : 0}%`,
                      background: '#6C8CF0',
                    }}
                  />
                </div>
                <span className="st-funnel-note">
                  {t('overview.funnel.ofSent', {
                    percent: percentValue(shownToday, sentToday),
                  })}
                </span>
              </div>
              <span className="st-funnel-value">{shownToday}</span>
            </div>

            <div className="st-funnel-row">
              <span className="st-funnel-label">{t('overview.funnel.opened')}</span>
              <div className="st-funnel-track-wrap">
                <div className="st-funnel-track">
                  <div
                    className="st-funnel-fill"
                    style={{
                      width: `${plannedToday > 0 ? (openedToday * 100) / plannedToday : 0}%`,
                      background: '#4A72EC',
                    }}
                  />
                </div>
                <span className="st-funnel-note">
                  {t('overview.funnel.ofSent', {
                    percent: percentValue(openedToday, sentToday),
                  })}
                </span>
              </div>
              <span className="st-funnel-value">{openedToday}</span>
            </div>

            <div className="st-funnel-row">
              <span className="st-funnel-label">{t('overview.funnel.answered')}</span>
              <div className="st-funnel-track-wrap">
                <div className="st-funnel-track">
                  <div
                    className="st-funnel-fill"
                    style={{
                      width: `${plannedToday > 0 ? (answeredToday * 100) / plannedToday : 0}%`,
                      background: '#1E3FB0',
                    }}
                  />
                </div>
                <span className="st-funnel-note">
                  {t('overview.funnel.ofSent', {
                    percent: percentValue(answeredToday, sentToday),
                  })}
                </span>
              </div>
              <span className="st-funnel-value">{answeredToday}</span>
            </div>
          </div>

          <div className="st-outcomes">
            <span className="st-outcomes-title">
              {t('overview.outcomes.title', { count: sentToday })}
            </span>
            <div
              className="st-outcome-bar"
              role="img"
              aria-label={t('overview.outcomes.aria', {
                answered: answeredToday,
                open: openToday,
                expired: expiredToday,
              })}
            >
              <div
                className="st-outcome-answered"
                style={{ flex: `${answeredToday} 1 0` }}
              >
                {answeredToday}
              </div>
              <div className="st-outcome-open" style={{ flex: `${openToday} 1 0` }}>
                {openToday}
              </div>
              <div className="st-outcome-expired" style={{ flex: `${expiredToday} 1 0` }}>
                {expiredToday}
              </div>
            </div>
            <div className="st-legend-row">
              <span className="st-legend-item">
                <span className="st-swatch st-swatch-answered" />
                {t('overview.outcomes.answered')}
              </span>
              <span className="st-legend-item">
                <span className="st-swatch st-swatch-open" />
                {t('overview.outcomes.open')}
              </span>
              <span className="st-legend-item">
                <span className="st-swatch st-swatch-expired" />
                {t('overview.outcomes.expired')}
              </span>
            </div>
          </div>

          <div className="st-mini-stats">
            <div className="st-mini-stat">
              <span className="st-mini-stat-label">{t('overview.pendingToday')}</span>
              <span className="st-mini-stat-value">{today.planned}</span>
              <span className="st-mini-stat-note">
                {t('overview.pendingMath', {
                  sent: sentToday,
                  pending: today.planned,
                  planned: plannedToday,
                })}
              </span>
            </div>
            <div className="st-mini-stat st-mini-stat-warning">
              <span className="st-mini-stat-label">{t('overview.unplanned')}</span>
              <span className="st-mini-stat-row">
                <span className="st-mini-stat-value">{unplannedToday}</span>
                <Link className="st-link" to={`/estudos/${study.id}/plano`}>
                  {t('overview.viewPlan')}
                </Link>
              </span>
              <span className="st-mini-stat-note">
                {t('overview.unplannedMath', {
                  planned: plannedToday,
                  unplanned: unplannedToday,
                  expected: expectedToday,
                })}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="st-grid-adherence">
        <section className="card st-adherence-card" aria-labelledby="h-adesao">
          <div className="st-card-head st-card-head-start">
            <h2 className="h2" id="h-adesao">
              {t('overview.adherence.title')}
            </h2>
            <span className="st-muted-small">
              {t('overview.adherence.subtitle', {
                shown: shownRows.length,
                total: participantCount,
              })}
            </span>
          </div>

          <div className="st-adherence-table" role="table" aria-label={t('overview.adherence.title')}>
            <div className="st-adherence-row st-adherence-head" role="row">
              <span role="columnheader">{t('overview.adherence.participant')}</span>
              {days.map((item) => (
                <span role="columnheader" className="st-adherence-day" key={item.date}>
                  <span className="st-adherence-day-label">
                    {item.date === overview.date
                      ? `${t('overview.trend.day', { day: item.dayNumber })} · ${t('plan.date.today')}`
                      : t('overview.trend.day', { day: item.dayNumber })}
                  </span>
                  <span className="st-adherence-day-sub">
                    {item.date === overview.date
                      ? t('overview.adherence.partial')
                      : formatDayMonth(item.date)}
                  </span>
                </span>
              ))}
              <span role="columnheader">{t('overview.adherence.lastEntry')}</span>
            </div>

            {shownRows.map((row) => (
              <div
                className={row.warn ? 'st-adherence-row st-adherence-warn' : 'st-adherence-row'}
                role="row"
                key={row.id}
              >
                <div className="st-adherence-participant" role="cell">
                  <span className="mono">{row.alias}</span>
                  {row.note ? <span className="st-adherence-note">{row.note}</span> : null}
                </div>
                {row.cells.map((cell, index) => {
                  const tier = adherenceTier(cell)
                  return (
                    <div className="st-adherence-cell" role="cell" key={index}>
                      <span className={tier.className} title={tier.title}>
                        {tier.text}
                      </span>
                    </div>
                  )
                })}
                <span
                  className={row.warn ? 'st-adherence-last st-adherence-last-warn' : 'st-adherence-last'}
                  role="cell"
                >
                  {row.last
                    ? `${formatDayMonth(dateInTimezone(row.last, timezone))} ${timeLabel(
                        row.last,
                        timezone,
                      )}`
                    : '–'}
                </span>
              </div>
            ))}

            {shownRows.length === 0 ? (
              <p className="st-empty">{t('overview.adherence.empty')}</p>
            ) : null}

            <div className="st-adherence-row st-adherence-total" role="row">
              <span className="st-adherence-total-label" role="cell">
                {t('overview.adherence.allActive', { count: overview.participants.active })}
              </span>
              {dayTotals.map((value, index) => (
                <span className="st-adherence-total-cell" role="cell" key={index}>
                  {value}
                </span>
              ))}
              <span className="st-adherence-total-note" role="cell">
                {t('overview.adherence.totalToday', {
                  answered: today.answered,
                  sent: sentToday,
                })}
              </span>
            </div>
          </div>

          <div className="st-adherence-footer">
            <div className="st-rate-legend">
              <span className="st-rate-title">{t('overview.adherence.rate')}</span>
              <span className="st-legend-item">
                <span className="st-rate-swatch st-rate-high" />
                {t('overview.adherence.tierHigh')}
              </span>
              <span className="st-legend-item">
                <span className="st-rate-swatch st-rate-medium" />
                {t('overview.adherence.tierMedium')}
              </span>
              <span className="st-legend-item">
                <span className="st-rate-swatch st-rate-low" />
                {t('overview.adherence.tierLow')}
              </span>
              <span className="st-legend-item">
                <span className="st-rate-swatch st-rate-zero" />
                {t('overview.adherence.tierZero')}
              </span>
              <span>{t('overview.adherence.tierNone')}</span>
            </div>
            <Link className="st-btn st-btn-ghost st-btn-xs" to={`/estudos/${study.id}/participantes`}>
              {t(
                participantCount === 1
                  ? 'overview.adherence.viewParticipantsOne'
                  : 'overview.adherence.viewParticipants',
                { count: participantCount },
              )}
            </Link>
          </div>

          {todayColumn ? (
            <span className="st-fine-print">
              {t('overview.adherence.todayPartial', { time: currentTime })}
            </span>
          ) : null}
        </section>

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
      </div>

      <div className="st-grid-charts">
        <section className="card st-hours-card" aria-labelledby="h-cron">
          <div className="st-card-head st-card-head-start">
            <h2 className="h2" id="h-cron">
              {t('overview.hours.title')}
            </h2>
            <span className="st-muted-small">
              {t('overview.hours.subtitle', {
                sent: sentToday,
                pending: today.planned,
                planned: plannedToday,
              })}
            </span>
          </div>

          <div className="st-hour-chart">
            <div className="st-hour-axis" aria-hidden="true">
              {axisTicks.map((tick, index) => (
                <span key={`${tick}-${index}`} style={{ bottom: `${tick * pxPerPrompt}px` }}>
                  {tick}
                </span>
              ))}
            </div>
            <div className="st-hour-plot">
              <span
                className="st-hour-gridline"
                style={{ bottom: `${axisTicks[1] * pxPerPrompt}px` }}
              />
              <span
                className="st-hour-gridline"
                style={{ bottom: `${axisTicks[2] * pxPerPrompt}px` }}
              />
              <span className="st-hour-baseline" />
              <span
                className="st-hour-limit"
                aria-hidden="true"
                style={{ top: 'auto', bottom: `${hourLimit * pxPerPrompt}px` }}
              >
                {t('overview.hours.limit', { limit: hourLimit })}
              </span>
              <div
                className="st-hour-bars"
                role="img"
                aria-label={t('overview.hours.aria', {
                  sent: sentToday,
                  planned: today.planned,
                })}
              >
                {hours.map((hour) => {
                  const stack = hour.sent + hour.planned
                  return (
                    <div className="st-hour-col" key={hour.hour}>
                      <span className="st-hour-total">{stack}</span>
                      <div
                        className="st-hour-stack"
                        title={`${String(hour.hour).padStart(2, '0')}:00 · ${hour.sent} enviados, ${hour.planned} por enviar`}
                      >
                        {hour.planned > 0 ? (
                          <span
                            className="st-hour-planned"
                            style={{ height: `${hour.planned * pxPerPrompt}px` }}
                          />
                        ) : null}
                        <span
                          className={hour.planned > 0 ? 'st-hour-sent st-hour-sent-flat' : 'st-hour-sent'}
                          style={{ height: `${hour.sent * pxPerPrompt}px` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="st-hour-labels">
            {hours.map((hour) => (
              <span className="st-hour-label" key={hour.hour}>
                <span className="mono">{String(hour.hour).padStart(2, '0')}</span>
                <span className="st-hour-now">
                  {hour.hour === now.hour ? t('overview.hours.now') : ''}
                </span>
              </span>
            ))}
          </div>

          <div className="st-legend-row st-legend-row-spaced">
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-sent" />
              {t('overview.hours.sent', { count: sentToday })}
            </span>
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-planned" />
              {t('overview.hours.planned', { count: today.planned })}
            </span>
            <span className="st-legend-item">
              <span className="st-limit-swatch" />
              {t('overview.hours.limitLegend')}
            </span>
          </div>

          <div className="st-summary-box">
            {peak === 0
              ? t('overview.hours.summaryEmpty', {
                  slot: slotLimit,
                  hour: hourLimit,
                  unplanned: unplannedToday,
                })
              : t(
                  peak > hourLimit
                    ? 'overview.hours.summaryOver'
                    : 'overview.hours.summary',
                  {
                    slot: slotLimit,
                    hour: hourLimit,
                    peak,
                    from: `${String(peakHour).padStart(2, '0')}:00`,
                    to: `${String(peakHour + 1).padStart(2, '0')}:00`,
                    unplanned: unplannedToday,
                  },
                )}
          </div>
        </section>

        <section className="card st-types-card" aria-labelledby="h-tipos">
          <div className="st-card-head">
            <h2 className="h2" id="h-tipos">
              {t('overview.types.title')}
            </h2>
            <span className="st-muted-strong">
              {t('overview.types.total', { count: overview.entries.total })}
            </span>
          </div>

          <div className="st-types">
            <span className="st-types-label">{t('overview.types.byType')}</span>
            {typeTotals.length > 0 ? (
              <>
                <div className="st-type-bar" aria-hidden="true">
                  {typeTotals.map((item) => (
                    <span
                      key={item.type}
                      style={{
                        flex: `${item.total} 1 0`,
                        background: typeColors[item.type],
                      }}
                    />
                  ))}
                </div>
                <div className="st-type-list">
                  {typeTotals.map((item) => (
                    <div className="st-type-row" key={item.type}>
                      <span
                        className="st-type-swatch"
                        style={{ background: typeColors[item.type] }}
                      />
                      <span className="st-type-name">{t(typeNameKeys[item.type])}</span>
                      <span className="st-type-value">{item.total}</span>
                      <span className="st-type-pct">
                        {overview.entries.total > 0
                          ? `${Math.round((item.total * 100) / overview.entries.total)} %`
                          : '–'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="st-empty">{t('overview.types.noEntries')}</p>
            )}
          </div>

          <div className="st-activities">
            <span className="st-types-label">{t('overview.types.byActivity')}</span>
            {breakdowns.byActivity.length > 0 ? (
              <>
                {breakdowns.byActivity.map((item, index) => {
                  const requested = Math.max(0, item.total - item.free)
                  return (
                    <div className="st-activity-row" key={item.activity.id}>
                      <div className="st-activity-copy">
                        <span className="st-activity-name">
                          <span className="mono st-activity-code">A{index + 1}</span> ·{' '}
                          {item.activity.title}
                        </span>
                        <div className="st-activity-bar">
                          <span
                            className="st-activity-requested"
                            style={{ width: `${(requested * 100) / activityMax}%` }}
                          />
                          <span
                            className="st-activity-free"
                            style={{ width: `${(item.free * 100) / activityMax}%` }}
                          />
                        </div>
                        <span className="st-activity-note">
                          {t('overview.types.activityNote', {
                            requested,
                            free: item.free,
                          })}
                        </span>
                      </div>
                      <span className="st-activity-value">{item.total}</span>
                    </div>
                  )
                })}
                <div className="st-legend-row st-activity-legend">
                  <span className="st-legend-item">
                    <span className="st-swatch st-swatch-requested" />
                    {t('overview.types.requestsLegend')}
                  </span>
                  <span className="st-legend-item">
                    <span className="st-swatch st-swatch-free" />
                    {t('overview.types.freeLegend')}
                  </span>
                </div>
              </>
            ) : (
              <p className="st-empty">{t('overview.types.empty')}</p>
            )}
          </div>

          <div className="st-mini-stats">
            <div className="st-mini-stat">
              <span>
                <strong className="st-mini-stat-number">{breakdowns.late}</strong>{' '}
                {t('overview.types.delayed')}
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
