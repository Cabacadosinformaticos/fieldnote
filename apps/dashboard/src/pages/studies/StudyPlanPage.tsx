import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckIcon, ChevronRightIcon } from '../../components/icons'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from '../../components/studies/StudyIcons'
import {
  planAxisEnd,
  planAxisStart,
  planReasonOrder,
  studiesErrorMessage,
  useStudyPlan,
  type PlanActivity,
  type PlanDay,
  type PlanParticipant,
  type PlanReasonId,
  type PlanRequestStatus,
} from '../../api/studies'
import { t, type StudiesKey } from '../../i18n/studies'
import '../../styles/studies.css'

type DayKey = 'today' | 'tomorrow'

const reasonLabels: Record<PlanReasonId, StudiesKey> = {
  outsideHours: 'plan.reasons.outsideHours',
  interval: 'plan.reasons.interval',
  dailyMax: 'plan.reasons.dailyMax',
  slotFull: 'plan.reasons.slotFull',
  timeout: 'plan.reasons.timeout',
}

const reasonShortLabels: Record<PlanReasonId, StudiesKey> = {
  outsideHours: 'plan.reason.short.outsideHours',
  interval: 'plan.reason.short.interval',
  dailyMax: 'plan.reason.short.dailyMax',
  slotFull: 'plan.reason.short.slotFull',
  timeout: 'plan.reason.short.timeout',
}

const statusLabels: Record<PlanRequestStatus, StudiesKey> = {
  responded: 'plan.schedule.status.responded',
  sent: 'plan.schedule.status.sent',
  expired: 'plan.schedule.status.expired',
  planned: 'plan.schedule.status.planned',
}

const axisSpan = planAxisEnd - planAxisStart

function percentOf(minutes: number) {
  return ((minutes - planAxisStart) / axisSpan) * 100
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}:${String(rest).padStart(2, '0')}`
}

function activityLabel(code: string, activities: PlanActivity[]) {
  return activities.find((activity) => activity.code === code)?.name ?? code
}

function TimelineRow({
  participant,
  nowPercent,
  activities,
}: {
  participant: PlanParticipant
  nowPercent: number | null
  activities: PlanActivity[]
}) {
  const windowLeft = percentOf(participant.windowStart)
  const windowWidth = percentOf(participant.windowEnd) - windowLeft

  return (
    <div className="st-plan-row">
      <span className="mono st-plan-alias">{participant.alias}</span>
      <div className="st-plan-track">
        <span
          className="st-plan-window"
          style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }}
        />
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className="st-plan-gridline"
            style={{ left: `${(index * 2 * 60 * 100) / axisSpan}%` }}
          />
        ))}
        {nowPercent !== null ? (
          <span className="st-plan-now" style={{ left: `${nowPercent}%` }} />
        ) : null}
        {participant.requests.map((request, index) => (
          <span
            key={`${request.activity}-${request.minutes}-${index}`}
            className={`st-req st-req-${request.status} st-req-${request.activity.toLowerCase()}`}
            style={{ left: `${percentOf(request.minutes)}%` }}
            title={`${request.activity} ${activityLabel(request.activity, activities)} · ${formatMinutes(request.minutes)} · ${t(statusLabels[request.status])}`}
          >
            <b>{request.activity}</b> {formatMinutes(request.minutes)}
          </span>
        ))}
      </div>
      <div className="st-plan-unplanned-cell">
        {participant.unplanned ? (
          <span className="st-plan-reason-badge">
            <b>{participant.unplanned.activity}</b>
            {t(reasonShortLabels[participant.unplanned.reason])}
          </span>
        ) : (
          <span className="st-plan-none">{t('plan.schedule.none')}</span>
        )}
      </div>
    </div>
  )
}

function PlanSummary({ day, peak }: { day: PlanDay; peak: number }) {
  return (
    <section
      className="card st-plan-summary"
      aria-label={
        day.key === 'today' ? t('plan.summary.today') : t('plan.summary.tomorrow')
      }
    >
      <div className="st-plan-summary-head">
        <div className="st-plan-summary-title">
          <h2 className="h2">
            {t(day.key === 'today' ? 'plan.summary.today' : 'plan.summary.tomorrow')}
          </h2>
          <span className="st-complete-pill">
            <CheckIcon width={14} height={14} />
            {t('plan.summary.fromApi')}
          </span>
        </div>
        <span className="st-plan-style">
          {t('plan.summary.styleLine', {
            style: day.styleName,
            maxDay: day.maxPerDay,
            maxSlot: day.maxPerSlot,
          })}
        </span>
      </div>

      <div className="st-plan-stats">
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.planned')}</span>
          <span className="st-plan-stat-value">
            {day.planned}{' '}
            <span className="st-plan-stat-sub">
              {t('plan.summary.plannedOf', { expected: day.expected })}
            </span>
          </span>
          <span className="st-plan-stat-note">
            {t('plan.summary.plannedNote', {
              participants: day.participantsActive,
              maxDay: day.maxPerDay,
            })}
          </span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.unplanned')}</span>
          <span className="st-plan-stat-value st-danger-text">{day.unplanned}</span>
          <span className="st-plan-stat-note">{t('plan.summary.unplannedNote')}</span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.calculated')}</span>
          <span className="st-plan-stat-value">{day.calculatedAt}</span>
          <span className="st-plan-stat-note">
            {t('plan.summary.duration', { duration: day.duration })}
          </span>
        </div>
        <div className="st-plan-stat">
          <span className="st-plan-stat-label">{t('plan.summary.maxInterval')}</span>
          <span className="st-plan-stat-value">
            {day.maxPerSlot}{' '}
            <span className="st-plan-stat-sub">
              {t('plan.summary.maxIntervalOf', { limit: day.maxPerSlot })}
            </span>
          </span>
          <span className="st-plan-stat-note">
            {t('plan.summary.maxIntervalNote', { count: Math.max(1, peak) })}
          </span>
        </div>
      </div>

      <p className="st-plan-explanation">
        <b>{t('plan.summary.explanationLead')}</b>{' '}
        {t('plan.summary.explanation', { planned: day.planned })}
      </p>

      <div className="st-constraint-row">
        <span className="st-constraint-pill">
          <CheckIcon width={16} height={16} />
          {t('plan.summary.intervalOk', { minutes: day.intervalMin })}
        </span>
        <span className="st-constraint-pill">
          <CheckIcon width={16} height={16} />
          {t('plan.summary.dailyOk', { maxDay: day.maxPerDay })}
        </span>
        <span className="st-constraint-pill">
          <CheckIcon width={16} height={16} />
          {t('plan.summary.slotOk', { maxSlot: day.maxPerSlot })}
        </span>
      </div>
    </section>
  )
}

const steps: { title: StudiesKey; body: StudiesKey }[] = [
  { title: 'plan.how.step1.title', body: 'plan.how.step1.body' },
  { title: 'plan.how.step2.title', body: 'plan.how.step2.body' },
  { title: 'plan.how.step3.title', body: 'plan.how.step3.body' },
  { title: 'plan.how.step4.title', body: 'plan.how.step4.body' },
]

export default function StudyPlanPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const [dayKey, setDayKey] = useState<DayKey>('today')
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const plan = useStudyPlan(studyId)

  const day = dayKey === 'today' ? plan.today : plan.tomorrow
  const otherDay = dayKey === 'today' ? plan.tomorrow : plan.today
  const isToday = dayKey === 'today'

  if (plan.isLoading && !day) {
    return (
      <div className="st-page">
        <p className="st-empty">{t('state.loading')}</p>
      </div>
    )
  }

  if (!day) {
    return (
      <div className="st-page">
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(plan.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void plan.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const participants = showAll ? day.participants : day.participants.slice(0, 12)
  const peak = Math.max(
    0,
    ...day.intervalSent.map((sent, index) => sent + (day.intervalPlanned[index] ?? 0)),
  )
  const maxIntervalLoad = Math.max(4, peak)
  const calculatedAt = day.calculatedAt

  function selectDay(next: DayKey) {
    setDayKey(next)
    setDayPickerOpen(false)
  }

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
              disabled={isToday}
              onClick={() => selectDay('today')}
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
                {day.dateLabel}
                <ChevronDownIcon />
              </button>
              {dayPickerOpen ? (
                <div className="st-day-menu" role="menu">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={dayKey === 'today'}
                    onClick={() => selectDay('today')}
                  >
                    {plan.today?.dateLabel ?? t('plan.date.today')}
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={dayKey === 'tomorrow'}
                    onClick={() => selectDay('tomorrow')}
                  >
                    {plan.tomorrow?.dateLabel ?? t('plan.date.tomorrow')}
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="st-btn st-icon-btn"
              aria-label={t('plan.nextDay')}
              disabled={!isToday}
              onClick={() => selectDay('tomorrow')}
            >
              <ChevronRightIcon />
            </button>
          </div>
          <button
            type="button"
            className="st-btn"
            onClick={() => selectDay(isToday ? 'tomorrow' : 'today')}
          >
            {t(isToday ? 'plan.viewTomorrow' : 'plan.viewToday')}
          </button>
        </div>
      </header>

      {plan.error ? (
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(plan.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void plan.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      {!plan.hasPromptData ? (
        <div className="st-note st-note-info" role="status">
          <span>{t('plan.fallback.noPrompts')}</span>
        </div>
      ) : null}

      <PlanSummary day={day} peak={peak} />

      <section className="card st-plan-how" aria-label={t('plan.how.title')}>
        <h2 className="h2">{t('plan.how.title')}</h2>
        <div className="st-plan-how-grid">
          {steps.map((step, index) => (
            <div className="st-plan-how-step" key={step.title}>
              <span className="st-step">{index + 1}</span>
              <div className="st-plan-how-copy">
                <span className="st-plan-how-title">{t(step.title)}</span>
                <p className="st-sub">{t(step.body)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card st-unplanned" aria-label={t('plan.unplanned.title')}>
        <div className="st-unplanned-head">
          <div className="st-unplanned-title">
            <h2 className="h2">
              {t(day.key === 'today' ? 'plan.unplanned.title' : 'plan.unplanned.titleTomorrow')}
            </h2>
            <span className="st-count-danger">
              <AlertTriangleIcon width={14} height={14} />
              {day.unplanned === 1
                ? t('plan.unplanned.one')
                : t('plan.unplanned.count', { count: day.unplanned })}
            </span>
          </div>
          <span className="st-muted-small">{t('plan.unplanned.note')}</span>
        </div>

        <div className="st-unplanned-layout">
          <div className="st-unplanned-list">
            {day.unplannedItems.length === 0 ? (
              <p className="st-empty">{t('plan.fallback.unplanned')}</p>
            ) : null}
            {day.unplannedItems.map((item) => (
              <div className="st-unplanned-row" key={item.id}>
                <div className="st-unplanned-alias">
                  <span className="mono">{item.alias}</span>
                  <span className="st-tag st-tag-sm">{item.activity}</span>
                </div>
                <div className="st-unplanned-copy">
                  <span className="st-unplanned-activity">
                    {activityLabel(item.activity, plan.planActivities)}
                  </span>
                  <span className="st-reason-pill">{t(reasonLabels[item.reason])}</span>
                  <p className="st-unplanned-detail">{item.detail}</p>
                </div>
                <div className="st-unplanned-actions">
                  <span className="st-unplanned-actions-label">{t('plan.unplanned.whatCanDo')}</span>
                  {item.reason === 'interval' ? (
                    <>
                      <Link
                        className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                        to={`/estudos/${studyId}/atividades`}
                      >
                        <ChevronRightIcon width={16} height={16} />
                        {t('plan.unplanned.extend', { activity: item.activity })}
                      </Link>
                      <Link
                        className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                        to={`/estudos/${studyId}/participantes`}
                      >
                        <ChevronRightIcon width={16} height={16} />
                        {t('plan.unplanned.talk')}
                      </Link>
                    </>
                  ) : null}
                  {item.reason === 'slotFull' ? (
                    <Link
                      className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                      to={`/estudos/${studyId}/definicoes`}
                    >
                      <ChevronRightIcon width={16} height={16} />
                      {t('plan.unplanned.raise')}
                    </Link>
                  ) : null}
                  {item.reason !== 'interval' && item.reason !== 'slotFull' ? (
                    <Link
                      className="st-btn st-btn-ghost st-btn-sm st-btn-left"
                      to={`/estudos/${studyId}/participantes`}
                    >
                      <ChevronRightIcon width={16} height={16} />
                      {t('plan.unplanned.talk')}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <aside className="st-reasons">
            <span className="st-plan-how-title">{t('plan.reasons.title')}</span>
            <p className="st-sub">
              {t(day.key === 'today' ? 'plan.reasons.note' : 'plan.reasons.noteTomorrow')}
            </p>
            <div className="st-reason-list">
              {planReasonOrder.map((reason) => {
                const count = day.reasonCounts[reason]
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

      <div className="st-grid-interval">
        <section className="card st-interval-card" aria-label={t('plan.interval.title')}>
          <div className="st-card-head st-card-head-start">
            <h2 className="h2">{t('plan.interval.title')}</h2>
            <p className="st-sub">
              {t('plan.interval.subtitle', { limit: day.maxPerSlot })}
            </p>
          </div>

          <div className="st-interval-chart">
            <div className="st-interval-axis" aria-hidden="true">
              <span style={{ bottom: '160px' }}>{maxIntervalLoad}</span>
              <span style={{ bottom: '120px' }}>{Math.round(maxIntervalLoad * 0.75)}</span>
              <span style={{ bottom: '80px' }}>{Math.round(maxIntervalLoad / 2)}</span>
              <span style={{ bottom: '40px' }}>{Math.round(maxIntervalLoad / 4)}</span>
              <span style={{ bottom: '0' }}>0</span>
            </div>
            <div className="st-interval-plot">
              <span className="st-interval-baseline" />
              <span className="st-interval-grid" style={{ bottom: '40px' }} />
              <span className="st-interval-grid" style={{ bottom: '80px' }} />
              <span className="st-interval-grid" style={{ bottom: '160px' }} />
              <span className="st-interval-limit" aria-hidden="true" />
              {day.nowPercent !== null ? (
                <span className="st-interval-now" style={{ left: `${day.nowPercent}%` }} />
              ) : null}
              <div className="st-interval-bars">
                {day.intervalSent.map((sent, index) => {
                  const planned = day.intervalPlanned[index]
                  const minutes = planAxisStart + index * 15
                  return (
                    <div
                      className="st-interval-col"
                      key={index}
                      title={`${formatMinutes(minutes)}: ${sent} enviados, ${planned} por enviar`}
                    >
                      {planned > 0 ? (
                        <span
                          className="st-interval-planned"
                          style={{ height: `${planned * 40}px` }}
                        />
                      ) : null}
                      {sent > 0 ? (
                        <span className="st-interval-sent" style={{ height: `${sent * 40}px` }} />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="st-interval-labels">
            {[8, 10, 12, 14, 16, 18, 20, 22].map((hour) => (
              <span
                key={hour}
                className="mono"
                style={{ left: `${((hour - 8) * 60 * 100) / axisSpan}%` }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          <div className="st-legend-row st-legend-row-spaced">
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-sent" />
              {t('plan.interval.sent', { count: day.sentTotal })}
            </span>
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-planned-solid" />
              {t('plan.interval.planned', { count: day.pendingTotal })}
            </span>
            <span className="st-legend-item">
              <span className="st-limit-swatch st-limit-swatch-brown" />
              {t('plan.interval.limit', { limit: day.maxPerSlot })}
            </span>
            {day.nowLabel ? (
              <span className="st-legend-item">
                <span className="st-now-swatch" />
                {t('plan.interval.now', { time: day.nowLabel })}
              </span>
            ) : null}
          </div>
        </section>

        <section className="card st-compare-card" aria-label={t('plan.compare.title')}>
          <div className="st-card-head st-card-head-start">
            <h2 className="h2">{t('plan.compare.title')}</h2>
            <p className="st-sub">
              {t('plan.compare.subtitle', { count: day.expected })}
            </p>
          </div>

          <div className="st-compare-chart">
            <div className="st-compare-axis" aria-hidden="true">
              <span>{Math.max(1, day.expected)}</span>
              <span>0</span>
            </div>
            <div className="st-compare-plot">
              <span className="st-compare-baseline" />
              <span className="st-compare-limit" aria-hidden="true" />
              <div className="st-compare-bars">
                {Array.from({ length: 58 }, (_, index) => (
                  <span
                    key={index}
                    className="st-compare-bar"
                    style={{
                      height:
                        index % 16 === 0
                          ? `${Math.min(88, (day.expected / Math.max(1, peak)) * 88)}px`
                          : '0',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="st-compare-labels">
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
                {Math.max(1, day.expected)}{' '}
                <span className="st-compare-stat-sub">{t('plan.compare.sameHoursPeak')}</span>
              </span>
            </div>
            <div className="st-compare-stat st-compare-stat-primary">
              <span className="st-compare-stat-label">{t('plan.compare.fieldnote')}</span>
              <span className="st-compare-stat-value">
                {Math.max(1, peak)} <span className="st-compare-stat-sub">{t('plan.compare.sameHoursPeak')}</span>
              </span>
            </div>
          </div>
          <p className="st-sub">{t('plan.compare.note')}</p>
        </section>
      </div>

      <section className="card st-schedule" aria-label={t('plan.schedule.title')}>
        <div className="st-schedule-head">
          <div className="st-schedule-heading">
            <h2 className="h2">{t('plan.schedule.title')}</h2>
            <p className="st-sub">
              {day.nowLabel
                ? t('plan.schedule.subtitle', { time: day.nowLabel })
                : t('plan.schedule.subtitle', { time: '—' })}
            </p>
          </div>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-sm"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll
              ? t('plan.schedule.viewLess')
              : t('plan.schedule.viewAll', { count: day.participants.length })}
          </button>
        </div>

        <div className="st-activity-legend">
          {plan.planActivities.map((activity) => (
            <span className="st-activity-legend-item" key={activity.code}>
              <span
                className="st-activity-chip"
                style={{ background: activity.color }}
              >
                {activity.code.slice(1)}
              </span>
              {activity.name}
            </span>
          ))}
        </div>

        <div className="st-status-legend">
          <span className="st-status-legend-item">
            <span className="st-status-chip st-status-chip-responded">1</span>
            {t('plan.schedule.status.responded')}
          </span>
          <span className="st-status-legend-item">
            <span className="st-status-chip st-status-chip-sent">1</span>
            {t('plan.schedule.status.sent')}
          </span>
          <span className="st-status-legend-item">
            <span className="st-status-chip st-status-chip-expired">1</span>
            {t('plan.schedule.status.expired')}
          </span>
          <span className="st-status-legend-item">
            <span className="st-status-chip st-status-chip-planned">1</span>
            {t('plan.schedule.status.planned')}
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
              {[8, 10, 12, 14, 16, 18, 20, 22].map((hour) => (
                <span
                  key={hour}
                  className="mono"
                  style={{ left: `${((hour - 8) * 60 * 100) / axisSpan}%` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            <span>{t('plan.schedule.unplanned')}</span>
          </div>

          <div className="st-schedule-body">
            {participants.map((participant, index) => (
              <TimelineRow
                participant={participant}
                nowPercent={day.nowPercent}
                activities={plan.planActivities}
                key={`${participant.alias}-${index}`}
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
            total: day.participants.length,
            note: t('plan.fallback.windows'),
          })}
        </p>
        {otherDay ? (
          <p className="st-fine-print">{t('plan.fallback.otherDay', { date: otherDay.dateLabel })}</p>
        ) : null}
        <p className="st-fine-print">
          {t('plan.fallback.generated', { time: calculatedAt, style: day.styleName })}
        </p>
      </section>
    </div>
  )
}
