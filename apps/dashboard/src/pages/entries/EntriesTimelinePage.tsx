import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import FilterMenu from '../../components/entries/FilterMenu'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EntryTypeIcon,
  RowsIcon,
  TimelineIcon,
} from '../../components/entries/EntryIcons'
import { ExportIcon } from '../../components/icons'
import {
  addDays,
  defaultTimelineSelectionId,
  entryActivities,
  entryKindMeta,
  entryParticipants,
  entryTags,
  formatLongDate,
  formatShortDate,
  minutesToTime,
  participantBand,
  plannedPrompts,
  timeToMinutes,
  timelineItems,
  timelineStudy,
  weekdayShort,
  type EntryKind,
  type TimelineItem,
} from '../../fake/entries'
import { t } from '../../i18n/entries'
import '../../styles/entries.css'

type Zoom = 'week' | 'day' | 'hours'

const zoomOptions: { key: Zoom; labelKey: 'timeline.zoom.week' | 'timeline.zoom.day' | 'timeline.zoom.hours' }[] = [
  { key: 'week', labelKey: 'timeline.zoom.week' },
  { key: 'day', labelKey: 'timeline.zoom.day' },
  { key: 'hours', labelKey: 'timeline.zoom.hours' },
]

const DAY_START = timelineStudy.dayStart
const DAY_END = timelineStudy.dayEnd
const SPAN = DAY_END - DAY_START
const HOURS_SPAN = 3

function pos(fraction: number): string {
  return `calc(16px + (100% - 32px) * ${fraction.toFixed(4)})`
}

function dayFraction(time: string): number {
  return (timeToMinutes(time) / 60 - DAY_START) / SPAN
}

function dayNumber(isoDate: string): number {
  const start = new Date(`${timelineStudy.startDate}T12:00:00Z`).getTime()
  const day = new Date(`${isoDate}T12:00:00Z`).getTime()
  return Math.round((day - start) / 86_400_000) + 1
}

function weekStartFor(isoDate: string): string {
  const offset = dayNumber(isoDate) - 1
  const weekOffset = Math.floor(offset / 7) * 7
  return addDays(timelineStudy.startDate, weekOffset)
}

function weekTitle(first: string, last: string): string {
  const firstRest = formatLongDate(first).split(', ')[1]
  const lastRest = formatLongDate(last).split(', ')[1]
  const [firstDay, , firstMonth] = firstRest.split(' ')
  const [lastDay, , lastMonth] = lastRest.split(' ')
  return firstMonth === lastMonth
    ? `${firstDay} a ${lastDay} de ${firstMonth}`
    : `${firstDay} de ${firstMonth} a ${lastDay} de ${lastMonth}`
}

function itemTypeLabel(item: TimelineItem): string {
  if (item.kind === 'request') {
    return t('timeline.markRequest')
  }
  return (
    t(entryKindMeta[item.kind].labelKey) + (item.free ? t('timeline.markFreeSuffix') : '')
  )
}

export default function EntriesTimelinePage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? 'jardim-da-estrela'
  const base = `/estudos/${studyId}`

  const [zoom, setZoom] = useState<Zoom>('day')
  const [anchorDate, setAnchorDate] = useState(timelineStudy.today)
  const [hoursStart, setHoursStart] = useState(timelineStudy.hoursStart)
  const [participantView, setParticipantView] = useState('group-8')
  const [kindFilter, setKindFilter] = useState('all')
  const [activityFilter, setActivityFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(defaultTimelineSelectionId)

  const weekStart = weekStartFor(anchorDate)
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const hoursEnd = Math.min(hoursStart + HOURS_SPAN, 22)

  const lanes =
    participantView === 'group-8'
      ? entryParticipants.slice(0, 8)
      : participantView === 'group-16'
        ? entryParticipants.slice(0, 16)
        : participantView === 'all'
          ? entryParticipants
          : entryParticipants.filter((participant) => participant === participantView)

  const laneSet = new Set(lanes)

  const participantLabel =
    participantView === 'group-8'
      ? 'P-01 a P-08'
      : participantView === 'group-16'
        ? 'P-01 a P-16'
        : participantView === 'all'
          ? t('list.allParticipants')
          : participantView

  const inScope = timelineItems.filter((item) => {
    if (!laneSet.has(item.participantId)) {
      return false
    }
    if (kindFilter !== 'all' && item.kind !== kindFilter) {
      return false
    }
    if (activityFilter !== 'all') {
      if (activityFilter === 'free' && !item.free) {
        return false
      }
      if (activityFilter !== 'free' && item.activityCode !== activityFilter) {
        return false
      }
    }
    if (tagFilter !== 'all' && item.tag !== tagFilter) {
      return false
    }
    return true
  })

  const dateInRange = (date: string): boolean => {
    if (zoom === 'week') {
      return date >= weekStart && date <= weekDates[6]
    }
    if (zoom === 'hours') {
      return date === anchorDate
    }
    return date === anchorDate
  }

  const rangeItems = inScope.filter((item) => {
    if (!dateInRange(item.date)) {
      return false
    }
    if (zoom === 'hours') {
      const minutes = timeToMinutes(item.time)
      return minutes >= hoursStart * 60 && minutes < hoursEnd * 60
    }
    return true
  })

  const entryCount = rangeItems.filter((item) => item.kind !== 'request').length
  const requestCount = rangeItems.length - entryCount
  const readyLabel = entryCount === 1 ? t('timeline.entryLabel') : t('timeline.entriesLabel')
  const requestLabel =
    requestCount === 1 ? t('timeline.requestLabel') : t('timeline.requestsLabel')

  const rangeTitle =
    zoom === 'week'
      ? weekTitle(weekDates[0], weekDates[6])
      : zoom === 'hours'
        ? `${String(hoursStart).padStart(2, '0')}:00 às ${String(hoursEnd).padStart(2, '0')}:00`
        : formatLongDate(anchorDate)

  const rangeSub =
    zoom === 'week'
      ? t('timeline.weekRange', {
          from: dayNumber(weekDates[0]),
          to: dayNumber(weekDates[6]),
          total: timelineStudy.totalDays,
        })
      : zoom === 'hours'
        ? formatLongDate(anchorDate)
        : t('timeline.dayRange', {
            day: dayNumber(anchorDate),
            total: timelineStudy.totalDays,
            start: '08:00',
            end: '22:00',
          })

  const nowMinutes = timeToMinutes(timelineStudy.now)
  const showNow =
    anchorDate === timelineStudy.today &&
    (zoom === 'day' || (zoom === 'hours' && nowMinutes >= hoursStart * 60 && nowMinutes < hoursEnd * 60))
  const nowFraction =
    zoom === 'hours'
      ? (nowMinutes / 60 - hoursStart) / (hoursEnd - hoursStart)
      : (nowMinutes / 60 - DAY_START) / SPAN

  const dayTicks = Array.from({ length: SPAN + 1 }, (_, index) => DAY_START + index)
  const hourTicks = Array.from({ length: 7 }, (_, index) => hoursStart + index * 0.5)

  function navigate(delta: number) {
    if (zoom === 'week') {
      setAnchorDate(addDays(anchorDate, delta * 7))
      return
    }
    if (zoom === 'day') {
      setAnchorDate(addDays(anchorDate, delta))
      return
    }
    setHoursStart((current) => Math.min(21, Math.max(8, current + delta * 3)))
  }

  function goToday() {
    setAnchorDate(timelineStudy.today)
    setHoursStart(timelineStudy.hoursStart)
  }

  function marksFor(participant: string, date: string): TimelineItem[] {
    return rangeItems.filter((item) => item.participantId === participant && item.date === date)
  }

  function laneSub(participant: string, date: string): string {
    const count = marksFor(participant, date).filter((item) => item.kind !== 'request').length
    if (count === 0) {
      return t('timeline.laneEmpty')
    }
    return count === 1 ? t('timeline.laneEntry') : t('timeline.laneEntries', { count })
  }

  function markAria(item: TimelineItem, date: string): string {
    return t('timeline.markAria', {
      participant: item.participantId,
      date: formatShortDate(date),
      time: item.time,
      type: itemTypeLabel(item),
    })
  }

  function markStyle(item: TimelineItem, fraction = dayFraction(item.time)): CSSProperties {
    const color = item.kind === 'request' ? '#8A93A8' : entryKindMeta[item.kind].color
    return {
      left: pos(fraction),
      background: item.kind === 'request' ? '#fff' : color,
      borderColor: color,
    }
  }

  function markClass(item: TimelineItem, extra = ''): string {
    return [
      'en-mark',
      item.free ? 'is-square' : '',
      item.kind === 'request' ? 'is-request' : '',
      item.id === selectedId ? 'is-selected' : '',
      extra,
    ]
      .filter(Boolean)
      .join(' ')
  }

  const selected = timelineItems.find((item) => item.id === selectedId) ?? timelineItems[0]
  const selectedType =
    selected.kind === 'request'
      ? t('timeline.noResponse')
      : selected.free
        ? t('timeline.freeType', { type: t(entryKindMeta[selected.kind].labelKey) })
        : t(entryKindMeta[selected.kind].labelKey)
  const selectedTitle =
    selected.kind === 'request'
      ? t('timeline.selectedRequestTitle', {
          alias: selected.participantId,
          time: selected.time,
        })
      : selected.duration
        ? t('timeline.selectedTitle', {
            alias: selected.participantId,
            type: selectedType,
            duration: selected.duration,
            time: selected.time,
          })
        : t('timeline.selectedTitleShort', {
            alias: selected.participantId,
            type: selectedType,
            time: selected.time,
          })
  const receivedTime = minutesToTime(timeToMinutes(selected.time) + 1)

  const participantOptions = [
    { value: 'group-8', label: 'P-01 a P-08' },
    { value: 'group-16', label: 'P-01 a P-16' },
    { value: 'all', label: t('list.allParticipants') },
    ...entryParticipants.map((participant) => ({ value: participant, label: participant })),
  ]

  const kindOptions = [
    { value: 'all', label: t('list.allTypes') },
    ...(Object.keys(entryKindMeta) as EntryKind[]).map((kind) => ({
      value: kind,
      label: t(entryKindMeta[kind].labelKey),
    })),
    { value: 'request', label: t('kind.request') },
  ]

  const activityOptions = [
    { value: 'all', label: t('list.allActivities') },
    ...entryActivities.map((activity) => ({
      value: activity.code,
      label: `${activity.code} · ${activity.title}`,
    })),
    { value: 'free', label: t('activity.free') },
  ]

  const tagOptions = [
    { value: 'all', label: t('list.allTags') },
    ...entryTags.map((tag) => ({ value: tag, label: tag })),
  ]

  function showMoreParticipants() {
    if (participantView === 'group-8') {
      setParticipantView('group-16')
    } else if (participantView === 'group-16') {
      setParticipantView('all')
    }
  }

  function renderDayView() {
    return (
      <div className="en-timechart">
        <div className="en-now-row">
          <div className="en-axis-spacer" />
          <div className="en-track">
            {showNow ? (
              <span className="en-now-pill" style={{ left: pos(nowFraction) }}>
                {t('timeline.now', { time: timelineStudy.now })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="en-ticks-row">
          <div className="en-axis-spacer" />
          <div className="en-track en-ticks">
            {dayTicks.map((hour) => (
              <span
                key={hour}
                className="mono"
                style={{ left: pos((hour - DAY_START) / SPAN) }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        </div>
        <div className="en-chart-body">
          <div className="en-grid-lines" aria-hidden="true">
            {dayTicks.map((hour) => (
              <span key={hour} style={{ left: pos((hour - DAY_START) / SPAN) }} />
            ))}
            {showNow ? <span className="en-now-line" style={{ left: pos(nowFraction) }} /> : null}
          </div>
          {lanes.map((participant) => {
            const band = participant === participantBand.participantId
            const bandStart = dayFraction(participantBand.start)
            const bandWidth = (timeToMinutes(participantBand.end) - timeToMinutes(participantBand.start)) / 60 / SPAN
            const planned = plannedPrompts.filter(
              (prompt) => prompt.participantId === participant && prompt.date === anchorDate,
            )

            return (
              <div className="en-lane" key={participant}>
                <div className="en-lane-axis">
                  <span className="mono">{participant}</span>
                  <span>{laneSub(participant, anchorDate)}</span>
                </div>
                <div className="en-lane-track">
                  {band ? (
                    <div
                      className="en-band"
                      style={{
                        left: pos(bandStart),
                        width: `calc((100% - 32px) * ${bandWidth.toFixed(4)})`,
                      }}
                    >
                      {t('timeline.bandOnly', {
                        start: participantBand.start,
                        end: participantBand.end,
                      })}
                    </div>
                  ) : null}
                  {planned.map((prompt) => (
                    <span
                      key={prompt.id}
                      className="en-planned"
                      role="img"
                      aria-label={t('timeline.planAria', {
                        participant,
                        time: prompt.time,
                      })}
                      style={{ left: pos(dayFraction(prompt.time)) }}
                    />
                  ))}
                  {marksFor(participant, anchorDate).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={markClass(item)}
                      aria-label={markAria(item, anchorDate)}
                      aria-pressed={item.id === selectedId}
                      style={markStyle(item)}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <EntryTypeIcon kind={item.kind} width={14} height={14} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="en-chart-bottom" />
        </div>
      </div>
    )
  }

  function renderHoursView() {
    return (
      <div className="en-timechart">
        <div className="en-now-row">
          <div className="en-axis-spacer" />
          <div className="en-track">
            {showNow ? (
              <span className="en-now-pill" style={{ left: pos(nowFraction) }}>
                {t('timeline.now', { time: timelineStudy.now })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="en-ticks-row">
          <div className="en-axis-spacer" />
          <div className="en-track en-ticks">
            {hourTicks.map((hour) => {
              const whole = Number.isInteger(hour)
              return (
                <span
                  key={hour}
                  className={whole ? 'mono' : 'mono is-half'}
                  style={{ left: pos((hour - hoursStart) / (hoursEnd - hoursStart)) }}
                >
                  {String(Math.floor(hour)).padStart(2, '0')}:
                  {whole ? '00' : '30'}
                </span>
              )
            })}
          </div>
        </div>
        <div className="en-chart-body">
          <div className="en-grid-lines" aria-hidden="true">
            {hourTicks.map((hour) => (
              <span
                key={hour}
                className={Number.isInteger(hour) ? '' : 'is-half'}
                style={{ left: pos((hour - hoursStart) / (hoursEnd - hoursStart)) }}
              />
            ))}
            {showNow ? <span className="en-now-line" style={{ left: pos(nowFraction) }} /> : null}
          </div>
          {lanes.map((participant) => {
            const marks = marksFor(participant, anchorDate)
            const band = participant === participantBand.participantId

            return (
              <div className="en-lane en-lane-hours" key={participant}>
                <div className="en-lane-axis">
                  <span className="mono">{participant}</span>
                </div>
                <div className="en-lane-track">
                  {band ? (
                    <div className="en-band en-band-full">
                      {t('timeline.bandOnly', {
                        start: participantBand.start,
                        end: participantBand.end,
                      })}
                    </div>
                  ) : null}
                  {marks.map((item) => {
                    const fraction =
                      (timeToMinutes(item.time) / 60 - hoursStart) / (hoursEnd - hoursStart)
                    const left = pos(fraction)
                    const labelOnLeft = fraction > 0.68
                    const labelTitle =
                      item.kind === 'request'
                        ? t('timeline.noResponse')
                        : item.free
                          ? t('timeline.freeType', { type: t(entryKindMeta[item.kind].labelKey) })
                          : `${t(entryKindMeta[item.kind].labelKey)} · ${item.activityCode ?? ''}`
                    const labelExcerpt =
                      item.kind === 'request' ? item.title : item.excerpt

                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          className={markClass(item, 'is-hours')}
                          aria-label={markAria(item, anchorDate)}
                          aria-pressed={item.id === selectedId}
                          style={markStyle(item, fraction)}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <EntryTypeIcon kind={item.kind} width={16} height={16} />
                        </button>
                        <div
                          className={`en-mark-label${labelOnLeft ? ' is-left' : ''}`}
                          style={
                            labelOnLeft
                              ? { right: `calc(100% - ${left} + 26px)` }
                              : { left: `calc(${left} + 26px)` }
                          }
                        >
                          <span>
                            <span className="mono">{item.time}</span> · {labelTitle}
                          </span>
                          <span>{labelExcerpt}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div className="en-chart-bottom" />
        </div>
      </div>
    )
  }

  function renderWeekView() {
    return (
      <div className="en-week">
        <div className="en-week-days">
          <div />
          {weekDates.map((date) => {
            const isToday = date === timelineStudy.today
            const isFuture = date > timelineStudy.today
            return (
              <div
                key={date}
                className={`en-week-daylabel${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`}
              >
                <span className="en-week-weekday">{weekdayShort(date)}</span>
                <span className="en-week-date">{formatShortDate(date)}</span>
                <span className="en-week-sub">
                  {t('timeline.dayShort', { day: dayNumber(date) })}
                  {isToday ? ` · ${t('timeline.todayLabel')}` : ''}
                </span>
              </div>
            )
          })}
        </div>
        {lanes.map((participant) => {
          const laneEntries = rangeItems.filter(
            (item) => item.participantId === participant && item.kind !== 'request',
          ).length
          return (
            <div className="en-week-lane" key={participant}>
              <div className="en-lane-axis">
                <span className="mono">{participant}</span>
                <span>
                  {laneEntries === 1
                    ? t('timeline.laneEntry')
                    : t('timeline.laneEntries', { count: laneEntries })}
                </span>
              </div>
              {weekDates.map((date) => {
                const isToday = date === timelineStudy.today
                const isFuture = date > timelineStudy.today
                return (
                  <div
                    key={date}
                    className={`en-week-cell${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`}
                  >
                    {marksFor(participant, date).map((item) => {
                      const color =
                        item.kind === 'request' ? '#8A93A8' : entryKindMeta[item.kind].color
                      return (
                        <span
                          key={item.id}
                          className={`en-week-dot${item.kind === 'request' ? ' is-request' : ''}`}
                          role="img"
                          aria-label={markAria(item, date)}
                          style={{
                            background: item.kind === 'request' ? '#fff' : color,
                            borderColor: color,
                            borderRadius: item.free ? 6 : 9,
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
        <div className="en-week-bottom" />
      </div>
    )
  }

  return (
    <div className="en-page">
      <header className="en-page-header">
        <div className="en-header-copy">
          <h1 className="en-title">{t('timeline.title')}</h1>
          <p className="en-subtitle">{t('timeline.subtitle')}</p>
        </div>
        <div className="en-header-actions">
          <div className="en-segmented" role="group" aria-label={t('list.viewModes')}>
            <Link className="en-segment" to={`${base}/registos`}>
              <RowsIcon width={18} height={18} />
              {t('list.viewList')}
            </Link>
            <span className="en-segment is-active" aria-current="true">
              <TimelineIcon width={18} height={18} />
              {t('list.viewTimeline')}
            </span>
          </div>
          <Link className="btn" to={`${base}/exportar`}>
            <ExportIcon width={18} height={18} />
            {t('list.export')}
          </Link>
        </div>
      </header>

      <section className="card en-timeline-controls" aria-label={t('timeline.zoomLabel')}>
        <div className="en-timeline-controls-top">
          <div className="en-zoom">
            <span className="en-tag-label">{t('timeline.zoomLabel')}</span>
            <div className="en-view-toggle" role="group" aria-label={t('timeline.zoomLabel')}>
              {zoomOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={zoom === option.key}
                  onClick={() => setZoom(option.key)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="en-range-nav">
            <button
              type="button"
              className="btn en-page-button"
              aria-label={t('timeline.prev')}
              onClick={() => navigate(-1)}
            >
              <ChevronLeftIcon width={18} height={18} />
            </button>
            <span className="en-range">
              <span className="en-range-title">{rangeTitle}</span>
              <span className="en-range-sub">{rangeSub}</span>
            </span>
            <button
              type="button"
              className="btn en-page-button"
              aria-label={t('timeline.next')}
              onClick={() => navigate(1)}
            >
              <ChevronRightIcon width={18} height={18} />
            </button>
            <button type="button" className="btn btn-sm en-today" onClick={goToday}>
              {t('timeline.today')}
            </button>
          </div>
        </div>

        <div className="en-filter-row">
          <FilterMenu
            label={t('list.filterParticipant')}
            value={participantView}
            options={participantOptions}
            onChange={(value) => setParticipantView(value)}
          />
          <FilterMenu
            label={t('list.filterType')}
            value={kindFilter}
            options={kindOptions}
            onChange={setKindFilter}
          />
          <FilterMenu
            label={t('list.filterActivity')}
            value={activityFilter}
            options={activityOptions}
            onChange={setActivityFilter}
          />
          <FilterMenu
            label={t('list.filterTag')}
            value={tagFilter}
            options={tagOptions}
            onChange={setTagFilter}
          />
          <span className="en-timeline-counts">
            <span>
              <b className="mono">{entryCount}</b> {readyLabel}
            </span>
            <span className="en-count-divider" aria-hidden="true" />
            <span>
              <b className="mono">{requestCount}</b> {requestLabel}
            </span>
          </span>
        </div>
      </section>

      <section className="card en-timeline-board" aria-label={t('list.viewTimeline')}>
        <div className="en-legend" aria-label={t('timeline.legend')}>
          {(Object.keys(entryKindMeta) as EntryKind[]).map((kind) => (
            <span key={kind} className="en-legend-item">
              <span
                className="en-legend-icon"
                style={{ background: entryKindMeta[kind].color }}
              >
                <EntryTypeIcon kind={kind} width={12} height={12} />
              </span>
              {t(entryKindMeta[kind].labelKey)}
            </span>
          ))}
          <span className="en-legend-divider" aria-hidden="true" />
          <span className="en-legend-item">
            <span className="en-legend-square" />
            {t('timeline.freeSquare')}
          </span>
          <span className="en-legend-item">
            <span className="en-legend-hollow" />
            {t('timeline.noResponse')}
          </span>
          {zoom === 'day' ? (
            <span className="en-legend-item">
              <span className="en-legend-planned" />
              {t('timeline.planned')}
            </span>
          ) : null}
        </div>

        {zoom === 'day' ? renderDayView() : null}
        {zoom === 'hours' ? renderHoursView() : null}
        {zoom === 'week' ? renderWeekView() : null}

        {zoom !== 'week' ? (
          <div className="en-timeline-selected">
            <span
              className="en-timeline-selected-icon"
              style={{
                background:
                  selected.kind === 'request' ? '#5B6478' : entryKindMeta[selected.kind].color,
              }}
            >
              <EntryTypeIcon kind={selected.kind} width={20} height={20} />
            </span>
            <div className="en-timeline-selected-copy">
              <span className="en-timeline-selected-kicker">{t('timeline.selected')}</span>
              <span className="en-timeline-selected-title">{selectedTitle}</span>
              <span className="en-timeline-selected-activity">{selected.title}</span>
              {selected.kind !== 'request' && selected.excerpt ? (
                <span className="en-timeline-selected-excerpt">{selected.excerpt}</span>
              ) : null}
            </div>
            <div className="en-timeline-selected-side">
              <div className="en-timeline-selected-tags">
                {selected.tag ? <span className="en-tag">{selected.tag}</span> : null}
                {selected.kind === 'request' ? (
                  <span className="pill ne">{t('timeline.noResponse')}</span>
                ) : (
                  <span className="pill ok">{t('status.ready')}</span>
                )}
              </div>
              <span className="en-timeline-selected-times">
                {t('detail.recorded')}{' '}
                <span className="mono">{selected.time}</span> · {t('detail.received')}{' '}
                <span className="mono">{receivedTime}</span>
              </span>
              <Link className="btn btn-sm" to={`${base}/registos`}>
                {t('timeline.openEntry')}
                <ChevronRightIcon width={16} height={16} />
              </Link>
            </div>
          </div>
        ) : (
          <p className="sub">
            {t('timeline.weekNote', { time: timelineStudy.now })}
          </p>
        )}

        <div className="en-timeline-footer">
          <span>
            {t('timeline.footer', {
              shown: lanes.length,
              total: timelineStudy.totalParticipants,
              range: participantLabel,
              timezone: timelineStudy.timezone,
            })}
          </span>
          {participantView === 'group-8' || participantView === 'group-16' ? (
            <button type="button" className="btn btn-sm" onClick={showMoreParticipants}>
              {t('timeline.showMore')}
              <ChevronDownIcon width={16} height={16} />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
