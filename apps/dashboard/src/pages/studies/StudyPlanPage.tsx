import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useActivities, type Activity } from '../../api/activities'
import { useStudyLiveRefresh } from '../../api/entries'
import { formatDateRange, formatDayMonthYear } from '../../components/studies/format'
import { ChevronRightIcon } from '../../components/icons'
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from '../../components/studies/StudyIcons'
import {
  addDays,
  clockInTimezone,
  nowClockInTimezone,
  studiesErrorMessage,
  studyKeys,
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
const INTERVAL_MINUTES = 15
const INTERVAL_BIN_COUNT = Math.round(AXIS_SPAN / INTERVAL_MINUTES)

type IntervalBin = { sent: number; planned: number }

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

const requestStatusClasses: Record<PromptStatus, string> = {
  answered: 'st-req-responded',
  sent: 'st-req-sent',
  expired: 'st-req-expired',
  planned: 'st-req-planned',
  unplanned: 'st-req-planned',
}

const activityPalette = [
  { color: '#2F5BEA', soft: '#EAF0FF' },
  { color: '#0E7C66', soft: '#E3F4EC' },
  { color: '#B96A00', soft: '#FFF3D6' },
  { color: '#7B4FBF', soft: '#F1EAFB' },
  { color: '#C2413E', soft: '#FDECEC' },
]

type ActivityMeta = { code: string; name: string; color: string; soft: string }

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

function buildIntervalBins(prompts: PlanPrompt[], timezone: string): IntervalBin[] {
  const bins = Array.from({ length: INTERVAL_BIN_COUNT }, () => ({ sent: 0, planned: 0 }))
  for (const prompt of prompts) {
    if (prompt.status === 'unplanned' || prompt.unplanned_reason !== null) {
      continue
    }
    const minutes = promptMinutes(prompt, timezone)
    if (minutes === null) {
      continue
    }
    const index = Math.min(
      Math.max(Math.floor((minutes - AXIS_START) / INTERVAL_MINUTES), 0),
      INTERVAL_BIN_COUNT - 1,
    )
    if (prompt.status === 'planned') {
      bins[index].planned += 1
    } else {
      bins[index].sent += 1
    }
  }
  return bins
}

/** The smallest gap any activity asks for; each activity has its own minimum. */
function smallestGap(activities: Activity[]): number | null {
  const gaps = activities.map((activity) => activity.min_gap_minutes).filter((gap) => gap > 0)
  return gaps.length > 0 ? Math.min(...gaps) : null
}

/** Whether no two prompts of the same activity and participant are closer than its gap. */
function gapRespected(
  prompts: PlanPrompt[],
  activities: Activity[],
  timezone: string,
): boolean {
  const gapByActivity = new Map(
    activities.map((activity) => [activity.id, activity.min_gap_minutes]),
  )
  const lastByPair = new Map<string, number>()
  const placed = prompts
    .filter((prompt) => prompt.status !== 'unplanned' && prompt.unplanned_reason === null)
    .map((prompt) => ({
      key: `${prompt.participant_id}:${prompt.activity_id}`,
      minutes: promptMinutes(prompt, timezone),
      gap: gapByActivity.get(prompt.activity_id) ?? 0,
    }))
    .filter(
      (item): item is { key: string; minutes: number; gap: number } =>
        item.minutes !== null,
    )
    .sort((left, right) => left.key.localeCompare(right.key) || left.minutes - right.minutes)
  for (const item of placed) {
    const previous = lastByPair.get(item.key)
    if (previous !== undefined && item.minutes - previous < item.gap) {
      return false
    }
    lastByPair.set(item.key, item.minutes)
  }
  return true
}

function binTotals(bins: IntervalBin[]): { sent: number; planned: number; peak: number } {
  let sent = 0
  let planned = 0
  let peak = 0
  for (const bin of bins) {
    const total = bin.sent + bin.planned
    sent += bin.sent
    planned += bin.planned
    peak = Math.max(peak, total)
  }
  return { sent, planned, peak }
}

function buildActivities(plan: StudyPlan, ordered: Activity[]): Map<string, ActivityMeta> {
  const activities = new Map<string, ActivityMeta>()
  function add(id: string, title: string) {
    if (activities.has(id)) {
      return
    }
    const palette = activityPalette[activities.size % activityPalette.length]
    activities.set(id, {
      code: `A${activities.size + 1}`,
      name: title,
      color: palette.color,
      soft: palette.soft,
    })
  }
  // Same order and codes as /atividades: the activity list, not the plan order.
  for (const activity of ordered) {
    add(activity.id, activity.title)
  }
  for (const prompt of plan.prompts) {
    add(prompt.activity_id, prompt.activity_title)
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

function PlanSummary({
  plan,
  study,
  participants,
  prompts,
  minGap,
  gapOk,
}: {
  plan: StudyPlan
  study: Study
  participants: StudyPlan['participants']
  prompts: PlanPrompt[]
  minGap: number | null
  gapOk: boolean
}) {
  const unplanned = prompts.filter(
    (prompt) => prompt.status === 'unplanned' || prompt.unplanned_reason !== null,
  ).length
  const expected = prompts.length
  const planned = expected - unplanned
  const totals = binTotals(buildIntervalBins(prompts, study.timezone))
  const perParticipant = new Map<string, number>()
  for (const prompt of prompts) {
    if (prompt.status === 'unplanned' || prompt.unplanned_reason !== null) {
      continue
    }
    perParticipant.set(
      prompt.participant_id,
      (perParticipant.get(prompt.participant_id) ?? 0) + 1,
    )
  }
  const highestPerParticipant = Math.max(0, ...perParticipant.values())
  const withHours = participants.filter(
    (participant) =>
      participant.availability_any_time || participant.availability.length > 0,
  ).length
  const perParticipantCount =
    participants.length > 0 ? Math.round(expected / participants.length) : 0
  const evenPerParticipant =
    participants.length > 0 && perParticipantCount * participants.length === expected
  const runSeconds =
    plan.run !== undefined && plan.run !== null ? plan.run.solve_ms / 1000 : null
  const secondsLabel =
    runSeconds === null
      ? ''
      : String(Math.round(runSeconds * 10) / 10).replace('.', ',')

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
          {plan.run ? (
            <span className={`pill ${plan.run.finished ? 'ok' : 'wa'}`}>
              {t(
                plan.run.finished
                  ? 'plan.summary.complete'
                  : 'plan.summary.interrupted',
              )}
            </span>
          ) : null}
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
            {participants.length === 1
              ? t('plan.summary.plannedNoteOne', {
                  perParticipant: perParticipantCount,
                  expected,
                })
              : t(
                  evenPerParticipant
                    ? 'plan.summary.plannedNote'
                    : 'plan.summary.plannedNoteUneven',
                  {
                    participants: participants.length,
                    perParticipant: perParticipantCount,
                    expected,
                  },
                )}
            <br />
            {t('plan.summary.participantsNote', {
              count: withHours,
              total: participants.length,
            })}
          </span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.unplanned')}</span>
          <span className="st-plan-stat-value st-danger-text">{unplanned}</span>
          <span className="st-plan-stat-note">{t('plan.summary.unplannedNote')}</span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.calculated')}</span>
          <span className="st-plan-stat-value">
            {plan.run
              ? (() => {
                  const clock = clockInTimezone(plan.run.created_at, study.timezone)
                  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
                })()
              : '–'}
          </span>
          <span className="st-plan-stat-note">
            {plan.run
              ? secondsLabel === '1'
                ? t('plan.summary.durationOne')
                : t('plan.summary.duration', { duration: `${secondsLabel} segundos` })
              : t('plan.summary.noRun')}
          </span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.maxInterval')}</span>
          <span className="st-plan-stat-value">
            {totals.peak}{' '}
            {totals.peak <= study.max_prompts_per_slot ? (
              <span className="st-plan-stat-sub">
                {t('plan.summary.maxIntervalOf', { limit: study.max_prompts_per_slot })}
              </span>
            ) : null}
          </span>
          {totals.peak > study.max_prompts_per_slot ? (
            <span className="st-plan-stat-note">
              {t('plan.summary.maxIntervalOver', {
                limit: study.max_prompts_per_slot,
              })}
            </span>
          ) : null}
        </div>
      </div>

      {plan.run ? (
        <p className="st-plan-explanation">
          <b>
            {t(
              plan.run.finished
                ? 'plan.summary.explanationLead'
                : 'plan.summary.interruptedLead',
            )}
          </b>{' '}
          {plan.run.finished
            ? t('plan.summary.explanation', { planned })
            : t('plan.summary.interruptedExplanation')}
        </p>
      ) : null}

      <div className="st-constraint-row">
        {minGap !== null && gapOk ? (
          <span className="st-constraint-pill">
            {t('plan.summary.intervalOk', { minutes: minGap })}
          </span>
        ) : null}
        {highestPerParticipant <= study.max_prompts_per_day ? (
          <span className="st-constraint-pill">
            {t('plan.summary.dailyOk', { maxDay: study.max_prompts_per_day })}
          </span>
        ) : null}
        {totals.peak <= study.max_prompts_per_slot ? (
          <span className="st-constraint-pill">
            {t('plan.summary.slotOk', { maxSlot: study.max_prompts_per_slot })}
          </span>
        ) : null}
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
  nowMinutes,
}: {
  timezone: string
  alias: string
  availability: { start_time: string; end_time: string }[]
  anyTime: boolean
  prompts: PlanPrompt[]
  activities: Map<string, ActivityMeta>
  nowMinutes: number | null
}) {
  const requests = prompts
    .map((prompt) => ({ prompt, minutes: promptMinutes(prompt, timezone) }))
    .filter(
      (item): item is { prompt: PlanPrompt; minutes: number } =>
        item.minutes !== null && item.prompt.status !== 'unplanned',
    )
    .sort((left, right) => left.minutes - right.minutes)

  // Chips are wider than the space between close times: stack them in lanes.
  const laneEnds: number[] = []
  const placed = requests.map((request) => {
    let lane = laneEnds.findIndex((end) => request.minutes - end >= 90)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(request.minutes)
    } else {
      laneEnds[lane] = request.minutes
    }
    return { ...request, lane }
  })
  const laneCount = Math.max(1, laneEnds.length)

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
      <div
        className="st-plan-track"
        title={windowTitle}
        style={laneCount > 1 ? { height: 6 + laneCount * 24 } : undefined}
      >
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
        {nowMinutes !== null ? (
          <span className="st-plan-now" style={{ left: `${percentOf(nowMinutes)}%` }} />
        ) : null}
        {placed.map(({ prompt, minutes, lane }) => {
          const activity = activities.get(prompt.activity_id)
          const code = activity?.code ?? 'A?'
          return (
            <span
              key={prompt.prompt_id}
              className={`st-req ${requestStatusClasses[prompt.status]}`}
              style={
                {
                  left: `${percentOf(minutes)}%`,
                  top: laneCount > 1 ? 3 + lane * 24 : undefined,
                  '--st-act': activity?.color,
                  '--st-act-soft': activity?.soft,
                } as CSSProperties
              }
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
  const activityListQuery = useActivities(studyId)
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
  useStudyLiveRefresh(studyId, [studyKeys.plan(studyId, date)])

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

  const activities = plan
    ? buildActivities(plan, activityListQuery.data ?? [])
    : new Map<string, ActivityMeta>()
  // People who left or were removed keep their prompts in history, but today's plan, its counts
  // and the unplanned list are about the people who are still in the study.
  const activeParticipants = plan?.participants.filter((participant) => participant.active) ?? []
  const activeIds = new Set(activeParticipants.map((participant) => participant.participant_id))
  const activePrompts =
    plan?.prompts.filter((prompt) => activeIds.has(prompt.participant_id)) ?? []
  const participants = showAll ? activeParticipants : activeParticipants.slice(0, 12)
  const unplannedPrompts = activePrompts.filter(
    (prompt) => prompt.status === 'unplanned' || prompt.unplanned_reason !== null,
  )
  const reasonCounts = new Map<UnplannedReason, number>()
  for (const prompt of unplannedPrompts) {
    if (prompt.unplanned_reason) {
      reasonCounts.set(
        prompt.unplanned_reason,
        (reasonCounts.get(prompt.unplanned_reason) ?? 0) + 1,
      )
    }
  }

  const intervalBins = plan ? buildIntervalBins(activePrompts, timezone) : []
  const intervalTotals = binTotals(intervalBins)
  const sameHourCounts = [0, 0, 0, 0]
  if (plan) {
    const perParticipant = new Map<string, number>()
    for (const prompt of activePrompts) {
      const index = perParticipant.get(prompt.participant_id) ?? 0
      sameHourCounts[index % sameHourCounts.length] += 1
      perParticipant.set(prompt.participant_id, index + 1)
    }
  }
  const activityList = activityListQuery.data ?? []
  const minGap = smallestGap(activityList)
  const gapOk = gapRespected(activePrompts, activityList, timezone)
  const sameHourPeak = Math.max(0, ...sameHourCounts)
  const intervalScale = Math.max(intervalTotals.peak, study.max_prompts_per_slot, 1)
  const nowClock = nowClockInTimezone(timezone)
  const nowMinutes = nowClock.hour * 60 + nowClock.minute
  const nowLabel = `${String(nowClock.hour).padStart(2, '0')}:${String(
    nowClock.minute,
  ).padStart(2, '0')}`
  const showNow =
    plan?.date === today && nowMinutes >= AXIS_START && nowMinutes <= AXIS_END
  const intervalTicks = Array.from(
    new Set([intervalScale, Math.round(intervalScale / 2), 0]),
  ).sort((left, right) => right - left)

  const promptsFor = (participantId: string) =>
    activePrompts.filter((prompt) => prompt.participant_id === participantId)

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
                {formatDayMonthYear(date)}
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
          {date === today && nextDate ? (
            <button
              type="button"
              className="st-btn st-btn-ghost st-btn-sm"
              onClick={() => selectDate(nextDate)}
            >
              {t('plan.viewTomorrow')}
            </button>
          ) : null}
          {date !== today && days.includes(today) ? (
            <button
              type="button"
              className="st-btn st-btn-ghost st-btn-sm"
              onClick={() => selectDate(today)}
            >
              {t('plan.viewToday')}
            </button>
          ) : null}
          {study.starts_on && study.ends_on ? (
            <span className="st-muted-small">
              {formatDateRange(study.starts_on, study.ends_on).replace(' a ', ' – ')}
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

      {plan && activePrompts.length === 0 ? (
        <div className="st-note st-note-info" role="status">
          <span>{t('plan.schedule.noPrompts')}</span>
        </div>
      ) : null}

      {plan ? (
        <PlanSummary
          plan={plan}
          study={study}
          participants={activeParticipants}
          prompts={activePrompts}
          minGap={minGap}
          gapOk={gapOk}
        />
      ) : null}

      <section className="card st-plan-how" aria-label={t('plan.how.title')}>
        <h2 className="h2">{t('plan.how.title')}</h2>
        <div className="st-plan-how-grid">
          <div className="st-plan-how-step">
            <span className="st-step" aria-hidden="true">
              1
            </span>
            <div className="st-plan-how-copy">
              <span className="st-plan-how-title">{t('plan.how.step1.title')}</span>
              <p className="sub">{t('plan.how.step1.body')}</p>
            </div>
          </div>
          <div className="st-plan-how-step">
            <span className="st-step" aria-hidden="true">
              2
            </span>
            <div className="st-plan-how-copy">
              <span className="st-plan-how-title">{t('plan.how.step2.title')}</span>
              <p className="sub">
                {t('plan.how.step2.body', {
                  maxDay: study.max_prompts_per_day,
                  maxSlot: study.max_prompts_per_slot,
                })}
              </p>
            </div>
          </div>
          <div className="st-plan-how-step">
            <span className="st-step" aria-hidden="true">
              3
            </span>
            <div className="st-plan-how-copy">
              <span className="st-plan-how-title">{t('plan.how.step3.title')}</span>
              <p className="sub">
                {t('plan.how.step3.body', { style: styleLabel(study.schedule_style) })}
              </p>
            </div>
          </div>
          <div className="st-plan-how-step">
            <span className="st-step" aria-hidden="true">
              4
            </span>
            <div className="st-plan-how-copy">
              <span className="st-plan-how-title">{t('plan.how.step4.title')}</span>
              <p className="sub">{t('plan.how.step4.body')}</p>
            </div>
          </div>
        </div>
      </section>

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
                      {reason === 'min_gap_infeasible' ||
                      reason === 'outside_availability' ? (
                        <Link
                          className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                          to={`/estudos/${studyId}/atividades`}
                        >
                          <ChevronRightIcon width={16} height={16} />
                          {t('plan.unplanned.extend', {
                            activity: activity?.code ?? prompt.activity_title,
                          })}
                        </Link>
                      ) : null}
                      <Link
                        className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                        to={`/estudos/${studyId}/participantes`}
                      >
                        <ChevronRightIcon width={16} height={16} />
                        {t('plan.unplanned.talk')}
                      </Link>
                      {reason === 'slot_cap' ? (
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
              <p className="st-sub">
                {plan.date === today ? t('plan.reasons.note') : t('plan.reasons.noteTomorrow')}
              </p>
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

      {plan && activePrompts.length > 0 ? (
        <div className="st-grid-interval">
          <section className="card st-interval-card" aria-label={t('plan.interval.title')}>
            <div>
              <h2 className="h2">{t('plan.interval.title')}</h2>
              <p className="st-sub">
                {t('plan.interval.subtitle', { limit: study.max_prompts_per_slot })}
              </p>
            </div>
            <div className="st-interval-chart">
              <div className="st-interval-axis" aria-hidden="true">
                {intervalTicks.map((tick) => (
                  <span
                    key={tick}
                    style={{ bottom: `${(tick / intervalScale) * 100}%` }}
                  >
                    {tick}
                  </span>
                ))}
              </div>
              <div className="st-interval-plot">
                <span className="st-interval-baseline" />
                {[25, 50, 75].map((percent) => (
                  <span
                    key={percent}
                    className="st-interval-grid"
                    style={{ bottom: `${percent}%` }}
                  />
                ))}
                <span
                  className="st-interval-limit"
                  style={{
                    bottom: `${(study.max_prompts_per_slot / intervalScale) * 100}%`,
                    top: 'auto',
                  }}
                />
                {showNow ? (
                  <span
                    className="st-interval-now"
                    style={{ left: `${percentOf(nowMinutes)}%` }}
                  />
                ) : null}
                <div className="st-interval-bars">
                  {intervalBins.map((bin, index) => {
                    const start = AXIS_START + index * INTERVAL_MINUTES
                    return (
                      <span
                        className="st-interval-col"
                        key={index}
                        title={`${formatMinutes(start)}: ${
                          bin.sent
                        } já enviados, ${bin.planned} por enviar`}
                      >
                        <span
                          className="st-interval-planned"
                          style={{ height: `${(bin.planned / intervalScale) * 100}%` }}
                        />
                        <span
                          className="st-interval-sent"
                          style={{ height: `${(bin.sent / intervalScale) * 100}%` }}
                        />
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="st-interval-labels" aria-hidden="true">
              {AXIS_GRID.map((hour) => (
                <span
                  key={hour}
                  style={{ left: `${((hour * 60 - AXIS_START) * 100) / AXIS_SPAN}%` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            <div className="st-activity-legend">
              <span className="st-activity-legend-item">
                <i
                  aria-hidden="true"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: 'var(--fn-color-primary)',
                  }}
                />
                {t('plan.interval.sent', { count: intervalTotals.sent })}
              </span>
              <span className="st-activity-legend-item">
                <i
                  aria-hidden="true"
                  style={{ width: 12, height: 12, borderRadius: 3, background: '#9DB4F7' }}
                />
                {t('plan.interval.planned', { count: intervalTotals.planned })}
              </span>
              <span className="st-activity-legend-item">
                <i
                  aria-hidden="true"
                  style={{ width: 18, borderTop: '2px dashed #B96A00' }}
                />
                {t('plan.interval.limit', { limit: study.max_prompts_per_slot })}
              </span>
              {showNow ? (
                <span className="st-activity-legend-item">
                  <i
                    aria-hidden="true"
                    style={{
                      width: 2,
                      height: 12,
                      background: 'var(--fn-color-text)',
                    }}
                  />
                  {t('plan.interval.now', {
                    time: `${String(nowClock.hour).padStart(2, '0')}:${String(
                      nowClock.minute,
                    ).padStart(2, '0')}`,
                  })}
                </span>
              ) : null}
            </div>
          </section>

          <section className="card st-compare-card" aria-label={t('plan.compare.title')}>
            <div className="st-card-head st-card-head-start">
              <h2 className="h2">{t('plan.compare.title')}</h2>
              <p className="st-sub">
                {t('plan.compare.subtitle', { count: activePrompts.length })}
              </p>
            </div>

            <div className="st-compare-chart">
              <div className="st-compare-axis" aria-hidden="true">
                <span>{sameHourPeak}</span>
                <span>0</span>
              </div>
              <div className="st-compare-plot">
                <span className="st-compare-baseline" />
                <span className="st-compare-limit" aria-hidden="true" />
                <div className="st-compare-bars">
                  {Array.from({ length: INTERVAL_BIN_COUNT }, (_, index) => {
                    const fixedHour = [0, 16, 32, 48].indexOf(index)
                    return (
                      <span
                        key={index}
                        className="st-compare-bar"
                        style={{
                          height:
                            fixedHour >= 0
                              ? `${(sameHourCounts[fixedHour] / Math.max(1, sameHourPeak)) * 88}px`
                              : '0',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="st-compare-labels" aria-hidden="true">
              {['08:00', '12:00', '16:00', '20:00'].map((label, index) => (
                <span key={label} className="mono" style={{ left: `${index * 27.586}%` }}>
                  {label}
                </span>
              ))}
            </div>

            <div className="st-compare-stats">
              <div className="st-compare-stat">
                <span className="st-compare-stat-label">{t('plan.compare.sameHours')}</span>
                <span className="st-compare-stat-value">
                  {sameHourPeak}{' '}
                  <span className="st-compare-stat-sub">{t('plan.compare.sameHoursPeak')}</span>
                </span>
              </div>
              <div className="st-compare-stat st-compare-stat-primary">
                <span className="st-compare-stat-label">{t('plan.compare.fieldnote')}</span>
                <span className="st-compare-stat-value">
                  {intervalTotals.peak}{' '}
                  <span className="st-compare-stat-sub">{t('plan.compare.sameHoursPeak')}</span>
                </span>
              </div>
            </div>
            <p className="st-sub">{t('plan.compare.note')}</p>
          </section>
        </div>
      ) : null}

      {plan ? (
        <section className="card st-schedule" aria-label={t('plan.schedule.title')}>
          <div className="st-schedule-head">
            <div className="st-schedule-heading">
              <h2 className="h2">{t('plan.schedule.title')}</h2>
              <p className="st-sub">
                {showNow
                  ? t('plan.schedule.subtitle', { time: nowLabel })
                  : t('plan.schedule.subtitleNoNow')}
              </p>
            </div>
            {activeParticipants.length > 12 ? (
              <button
                type="button"
                className="st-btn st-btn-ghost st-btn-sm"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll
                  ? t('plan.schedule.viewLess')
                  : t('plan.schedule.viewAll', { count: activeParticipants.length })}
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
              <span className="st-availability-swatch" />
              {t('plan.schedule.availability')}
            </span>
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
                  nowMinutes={showNow ? nowMinutes : null}
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
              total: activeParticipants.length,
            })}
          </p>
        </section>
      ) : null}
    </div>
  )
}
