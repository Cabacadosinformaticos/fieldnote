import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckIcon, ExportIcon } from '../../components/icons'
import EntryThumb from '../../components/studies/EntryThumb'
import StudyStatusPill from '../../components/studies/StudyStatusPill'
import {
  AlertTriangleIcon,
  BanIcon,
  CalendarAlertIcon,
  FileTextIcon,
  MailIcon,
  StopIcon,
  UserIcon,
  UsersIcon,
} from '../../components/studies/StudyIcons'
import {
  studiesErrorMessage,
  useCloseStudy,
  useStudyOverview,
  useStudyRole,
  type AdherenceCell,
  type AttentionActionKind,
  type AttentionIcon,
} from '../../api/studies'
import { t, type StudiesKey } from '../../i18n/studies'
import '../../styles/studies.css'

const attentionIcons: Record<AttentionIcon, typeof AlertTriangleIcon> = {
  alert: AlertTriangleIcon,
  users: UsersIcon,
  calendar: CalendarAlertIcon,
  user: UserIcon,
  mail: MailIcon,
  ban: BanIcon,
}

const attentionLabels: Record<AttentionActionKind, StudiesKey> = {
  retry: 'overview.attention.retry',
  review: 'overview.attention.review',
  plan: 'overview.attention.plan',
  participant: 'overview.attention.participant',
  invite: 'overview.attention.invite',
}

function adherenceTier(cell: AdherenceCell | null) {
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

export default function StudyOverviewPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const overview = useStudyOverview(studyId)
  const access = useStudyRole(studyId)
  const closeStudy = useCloseStudy(studyId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const study = overview.data

  if (overview.isLoading && !study) {
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
          <span>{studiesErrorMessage(overview.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void overview.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const status = study.status
  const canClose = access.canManage && status === 'ongoing'
  const trendAria = study.trend.map((point) => `${point.label}, ${point.value}`).join('; ')
  const typeTotal = Math.max(1, study.entriesTotal)

  return (
    <div className="st-page">
      <header className="st-overview-header">
        <div className="st-header-copy">
          <div className="st-overview-title-row">
            <h1 className="st-title st-title-h1">{study.title}</h1>
            <StudyStatusPill status={status} />
          </div>
          <div className="st-overview-meta">
            <strong className="st-overview-day">
              {t('overview.dayOf', { day: study.day, total: study.totalDays })}
            </strong>
            <span
              className="st-day-strip"
              role="img"
              aria-label={t('overview.dayStripAria', {
                day: study.day,
                total: study.totalDays,
              })}
            >
              {Array.from({ length: study.totalDays }, (_, index) => (
                <span
                  key={index}
                  className={
                    index < study.day - 1
                      ? 'st-day st-day-done'
                      : index === study.day - 1
                        ? 'st-day st-day-current'
                        : 'st-day'
                  }
                />
              ))}
            </span>
            <span>
              {t('overview.range', {
                range: study.dateRange,
                participants: t('common.participantCount', { count: study.participantCount }),
              })}
            </span>
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

      {overview.error ? (
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(overview.error)}</span>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-xs"
            onClick={() => void overview.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      <section className="st-indicators" aria-label={t('overview.indicatorsAria')}>
        <div className="st-kpi st-kpi-primary">
          <div className="st-kpi-copy">
            <span className="st-kpi-label st-kpi-label-primary">{t('overview.adherenceToday')}</span>
            <span className="st-kpi-hero">{study.adherence.percent}</span>
            <span className="st-kpi-note">
              {t('overview.adherenceNote', {
                answered: study.adherence.answered,
                sent: study.adherence.sent,
              })}
            </span>
          </div>
          <div className="st-trend" role="img" aria-label={t('overview.trendAria', { values: trendAria })}>
            {study.trend.map((point) => (
              <div className="st-trend-item" key={point.label}>
                <span className="st-trend-value">{point.value}</span>
                <span
                  className={point.current ? 'st-trend-bar st-trend-bar-current' : 'st-trend-bar'}
                  style={{ height: point.height }}
                />
                <span className="st-trend-label">{point.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.entries')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{study.entries.total}</span>
            <span className="st-badge-up">
              {t('overview.entriesToday', { count: study.entries.today })}
            </span>
          </span>
          <span className="st-kpi-note">
            {t('overview.entriesNote', {
              answered: study.entries.answered,
              free: study.entries.free,
            })}
          </span>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.activeParticipants')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{study.active.value}</span>
            <span className="st-kpi-sub">
              {t('overview.activeOf', { total: study.active.total })}
            </span>
          </span>
          <span className="st-kpi-note">
            {t('overview.activeNote', {
              invites: study.active.invites,
              declined: study.active.declined,
            })}
          </span>
        </div>

        <div className="st-kpi">
          <span className="st-kpi-label">{t('overview.effort')}</span>
          <span className="st-kpi-value-row">
            <span className="st-kpi-value">{study.effort.value}</span>
            <span className="st-kpi-sub">{t('overview.effortPerDay')}</span>
          </span>
          <span className="st-kpi-note">{study.effort.note}</span>
        </div>
      </section>

      <div className="st-grid-2 st-grid-stretch">
        <section className="card st-attention-card" aria-labelledby="h-atencao">
          <div className="st-card-head st-card-head-spaced">
            <h2 className="h2" id="h-atencao">
              {t('overview.attention.title')}
            </h2>
            <span className="st-count-warning">
              {t('overview.attention.points', { count: study.attention.length })}
            </span>
          </div>
          <div className="st-attention-list">
            {study.attention.map((item) => {
              const Icon = attentionIcons[item.icon]
              const isRetry = item.action?.kind === 'retry'
              return (
                <div className="st-attention-row" key={item.id}>
                  <span className={`st-attention-icon st-tone-${item.tone}`} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="st-attention-copy">
                    <span className="st-attention-title">{item.title}</span>
                    <span className="st-attention-detail">{item.detail}</span>
                  </span>
                  {item.action ? (
                    item.action.type === 'button' ? (
                      <button
                        type="button"
                        className="st-btn st-btn-primary st-btn-xs"
                        disabled={retrying && isRetry}
                        onClick={() => setRetrying(true)}
                      >
                        {retrying && isRetry ? t('overview.attention.retrying') : t(attentionLabels[item.action.kind])}
                      </button>
                    ) : (
                      <Link
                        className="st-btn st-btn-ghost st-btn-xs"
                        to={`/estudos/${study.id}/${item.action.to}`}
                      >
                        {t(attentionLabels[item.action.kind])}
                      </Link>
                    )
                  ) : (
                    <span className="st-attention-none">{t('overview.attention.none')}</span>
                  )}
                </div>
              )
            })}
            {study.attention.length === 0 ? (
              <p className="st-empty">{t('overview.attention.empty')}</p>
            ) : null}
          </div>
        </section>

        <section className="card st-funnel-card" aria-labelledby="h-funil">
          <div className="st-card-head">
            <h2 className="h2" id="h-funil">
              {t('overview.funnel.title', { time: study.currentTime })}
            </h2>
            <span className="st-muted-small">{study.dateLabel}</span>
          </div>

          <div className="st-funnel">
            {study.funnel.map((step) => (
              <div className="st-funnel-row" key={step.label}>
                <span className="st-funnel-label">{t(`overview.funnel.${step.label}`)}</span>
                <div className="st-funnel-track-wrap">
                  <div className="st-funnel-track">
                    <div
                      className="st-funnel-fill"
                      style={{ width: `${step.width}%`, background: step.color }}
                    />
                  </div>
                  <span className="st-funnel-note">{step.note}</span>
                </div>
                <span className="st-funnel-value">{step.value}</span>
              </div>
            ))}
          </div>

          <div className="st-outcomes">
            <span className="st-outcomes-title">
              {t('overview.outcomes.title', { count: study.adherence.sent })}
            </span>
            <div
              className="st-outcome-bar"
              role="img"
              aria-label={t('overview.outcomes.aria', {
                answered: study.outcomes.answered,
                open: study.outcomes.open,
                expired: study.outcomes.expired,
              })}
            >
              <div
                className="st-outcome-answered"
                style={{ flex: `${study.outcomes.answered} 1 0` }}
              >
                {study.outcomes.answered}
              </div>
              <div className="st-outcome-open" style={{ flex: `${study.outcomes.open} 1 0` }}>
                {study.outcomes.open}
              </div>
              <div className="st-outcome-expired" style={{ flex: `${study.outcomes.expired} 1 0` }}>
                {study.outcomes.expired}
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
              <span className="st-mini-stat-value">{study.pending.pending}</span>
              <span className="st-mini-stat-note">
                {t('overview.pendingMath', {
                  sent: study.pending.sent,
                  pending: study.pending.pending,
                  planned: study.pending.planned,
                })}
              </span>
            </div>
            <div className="st-mini-stat st-mini-stat-warning">
              <span className="st-mini-stat-label">{t('overview.unplanned')}</span>
              <span className="st-mini-stat-row">
                <span className="st-mini-stat-value">{study.pending.unplanned}</span>
                <Link className="st-link" to={`/estudos/${study.id}/plano`}>
                  {t('overview.viewPlan')}
                </Link>
              </span>
              <span className="st-mini-stat-note">{t('overview.unplannedUnavailable')}</span>
            </div>
          </div>
          <span className="st-fine-print">{t('overview.fallback.unplanned')}</span>
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
                shown: study.adherenceRows.length,
                total: study.participantCount,
              })}
            </span>
          </div>

          <div className="st-adherence-table" role="table" aria-label={t('overview.adherence.title')}>
            <div className="st-adherence-row st-adherence-head" role="row">
              <span role="columnheader">{t('overview.adherence.participant')}</span>
              {study.dayHeads.map((head, index) => (
                <span role="columnheader" className="st-adherence-day" key={index}>
                  <span className="st-adherence-day-label">{head.label}</span>
                  <span className="st-adherence-day-sub">{head.sub}</span>
                </span>
              ))}
              <span role="columnheader">{t('overview.adherence.lastEntry')}</span>
            </div>

            {study.adherenceRows.map((row, rowIndex) => (
              <div
                className={row.warn ? 'st-adherence-row st-adherence-warn' : 'st-adherence-row'}
                role="row"
                key={`${row.alias}-${rowIndex}`}
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
                  {row.last}
                </span>
              </div>
            ))}

            {study.adherenceRows.length === 0 ? (
              <p className="st-empty">{t('overview.adherence.empty')}</p>
            ) : null}

            <div className="st-adherence-row st-adherence-total" role="row">
              <span className="st-adherence-total-label" role="cell">
                {t('overview.adherence.allActive', { count: study.participantsActive })}
              </span>
              {study.totals.map((total, index) => (
                <span className="st-adherence-total-cell" role="cell" key={index}>
                  {total}
                </span>
              ))}
              <span className="st-adherence-total-note" role="cell">
                hoje {study.adherence.answered} de {study.adherence.sent}
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
              {t('overview.adherence.viewParticipants', { count: study.participantCount })}
            </Link>
          </div>

          <span className="st-fine-print">
            {t('overview.adherence.todayPartial', { time: study.currentTime })}
          </span>
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
            {study.feed.map((item, index) => (
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
            {study.feed.length === 0 ? (
              <p className="st-empty">{t('overview.feed.empty')}</p>
            ) : null}
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
                sent: study.pending.sent,
                pending: study.pending.pending,
                planned: study.pending.planned,
              })}
            </span>
          </div>

          <div className="st-hour-chart">
            <div className="st-hour-axis" aria-hidden="true">
              <span>{study.hourLimit}</span>
              <span>{Math.round(study.hourLimit / 3)}</span>
              <span>{Math.round(study.hourLimit / 6)}</span>
              <span>0</span>
            </div>
            <div className="st-hour-plot">
              <span className="st-hour-gridline" style={{ bottom: '76px' }} />
              <span className="st-hour-gridline" style={{ bottom: '152px' }} />
              <span className="st-hour-baseline" />
              <span className="st-hour-limit" aria-hidden="true">
                {t('overview.hours.limit', { limit: study.hourLimit })}
              </span>
              <div
                className="st-hour-bars"
                role="img"
                aria-label={t('overview.hours.aria', {
                  sent: study.pending.sent,
                  planned: study.pending.pending,
                })}
              >
                {study.hours.map((hour) => {
                  const total = hour.sent + hour.planned
                  return (
                    <div className="st-hour-col" key={hour.hour}>
                      <span className="st-hour-total">{total}</span>
                      <div
                        className="st-hour-stack"
                        title={`${String(hour.hour).padStart(2, '0')}:00 · ${hour.sent} enviados, ${hour.planned} por enviar`}
                      >
                        {hour.planned > 0 ? (
                          <span
                            className="st-hour-planned"
                            style={{ height: `${hour.planned * 19}px` }}
                          />
                        ) : null}
                        <span
                          className={hour.planned > 0 ? 'st-hour-sent st-hour-sent-flat' : 'st-hour-sent'}
                          style={{ height: `${hour.sent * 19}px` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="st-hour-labels">
            {study.hours.map((hour) => (
              <span className="st-hour-label" key={hour.hour}>
                <span className="mono">{String(hour.hour).padStart(2, '0')}</span>
                <span className="st-hour-now">
                  {hour.hour === study.nowHour ? t('overview.hours.now') : ''}
                </span>
              </span>
            ))}
          </div>

          <div className="st-legend-row st-legend-row-spaced">
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-sent" />
              {t('overview.hours.sent', { count: study.pending.sent })}
            </span>
            <span className="st-legend-item">
              <span className="st-swatch st-swatch-planned" />
              {t('overview.hours.planned', { count: study.pending.pending })}
            </span>
            <span className="st-legend-item">
              <span className="st-limit-swatch" />
              {t('overview.hours.limitLegend')}
            </span>
          </div>

          <div className="st-summary-box">
            {t('overview.hours.summary', {
              slot: study.maxPerSlot,
              hour: study.hourLimit,
              peak: study.hourPeak,
              from: study.hourPeakFrom,
              to: study.hourPeakTo,
              unplanned: study.pending.unplanned,
            })}
          </div>
        </section>

        <section className="card st-types-card" aria-labelledby="h-tipos">
          <div className="st-card-head">
            <h2 className="h2" id="h-tipos">
              {t('overview.types.title')}
            </h2>
            <span className="st-muted-strong">
              {t('overview.types.total', { count: study.entries.total })}
            </span>
          </div>

          <div className="st-types">
            <span className="st-types-label">{t('overview.types.byType')}</span>
            <div className="st-type-bar" aria-hidden="true">
              {study.types.map((type) => (
                <span
                  key={type.name}
                  style={{ flex: `${type.value} 1 0`, background: type.color }}
                />
              ))}
            </div>
            <div className="st-type-list">
              {study.types.map((type) => (
                <div className="st-type-row" key={type.name}>
                  <span className="st-type-swatch" style={{ background: type.color }} />
                  <span className="st-type-name">{type.name}</span>
                  <span className="st-type-value">{type.value}</span>
                  <span className="st-type-pct">
                    {Math.round((type.value / typeTotal) * 100)} %
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="st-activities">
            <span className="st-types-label">{t('overview.types.byActivity')}</span>
            {study.activities.map((activity) => (
              <div className="st-activity-row" key={activity.code}>
                <div className="st-activity-copy">
                  <span className="st-activity-name">
                    <span className="mono st-activity-code">{activity.code}</span> · {activity.name}
                  </span>
                  <div className="st-activity-bar">
                    <span
                      className="st-activity-requested"
                      style={{ width: `${(activity.requested / study.activityMax) * 100}%` }}
                    />
                    <span
                      className="st-activity-free"
                      style={{ width: `${(activity.free / study.activityMax) * 100}%` }}
                    />
                  </div>
                  <span className="st-activity-note">{activity.note}</span>
                </div>
                <span className="st-activity-value">{activity.value}</span>
              </div>
            ))}
            {study.activities.length === 0 ? (
              <p className="st-empty">{t('overview.types.empty')}</p>
            ) : null}
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
          </div>

          <div className="st-mini-stats">
            <div className="st-mini-stat">
              <span>
                <strong className="st-mini-stat-number">{study.delayed}</strong>{' '}
                {t('overview.types.delayed')}
              </span>
            </div>
            <div className="st-mini-stat">
              <span>
                <strong className="st-mini-stat-number">{study.tagged}</strong>{' '}
                {t('overview.types.tagged')}
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
