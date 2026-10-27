import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useActivities,
  useEntry,
  useParticipants,
  useStudy,
  useStudyEvents,
  useTags,
  useTimeline,
  type EntryType,
  type StudyOut,
  type TimelineResponse,
} from '../../api/entries'
import FilterMenu from '../../components/entries/FilterMenu'
import {
  EntryErrorState,
  EntryLoadingState,
} from '../../components/entries/EntryStates'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EntryTypeIcon,
  RowsIcon,
  TimelineIcon,
} from '../../components/entries/EntryIcons'
import { ExportIcon } from '../../components/icons'
import {
  addDays,
  entryKindMeta,
  formatLongDate,
  formatShortDate,
  nowInZone,
  shortId,
  timeToMinutes,
  todayInZone,
  zonedDateTime,
  zonedParts,
  type TimelineKind,
} from '../../components/entries/entryMeta'
import { t, type EntriesKey } from '../../i18n/entries'
import '../../styles/entries.css'

type Zoom = 'week' | 'day' | 'hours'

type TimelineItem = {
  key: string
  entryId?: string
  participantId: string
  alias: string
  date: string
  time: string
  minutes: number
  kind: TimelineKind
  free: boolean
  activityId: string | null
  activityTitle: string
  tag?: string
  mediaCount: number
}

const DAY_START = 8
const DAY_END = 22
const SPAN = DAY_END - DAY_START
const HOURS_SPAN = 3

const zoomOptions: { key: Zoom; labelKey: EntriesKey }[] = [
  { key: 'week', labelKey: 'timeline.zoom.week' },
  { key: 'day', labelKey: 'timeline.zoom.day' },
  { key: 'hours', labelKey: 'timeline.zoom.hours' },
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function pos(fraction: number): string {
  return `calc(16px + (100% - 32px) * ${fraction.toFixed(4)})`
}

function dayFraction(minutes: number): number {
  return (minutes / 60 - DAY_START) / SPAN
}

function weekStartFor(isoDate: string): string {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay()
  return addDays(isoDate, -((weekday + 6) % 7))
}

function weekTitle(first: string, last: string): string {
  const firstRest = formatLongDate(first).split(', ')[1] ?? formatLongDate(first)
  const lastRest = formatLongDate(last).split(', ')[1] ?? formatLongDate(last)
  const [firstDay, , firstMonth] = firstRest.split(' ')
  const [lastDay, , lastMonth] = lastRest.split(' ')
  return firstMonth === lastMonth
    ? `${firstDay} a ${lastDay} de ${firstMonth}`
    : `${firstDay} de ${firstMonth} a ${lastDay} de ${lastMonth}`
}

function dayNumberFrom(study: StudyOut | undefined, isoDate: string): number {
  if (!study?.starts_on) {
    return 1
  }
  const start = new Date(`${study.starts_on}T12:00:00Z`).getTime()
  const day = new Date(`${isoDate}T12:00:00Z`).getTime()
  return Math.round((day - start) / 86_400_000) + 1
}

function totalDaysOf(study: StudyOut | undefined): number {
  if (!study?.starts_on) {
    return 14
  }
  const end = study.ends_on ?? study.starts_on
  const start = new Date(`${study.starts_on}T12:00:00Z`).getTime()
  const last = new Date(`${end}T12:00:00Z`).getTime()
  return Math.max(1, Math.round((last - start) / 86_400_000) + 1)
}

function itemsFromTimeline(
  data: TimelineResponse | undefined,
  timeZone: string,
): TimelineItem[] {
  if (!data) {
    return []
  }
  const items: TimelineItem[] = []
  for (const lane of data.lanes) {
    const alias = lane.alias ?? shortId(lane.participant_id)
    for (const entry of lane.entries ?? []) {
      const parts = zonedParts(entry.recorded_at, timeZone)
      items.push({
        key: entry.id,
        entryId: entry.id,
        participantId: lane.participant_id,
        alias,
        date: parts.date,
        time: parts.time,
        minutes: parts.minutes,
        kind: entry.entry_type,
        free: entry.prompt_id === null,
        activityId: entry.activity_id,
        activityTitle: '',
        mediaCount: entry.media_count ?? 0,
      })
    }
    for (const marker of lane.markers ?? []) {
      const at = marker.scheduled_at ?? marker.sent_at
      if (!at) {
        continue
      }
      const parts = zonedParts(at, timeZone)
      items.push({
        key: marker.prompt_id,
        participantId: lane.participant_id,
        alias,
        date: parts.date,
        time: parts.time,
        minutes: parts.minutes,
        kind: 'request',
        free: false,
        activityId: marker.activity_id,
        activityTitle: '',
        mediaCount: 0,
      })
    }
  }
  return items
}

export default function EntriesTimelinePage() {
  const params = useParams<{ studyId: string }>()
  const studyId = params.studyId ?? ''
  const base = `/estudos/${studyId}`

  const studyQuery = useStudy(studyId)
  const timeZone = studyQuery.data?.timezone ?? 'Europe/Lisbon'
  const today = todayInZone(timeZone)
  const nowTime = nowInZone(timeZone)

  const activitiesQuery = useActivities(studyId)
  const participantsQuery = useParticipants(studyId)
  const tagsQuery = useTags(studyId)
  const eventStatus = useStudyEvents(studyId)

  const [zoom, setZoom] = useState<Zoom>('day')
  const [anchorDate, setAnchorDate] = useState<string | null>(null)
  const [hoursStart, setHoursStart] = useState(12)
  const [participantView, setParticipantView] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [activityFilter, setActivityFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const anchor = anchorDate ?? today
  const weekStart = weekStartFor(anchor)
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const hoursEnd = Math.min(hoursStart + HOURS_SPAN, 22)

  const rangeStart =
    zoom === 'week'
      ? zonedDateTime(weekDates[0], 0, timeZone)
      : zoom === 'hours'
        ? zonedDateTime(anchor, hoursStart * 60, timeZone)
        : zonedDateTime(anchor, 0, timeZone)
  const rangeEnd =
    zoom === 'week'
      ? zonedDateTime(addDays(weekDates[6], 1), 0, timeZone)
      : zoom === 'hours'
        ? zonedDateTime(anchor, hoursEnd * 60, timeZone)
        : zonedDateTime(addDays(anchor, 1), 0, timeZone)

  const timelineQuery = useTimeline(studyId, {
    zoom,
    start: rangeStart,
    end: rangeEnd,
    participantId: participantView !== 'all' ? participantView : undefined,
    activityId:
      activityFilter !== 'all' && activityFilter !== 'free' ? activityFilter : undefined,
    entryType:
      kindFilter !== 'all' && kindFilter !== 'request'
        ? (kindFilter as EntryType)
        : undefined,
    tagId: tagFilter !== 'all' ? tagFilter : undefined,
  })

  const activities = activitiesQuery.data ?? []
  const tags = tagsQuery.data ?? []
  const activityById = new Map(activities.map((activity) => [activity.id, activity.title]))
  const tagById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const tagByIdFromTimeline = new Map<string, string>()

  const items = itemsFromTimeline(timelineQuery.data, timeZone).map((item) => ({
    ...item,
    activityTitle:
      (item.activityId ? activityById.get(item.activityId) : undefined) ??
      t('activity.unknown'),
  }))

  if (timelineQuery.data) {
    for (const lane of timelineQuery.data.lanes) {
      for (const entry of lane.entries ?? []) {
        const name = (entry.tag_ids ?? []).map((id) => tagById.get(id)).find(Boolean)
        if (name && !tagByIdFromTimeline.has(entry.id)) {
          tagByIdFromTimeline.set(entry.id, name)
        }
      }
    }
  }

  // Local fallback: the timeline endpoint cannot filter free entries or the request-only view,
  // so those two filters narrow the response here. Planned prompts are not exposed by the API.
  const inScope = items.filter((item) => {
    if (activityFilter === 'free' && !item.free) {
      return false
    }
    if (kindFilter === 'request' && item.kind !== 'request') {
      return false
    }
    if (kindFilter !== 'all' && kindFilter !== 'request' && item.kind !== kindFilter) {
      return false
    }
    return true
  })

  const dateInRange = (date: string): boolean => {
    if (zoom === 'week') {
      return date >= weekDates[0] && date <= weekDates[6]
    }
    return date === anchor
  }

  const rangeItems = inScope.filter((item) => {
    if (!dateInRange(item.date)) {
      return false
    }
    if (zoom === 'hours') {
      return item.minutes >= hoursStart * 60 && item.minutes < hoursEnd * 60
    }
    return true
  })

  const lanes = timelineQuery.data?.lanes ?? []
  const laneIds = new Set(lanes.map((lane) => lane.participant_id))
  const allParticipants = participantsQuery.data ?? []
  const laneParticipants = lanes.map((lane) => ({
    id: lane.participant_id,
    alias: lane.alias ?? shortId(lane.participant_id),
  }))
  const participantRows =
    participantView !== 'all'
      ? [
          {
            id: participantView,
            alias:
              allParticipants.find((participant) => participant.id === participantView)
                ?.alias ?? shortId(participantView),
          },
        ]
      : laneParticipants.length > 0
        ? laneParticipants
        : allParticipants.map((participant) => ({
            id: participant.id,
            alias: participant.alias ?? shortId(participant.id),
          }))

  const entryCount = rangeItems.filter((item) => item.kind !== 'request').length
  const requestCount = rangeItems.length - entryCount
  const readyLabel = entryCount === 1 ? t('timeline.entryLabel') : t('timeline.entriesLabel')
  const requestLabel =
    requestCount === 1 ? t('timeline.requestLabel') : t('timeline.requestsLabel')

  const totalDays = totalDaysOf(studyQuery.data)
  const dayNumber = (date: string) => dayNumberFrom(studyQuery.data, date)

  const rangeTitle =
    zoom === 'week'
      ? weekTitle(weekDates[0], weekDates[6])
      : zoom === 'hours'
        ? `${pad(hoursStart)}:00 às ${pad(hoursEnd)}:00`
        : formatLongDate(anchor)
  const rangeSub =
    zoom === 'week'
      ? t('timeline.weekRange', {
          from: dayNumber(weekDates[0]),
          to: dayNumber(weekDates[6]),
          total: totalDays,
        })
      : zoom === 'hours'
        ? formatLongDate(anchor)
        : t('timeline.dayRange', {
            day: dayNumber(anchor),
            total: totalDays,
            start: '08:00',
            end: '22:00',
          })

  const nowMinutes = timeToMinutes(nowTime)
  const showNow =
    anchor === today &&
    (zoom === 'day'
      ? nowMinutes >= DAY_START * 60 && nowMinutes < DAY_END * 60
      : zoom === 'hours' && nowMinutes >= hoursStart * 60 && nowMinutes < hoursEnd * 60)
  const nowFraction =
    zoom === 'hours'
      ? (nowMinutes / 60 - hoursStart) / (hoursEnd - hoursStart)
      : dayFraction(nowMinutes)

  const dayTicks = Array.from({ length: SPAN + 1 }, (_, index) => DAY_START + index)
  const hourTicks = Array.from({ length: 7 }, (_, index) => hoursStart + index * 0.5)

  function navigate(delta: number) {
    if (zoom === 'week') {
      setAnchorDate(addDays(anchor, delta * 7))
      return
    }
    if (zoom === 'day') {
      setAnchorDate(addDays(anchor, delta))
      return
    }
    setHoursStart((current) => Math.min(19, Math.max(8, current + delta * 3)))
  }

  function goToday() {
    setAnchorDate(today)
    setHoursStart(12)
  }

  function marksFor(participantId: string, date: string): TimelineItem[] {
    return rangeItems.filter(
      (item) => item.participantId === participantId && item.date === date,
    )
  }

  function laneSub(participantId: string, date: string): string {
    const count = marksFor(participantId, date).filter((item) => item.kind !== 'request').length
    if (count === 0) {
      return t('timeline.laneEmpty')
    }
    return count === 1 ? t('timeline.laneEntry') : t('timeline.laneEntries', { count })
  }

  function itemTypeLabel(item: TimelineItem): string {
    if (item.kind === 'request') {
      return t('timeline.markRequest')
    }
    return t(entryKindMeta[item.kind].labelKey) + (item.free ? t('timeline.markFreeSuffix') : '')
  }

  function markAria(item: TimelineItem, date: string): string {
    return t('timeline.markAria', {
      participant: item.alias,
      date: formatShortDate(date),
      time: item.time,
      type: itemTypeLabel(item),
    })
  }

  function markStyle(item: TimelineItem, fraction = dayFraction(item.minutes)): CSSProperties {
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
      item.key === selectedId ? 'is-selected' : '',
      extra,
    ]
      .filter(Boolean)
      .join(' ')
  }

  const selected =
    rangeItems.find((item) => item.key === selectedId) ?? rangeItems[0] ?? inScope[0] ?? null
  const selectedDetail = useEntry(studyId, selected?.entryId ?? null)
  const selectedType =
    selected === null
      ? ''
      : selected.kind === 'request'
        ? t('timeline.noResponse')
        : selected.free
          ? t('timeline.freeType', { type: t(entryKindMeta[selected.kind].labelKey) })
          : t(entryKindMeta[selected.kind].labelKey)
  const selectedTitle =
    selected === null
      ? ''
      : selected.kind === 'request'
        ? t('timeline.selectedRequestTitle', { alias: selected.alias, time: selected.time })
        : t('timeline.selectedTitleShort', {
            alias: selected.alias,
            type: selectedType,
            time: selected.time,
          })
  const selectedTag = selected ? tagByIdFromTimeline.get(selected.key) : undefined
  const receivedTime = selectedDetail.data
    ? zonedParts(selectedDetail.data.received_at, timeZone).time
    : '–'

  const participantOptions = [
    { value: 'all', label: t('list.allParticipants') },
    ...allParticipants.map((participant) => ({
      value: participant.id,
      label: participant.alias ?? shortId(participant.id),
    })),
  ]

  const kindOptions = [
    { value: 'all', label: t('list.allTypes') },
    ...(Object.keys(entryKindMeta) as EntryType[]).map((kind) => ({
      value: kind,
      label: t(entryKindMeta[kind].labelKey),
    })),
    { value: 'request', label: t('kind.request') },
  ]

  const activityOptions = [
    { value: 'all', label: t('list.allActivities') },
    ...activities.map((activity) => ({ value: activity.id, label: activity.title })),
    { value: 'free', label: t('activity.free') },
  ]

  const tagOptions = [
    { value: 'all', label: t('list.allTags') },
    ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
  ]

  function renderDayView() {
    return (
      <div className="en-timechart">
        <div className="en-now-row">
          <div className="en-axis-spacer" />
          <div className="en-track">
            {showNow ? (
              <span className="en-now-pill" style={{ left: pos(nowFraction) }}>
                {t('timeline.now', { time: nowTime })}
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
          {participantRows.map((participant) => (
            <div className="en-lane" key={participant.id}>
              <div className="en-lane-axis">
                <span className="mono">{participant.alias}</span>
                <span>{laneSub(participant.id, anchor)}</span>
              </div>
              <div className="en-lane-track">
                {marksFor(participant.id, anchor).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={markClass(item)}
                    aria-label={markAria(item, anchor)}
                    aria-pressed={item.key === selected?.key}
                    style={markStyle(item)}
                    onClick={() => setSelectedId(item.key)}
                  >
                    <EntryTypeIcon kind={item.kind} width={14} height={14} />
                  </button>
                ))}
              </div>
            </div>
          ))}
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
                {t('timeline.now', { time: nowTime })}
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
          {participantRows.map((participant) => (
            <div className="en-lane en-lane-hours" key={participant.id}>
              <div className="en-lane-axis">
                <span className="mono">{participant.alias}</span>
              </div>
              <div className="en-lane-track">
                {marksFor(participant.id, anchor).map((item) => {
                  const fraction =
                    (item.minutes / 60 - hoursStart) / (hoursEnd - hoursStart)
                  const left = pos(fraction)
                  const labelOnLeft = fraction > 0.68
                  const labelTitle =
                    item.kind === 'request'
                      ? t('timeline.noResponse')
                      : item.free
                        ? t('timeline.freeType', {
                            type: t(entryKindMeta[item.kind].labelKey),
                          })
                        : `${t(entryKindMeta[item.kind].labelKey)} · ${item.activityTitle}`

                  return (
                    <div key={item.key}>
                      <button
                        type="button"
                        className={markClass(item, 'is-hours')}
                        aria-label={markAria(item, anchor)}
                        aria-pressed={item.key === selected?.key}
                        style={markStyle(item, fraction)}
                        onClick={() => setSelectedId(item.key)}
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
                        <span>{item.activityTitle}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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
            const isToday = date === today
            const isFuture = date > today
            return (
              <div
                key={date}
                className={`en-week-daylabel${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`}
              >
                <span className="en-week-weekday">
                  {new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-PT', {
                    weekday: 'short',
                    timeZone: 'UTC',
                  })}
                </span>
                <span className="en-week-date">{formatShortDate(date)}</span>
                <span className="en-week-sub">
                  {t('timeline.dayShort', { day: dayNumber(date) })}
                  {isToday ? ` · ${t('timeline.todayLabel')}` : ''}
                </span>
              </div>
            )
          })}
        </div>
        {participantRows.map((participant) => {
          const laneEntries = rangeItems.filter(
            (item) => item.participantId === participant.id && item.kind !== 'request',
          ).length
          return (
            <div className="en-week-lane" key={participant.id}>
              <div className="en-lane-axis">
                <span className="mono">{participant.alias}</span>
                <span>
                  {laneEntries === 1
                    ? t('timeline.laneEntry')
                    : t('timeline.laneEntries', { count: laneEntries })}
                </span>
              </div>
              {weekDates.map((date) => {
                const isToday = date === today
                const isFuture = date > today
                return (
                  <div
                    key={date}
                    className={`en-week-cell${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`}
                  >
                    {marksFor(participant.id, date).map((item) => {
                      const color =
                        item.kind === 'request' ? '#8A93A8' : entryKindMeta[item.kind].color
                      return (
                        <span
                          key={item.key}
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

  const participantLabel =
    participantView === 'all'
      ? t('list.allParticipants')
      : (allParticipants.find((participant) => participant.id === participantView)?.alias ??
        shortId(participantView))

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
          <span className={`en-live en-live-${eventStatus}`} aria-live="polite">
            {eventStatus === 'live' ? t('list.live') : t('list.offline')}
          </span>
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
            onChange={setParticipantView}
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
          {(Object.keys(entryKindMeta) as EntryType[]).map((kind) => (
            <span key={kind} className="en-legend-item">
              <span className="en-legend-icon" style={{ background: entryKindMeta[kind].color }}>
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
        </div>

        {timelineQuery.isError ? (
          <EntryErrorState
            error={timelineQuery.error}
            onRetry={() => void timelineQuery.refetch()}
          />
        ) : timelineQuery.isLoading ? (
          <EntryLoadingState />
        ) : rangeItems.length === 0 && zoom !== 'week' ? (
          <p className="en-empty">{t('timeline.empty')}</p>
        ) : null}

        {!timelineQuery.isError && !timelineQuery.isLoading ? (
          <>
            {zoom === 'day' ? renderDayView() : null}
            {zoom === 'hours' ? renderHoursView() : null}
            {zoom === 'week' ? renderWeekView() : null}
          </>
        ) : null}

        {zoom !== 'week' && selected ? (
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
              <span className="en-timeline-selected-activity">{selected.activityTitle}</span>
              {selectedDetail.data?.body ? (
                <span className="en-timeline-selected-excerpt">
                  {selectedDetail.data.body}
                </span>
              ) : null}
            </div>
            <div className="en-timeline-selected-side">
              <div className="en-timeline-selected-tags">
                {selectedTag ? <span className="en-tag">{selectedTag}</span> : null}
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
              {selected.entryId ? (
                <Link
                  className="btn btn-sm"
                  to={`${base}/registos?registo=${selected.entryId}`}
                >
                  {t('timeline.openEntry')}
                  <ChevronRightIcon width={16} height={16} />
                </Link>
              ) : null}
            </div>
          </div>
        ) : zoom === 'week' ? (
          <p className="sub">{t('timeline.weekNote', { time: nowTime })}</p>
        ) : null}

        <div className="en-timeline-footer">
          <span>
            {t('timeline.footer', {
              shown: participantRows.length,
              total:
                participantsQuery.data?.length ?? Math.max(participantRows.length, laneIds.size),
              range: participantLabel,
              timezone: timeZone,
            })}
          </span>
        </div>
      </section>
    </div>
  )
}
