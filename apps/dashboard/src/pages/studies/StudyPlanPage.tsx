import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRightIcon } from '../../components/icons'
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from '../../components/studies/StudyIcons'
import {
  addDays,
  clockInTimezone,
  formatDate,
  formatFullDate,
  studiesErrorMessage,
  styleLabel,
  todayInTimezone,
  useStudy,
  useStudyPlan,
  type PlanPrompt,
  type PromptStatus,
  type Study,
  type StudyPlan,
  type UnplannedReason,
} from '../../api/studies'
import { t, type StudiesKey } from '../../i18n/studies'
import '../../styles/studies.css'

const AXIS_START = 8 * 60
const AXIS_END = 22 * 60 + 30
const AXIS_SPAN = AXIS_END - AXIS_START
const AXIS_GRID = [8, 10, 12, 14, 16, 18, 20, 22]

const reasonLabels: Record<UnplannedReason, StudiesKey> = {
  outside_availability: 'plan.reasons.outsideHours',
  min_gap_infeasible: 'plan.reasons.interval',
  daily_cap: 'plan.reasons.dailyMax',
  slot_cap: 'plan.reasons.slotFull',
  search_cut: 'plan.reasons.timeout',
}

const reasonShortLabels: Record<UnplannedReason, StudiesKey> = {
  outside_availability: 'plan.reason.short.outsideHours',
  min_gap_infeasible: 'plan.reason.short.interval',
  daily_cap: 'plan.reason.short.dailyMax',
  slot_cap: 'plan.reason.short.slotFull',
  search_cut: 'plan.reason.short.timeout',
}

const statusLabels: Record<PromptStatus, StudiesKey> = {
  answered: 'plan.schedule.status.responded',
  sent: 'plan.schedule.status.sent',
  expired: 'plan.schedule.status.expired',
  planned: 'plan.schedule.status.planned',
  unplanned: 'plan.schedule.status.unplanned',
}

const activityColors = ['#2F5BEA', '#0E7C66', '#B96A00', '#7B4FBF', '#C2413E']

type ActivityMeta = { code: string; name: string; color: string }

function parseTime(value: string): number {
  const [hours, minutes] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function promptMinutes(prompt: PlanPrompt, timezone: string): number | null {
  const stamp = prompt.scheduled_at ?? prompt.sent_at
  if (!stamp) {
    return null
  }
  const clock = clockInTimezone(stamp, timezone)
  return clock.hour * 60 + clock.minute
}

function percentOf(minutes: number) {
  const clamped = Math.min(Math.max(minutes, AXIS_START), AXIS_END)
  return ((clamped - AXIS_START) / AXIS_SPAN) * 100
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`))
}

function buildActivities(plan: StudyPlan): Map<string, ActivityMeta> {
  const activities = new Map<string, ActivityMeta>()
  for (const prompt of plan.prompts) {
    if (!activities.has(prompt.activity_id)) {
      activities.set(prompt.activity_id, {
        code: `A${activities.size + 1}`,
        name: prompt.activity_title,
        color: activityColors[activities.size % activityColors.length],
      })
    }
  }
  return activities
}

function studyDays(study: Study | undefined, fallback: string): string[] {
  if (!study?.starts_on || !study.ends_on) {
    return [fallback]
  }
  const days: string[] = []
  let cursor = study.starts_on
  let guard = 0
  while (cursor <= study.ends_on && guard < 120) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return days.length > 0 ? days : [fallback]
}

function PlanSummary({ plan, study }: { plan: StudyPlan; study: Study }) {
  const planned = plan.prompts.filter((prompt) => prompt.status === 'planned').length
  const unplanned = plan.prompts.filter(
    (prompt) => prompt.status === 'unplanned' || prompt.unplanned_reason !== null,
  ).length
  const expected = plan.prompts.length

  return (
    <section
      className="card st-plan-summary"
      aria-label={t('plan.summary.date', { date: dayLabel(plan.date) })}
    >
      <div className="st-plan-summary-head">
        <div className="st-plan-summary-title">
          <h2 className="h2 st-plan-summary-heading">
            {t('plan.summary.date', { date: dayLabel(plan.date) })}
          </h2>
          <p className="st-sub">
            {t('plan.summary.styleLine', {
              style: styleLabel(study.schedule_style),
              maxDay: study.max_prompts_per_day,
              maxSlot: study.max_prompts_per_slot,
            })}
          </p>
        </div>
      </div>

      <div className="st-plan-stats">
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.planned')}</span>
          <span className="st-plan-stat-value">
            {planned}{' '}
            <span className="st-plan-stat-sub">
              {t('plan.summary.plannedOf', { expected })}
            </span>
          </span>
          <span className="st-plan-stat-note">
            {t('plan.summary.plannedNote', {
              participants: plan.participants.length,
              maxDay: study.max_prompts_per_day,
            })}
          </span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.unplanned')}</span>
          <span className="st-plan-stat-value st-danger-text">{unplanned}</span>
          <span className="st-plan-stat-note">{t('plan.summary.unplannedNote')}</span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.participants')}</span>
          <span className="st-plan-stat-value">{plan.participants.length}</span>
          <span className="st-plan-stat-note">{t('plan.summary.participantsNote')}</span>
        </div>
      </div>
    </section>
  )
}

function TimelineRow({
  timezone,
  alias,
  availability,
  anyTime,
  prompts,
  activities,
}: {
  timezone: string
  alias: string
  availability: { start_time: string; end_time: string }[]
  anyTime: boolean
  prompts: PlanPrompt[]
  activities: Map<string, ActivityMeta>
}) {
  const requests = prompts
    .map((prompt) => ({ prompt, minutes: promptMinutes(prompt, timezone) }))
    .filter(
      (item): item is { prompt: PlanPrompt; minutes: number } =>
        item.minutes !== null && item.prompt.status !== 'unplanned',
    )
    .sort((left, right) => left.minutes - right.minutes)

  const windows = anyTime
    ? [{ start: AXIS_START, end: AXIS_END }]
    : availability.map((interval) => ({
        start: parseTime(interval.start_time),
        end: parseTime(interval.end_time),
      }))

  const unplanned = prompts.find(
    (prompt) => prompt.status === 'unplanned' || prompt.unplanned_reason !== null,
  )

  const windowTitle = anyTime
    ? t('plan.schedule.allDay')
    : windows.length === 0
      ? t('plan.schedule.noAvailability')
      : windows
          .map((window) =>
            t('plan.schedule.window', {
              start: formatMinutes(window.start),
              end: formatMinutes(window.end),
            }),
          )
          .join(' · ')

  return (
    <div className="st-plan-row">
      <span className="mono st-plan-alias">{alias}</span>
      <div className="st-plan-track" title={windowTitle}>
        {windows.map((window, index) => (
          <span
            key={index}
            className="st-plan-window"
            style={{
              left: `${percentOf(window.start)}%`,
              width: `${percentOf(window.end) - percentOf(window.start)}%`,
            }}
          />
        ))}
        {AXIS_GRID.map((hour) => (
          <span
            key={hour}
            className="st-plan-gridline"
            style={{ left: `${((hour * 60 - AXIS_START) * 100) / AXIS_SPAN}%` }}
          />
        ))}
        {requests.map(({ prompt, minutes }) => {
          const activity = activities.get(prompt.activity_id)
          const code = activity?.code ?? 'A?'
          return (
            <span
              key={prompt.prompt_id}
              className="st-req"
              style={{ left: `${percentOf(minutes)}%`, background: activity?.color }}
              title={`${code} ${activity?.name ?? ''} · ${formatMinutes(minutes)} · ${t(statusLabels[prompt.status])}`}
            >
              <b>{code}</b> {formatMinutes(minutes)}
            </span>
          )
        })}
      </div>
      <div className="st-plan-unplanned-cell">
        {unplanned ? (
          <span className="st-plan-reason-badge">
            <b>{activities.get(unplanned.activity_id)?.code ?? 'A?'}</b>
            {unplanned.unplanned_reason
              ? t(reasonShortLabels[unplanned.unplanned_reason])
              : t('plan.schedule.status.unplanned')}
          </span>
        ) : (
          <span className="st-plan-none">{t('plan.schedule.none')}</span>
        )}
      </div>
    </div>
  )
}

export default function StudyPlanPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const studyQuery = useStudy(studyId)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const study = studyQuery.data
  const timezone = study?.timezone ?? 'Europe/Lisbon'
  const today = todayInTimezone(timezone)
  const days = studyDays(study, today)
  const defaultDate = days.includes(today) ? today : (days[0] ?? today)
  const date = selectedDate ?? defaultDate
  const planQuery = useStudyPlan(studyId, date)
  const plan = planQuery.data

  const dateIndex = days.indexOf(date)
  const previousDate = dateIndex > 0 ? days[dateIndex - 1] : null
  const nextDate = dateIndex >= 0 && dateIndex < days.length - 1 ? days[dateIndex + 1] : null

  function selectDate(next: string) {
    setSelectedDate(next)
    setDayPickerOpen(false)
  }

  if (studyQuery.isLoading && !study) {
    return (
      <div className="st-page">
        <p className="st-empty">{t('state.loading')}</p>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="st-page">
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(studyQuery.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void studyQuery.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const activities = plan ? buildActivities(plan) : new Map<string, ActivityMeta>()
  const participants = plan
    ? showAll
      ? plan.participants
      : plan.participants.slice(0, 12)
    : []
  const unplannedPrompts =
    plan?.prompts.filter(
      (prompt) => prompt.status === 'unplanned' || prompt.unplanned_reason !== null,
    ) ?? []
  const reasonCounts = new Map<UnplannedReason, number>()
  for (const prompt of unplannedPrompts) {
    if (prompt.unplanned_reason) {
      reasonCounts.set(
        prompt.unplanned_reason,
        (reasonCounts.get(prompt.unplanned_reason) ?? 0) + 1,
      )
    }
  }

  const promptsFor = (participantId: string) =>
    plan?.prompts.filter((prompt) => prompt.participant_id === participantId) ?? []

  return (
    <div className="st-page">
      <header className="st-plan-header">
        <div className="st-header-copy">
          <h1 className="st-title">{t('plan.title')}</h1>
          <p className="st-subtitle st-plan-subtitle">{t('plan.subtitle')}</p>
        </div>
        <div className="st-plan-day-nav">
          <div className="st-day-controls" role="group" aria-label={t('plan.chooseDay')}>
            <button
              type="button"
              className="st-btn st-icon-btn"
              aria-label={t('plan.previousDay')}
              disabled={!previousDate}
              onClick={() => previousDate && selectDate(previousDate)}
            >
              <ChevronLeftIcon />
            </button>
            <div className="st-day-picker">
              <button
                type="button"
                className="st-btn st-day-button"
                aria-haspopup="menu"
                aria-expanded={dayPickerOpen}
                onClick={() => setDayPickerOpen((open) => !open)}
              >
                <CalendarIcon />
                {formatFullDate(date)}
                <ChevronDownIcon />
              </button>
              {dayPickerOpen ? (
                <div className="st-day-menu" role="menu">
                  {days.map((day) => (
                    <button
                      key={day}
                      type="button"
                      role="menuitemradio"
                      aria-checked={day === date}
                      onClick={() => selectDate(day)}
                    >
                      {dayLabel(day)}
                      {day === today ? ` · ${t('plan.date.today')}` : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="st-btn st-icon-btn"
              aria-label={t('plan.nextDay')}
              disabled={!nextDate}
              onClick={() => nextDate && selectDate(nextDate)}
            >
              <ChevronRightIcon width={18} height={18} />
            </button>
          </div>
          {study.starts_on && study.ends_on ? (
            <span className="st-muted-small">
              {formatDate(study.starts_on)} – {formatFullDate(study.ends_on)}
            </span>
          ) : null}
        </div>
      </header>

      {planQuery.isLoading && !plan ? <p className="st-empty">{t('state.loading')}</p> : null}

      {planQuery.error ? (
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(planQuery.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void planQuery.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      {plan && plan.prompts.length === 0 ? (
        <div className="st-note st-note-info" role="status">
          <span>{t('plan.schedule.noPrompts')}</span>
        </div>
      ) : null}

      {plan ? <PlanSummary plan={plan} study={study} /> : null}

      {plan ? (
        <section className="card st-unplanned" aria-label={t('plan.unplanned.titleDate')}>
          <div className="st-unplanned-head">
            <div className="st-unplanned-title">
              <h2 className="h2">{t('plan.unplanned.titleDate')}</h2>
              <span
                className={unplannedPrompts.length > 0 ? 'st-count-danger' : 'st-count-warning'}
              >
                {unplannedPrompts.length === 1
                  ? t('plan.unplanned.one')
                  : t('plan.unplanned.count', { count: unplannedPrompts.length })}
              </span>
            </div>
            <span className="st-muted-small">{t('plan.unplanned.note')}</span>
          </div>

          <div className="st-unplanned-layout">
            <div className="st-unplanned-list">
              {unplannedPrompts.length === 0 ? (
                <p className="st-empty">{t('plan.unplanned.empty')}</p>
              ) : null}
              {unplannedPrompts.map((prompt) => {
                const activity = activities.get(prompt.activity_id)
                const reason = prompt.unplanned_reason
                return (
                  <div className="st-unplanned-row" key={prompt.prompt_id}>
                    <div className="st-unplanned-alias">
                      <span className="mono">{prompt.participant_alias ?? '–'}</span>
                      <span className="st-tag st-tag-sm">{activity?.code ?? 'A?'}</span>
                    </div>
                    <div className="st-unplanned-copy">
                      <span className="st-unplanned-activity">{prompt.activity_title}</span>
                      {reason ? (
                        <span className="st-reason-pill">{t(reasonLabels[reason])}</span>
                      ) : null}
                    </div>
                    <div className="st-unplanned-actions">
                      <span className="st-unplanned-actions-label">
                        {t('plan.unplanned.whatCanDo')}
                      </span>
                      <Link
                        className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                        to={`/estudos/${studyId}/participantes`}
                      >
                        <ChevronRightIcon width={16} height={16} />
                        {t('plan.unplanned.talk')}
                      </Link>
                      {reason === 'slot_cap' || reason === 'daily_cap' ? (
                        <Link
                          className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                          to={`/estudos/${studyId}/definicoes`}
                        >
                          <ChevronRightIcon width={16} height={16} />
                          {t('plan.unplanned.raise')}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <aside className="st-reasons">
              <span className="st-plan-how-title">{t('plan.reasons.title')}</span>
              <div className="st-reason-list">
                {(Object.keys(reasonLabels) as UnplannedReason[]).map((reason) => {
                  const count = reasonCounts.get(reason) ?? 0
                  return (
                    <div
                      className={count > 0 ? 'st-reason-row st-reason-row-active' : 'st-reason-row'}
                      key={reason}
                    >
                      <span>{t(reasonLabels[reason])}</span>
                      <span className={count > 0 ? 'mono st-danger-text' : 'mono'}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {plan ? (
        <section className="card st-schedule" aria-label={t('plan.schedule.title')}>
          <div className="st-schedule-head">
            <div className="st-schedule-heading">
              <h2 className="h2">{t('plan.schedule.title')}</h2>
              <p className="st-sub">{dayLabel(date)}</p>
            </div>
            {plan.participants.length > 12 ? (
              <button
                type="button"
                className="st-btn st-btn-ghost st-btn-sm"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll
                  ? t('plan.schedule.viewLess')
                  : t('plan.schedule.viewAll', { count: plan.participants.length })}
              </button>
            ) : null}
          </div>

          <div className="st-activity-legend">
            {[...activities.values()].map((activity) => (
              <span className="st-activity-legend-item" key={activity.code}>
                <span className="st-activity-chip" style={{ background: activity.color }}>
                  {activity.code.slice(1)}
                </span>
                {activity.name}
              </span>
            ))}
          </div>

          <div className="st-status-legend">
            {(['answered', 'sent', 'expired', 'planned'] as PromptStatus[]).map((status) => (
              <span className="st-status-legend-item" key={status}>
                <span className="st-tag st-tag-sm">{t(statusLabels[status])}</span>
              </span>
            ))}
            <span className="st-status-legend-item">
              <span className="st-offwindow-swatch" />
              {t('plan.schedule.outsideWindow')}
            </span>
          </div>

          <div className="st-schedule-table">
            <div className="st-schedule-header">
              <span>{t('plan.schedule.participant')}</span>
              <div className="st-schedule-axis">
                {AXIS_GRID.map((hour) => (
                  <span
                    key={hour}
                    className="mono"
                    style={{ left: `${((hour * 60 - AXIS_START) * 100) / AXIS_SPAN}%` }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
              <span>{t('plan.schedule.unplanned')}</span>
            </div>

            <div className="st-schedule-body">
              {participants.map((participant) => (
                <TimelineRow
                  key={participant.participant_id}
                  timezone={timezone}
                  alias={participant.alias ?? '–'}
                  availability={participant.availability}
                  anyTime={participant.availability_any_time}
                  prompts={promptsFor(participant.participant_id)}
                  activities={activities}
                />
              ))}
              {participants.length === 0 ? (
                <p className="st-empty">{t('plan.schedule.noParticipants')}</p>
              ) : null}
            </div>
          </div>

          <p className="st-fine-print">
            {t('plan.schedule.showing', {
              shown: participants.length,
              total: plan.participants.length,
            })}
          </p>
        </section>
      ) : null}
    </div>
  )
}
