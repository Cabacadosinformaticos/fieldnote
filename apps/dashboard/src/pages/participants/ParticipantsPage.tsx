import { useMemo, useState } from 'react'
import '../../styles/participants.css'
import { useQueries } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  dayStat,
  getAdherence,
  participantFilterCount,
  participantFilters,
  participantsKeys,
  searchParticipants,
  useApprovals,
  useCanReadIdentity,
  useParticipants,
  useStudy,
  type FilterKey,
} from '../../api/participants'
import { useStudyLiveRefresh } from '../../api/entries'
import { addDays, todayInTimezone } from '../../api/studies'
import ParticipantsTable, {
  type ParticipantRow,
} from '../../components/participants/ParticipantsTable'
import ParticipantsTabs from '../../components/participants/ParticipantsTabs'
import { SearchIcon, TicketIcon, UserPlusIcon } from '../../components/participants/icons'
import { t } from '../../i18n/participants'

const EMPTY_DAYS = [null, null, null, null]

export default function ParticipantsPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')

  const participants = useParticipants(studyId)
  const studyQuery = useStudy(studyId)
  const approvals = useApprovals(studyId)
  const canReadIdentity = useCanReadIdentity(studyId)
  useStudyLiveRefresh(studyId, [participantsKeys.root])
  const list = participants.data

  const filtered = useMemo(
    () =>
      searchParticipants(
        filter === 'all' ? list ?? [] : (list ?? []).filter((item) => item.status === filter),
        query,
      ),
    [list, filter, query],
  )

  const adherence = useQueries({
    queries: filtered.map((participant) => ({
      queryKey: participantsKeys.adherence(studyId, participant.id),
      queryFn: () => getAdherence(studyId, participant.id),
      retry: false,
      staleTime: 30_000,
    })),
  })

  const timeZone = studyQuery.data?.timezone ?? 'Europe/Lisbon'
  const today = todayInTimezone(timeZone)

  // The last four study days, ending today (or the study end once it has ended).
  const dayColumns = useMemo(() => {
    const startsOn = studyQuery.data?.starts_on
    if (!startsOn) {
      return []
    }
    const endsOn = studyQuery.data?.ends_on
    let last = today
    if (last < startsOn) {
      last = startsOn
    }
    if (endsOn && last > endsOn) {
      last = endsOn
    }
    const days: string[] = []
    for (let offset = 3; offset >= 0; offset -= 1) {
      const date = addDays(last, -offset)
      if (date >= startsOn && (!endsOn || date <= endsOn)) {
        days.push(date)
      }
    }
    return days
  }, [studyQuery.data?.starts_on, studyQuery.data?.ends_on, today])

  const rows: ParticipantRow[] = filtered.map((participant, index) => {
    const data = adherence[index]?.data
    const days =
      dayColumns.length === 0
        ? EMPTY_DAYS
        : dayColumns.map((date) => {
            const day = data?.days.find((item) => item.date === date)
            return day ? dayStat(day) : null
          })
    return { ...participant, days }
  })

  const base = `/estudos/${studyId}/participantes`
  const waiting = approvals.data?.length ?? 0

  return (
    <div className="pts-page">
      <header className="pts-page-head">
        <div>
          <h1 className="page-title">{t('area.title')}</h1>
          <p className="sub pts-lead">{t('area.subtitle')}</p>
        </div>
        <Link className="btn btn-p" to={`${base}/adicionar`}>
          <UserPlusIcon />
          {t('action.addParticipants')}
        </Link>
      </header>

      <ParticipantsTabs studyId={studyId} waitingCount={waiting} />

      {waiting > 0 ? (
        <div className="pts-waiting">
          <span className="pts-waiting-icon">
            <TicketIcon />
          </span>
          <p>
            <strong>
              {t(
                waiting === 1 ? 'list.waitingBanner' : 'list.waitingBannerPlural',
                { count: waiting },
              )}
            </strong>
            <span>{t('list.waitingBannerNote')}</span>
          </p>
          <Link className="btn btn-sm" to={`${base}/codigos`}>
            {t('list.review')}
          </Link>
        </div>
      ) : null}

      <section className="pts-list">
        {participants.isError ? (
          <div className="card pts-state">
            <p>{t('list.error')}</p>
            <button type="button" className="btn btn-sm" onClick={() => participants.refetch()}>
              {t('list.retry')}
            </button>
          </div>
        ) : participants.isLoading ? (
          <div className="card pts-state">
            <p>{t('list.loading')}</p>
          </div>
        ) : !list || list.length === 0 ? (
          <div className="card pts-state">
            <p>{t('list.emptyAll')}</p>
          </div>
        ) : (
          <>
            <div className="pts-list-toolbar">
              <div className="pts-filters" role="group" aria-label={t('list.filterLabel')}>
                {participantFilters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={filter === item.key ? 'pts-filter is-active' : 'pts-filter'}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {t(item.labelKey)}
                    <span className="pts-filter-count">
                      {participantFilterCount(list, item.key)}
                    </span>
                  </button>
                ))}
              </div>
              <label className="pts-search">
                <SearchIcon />
                <span className="sr-only">{t('list.searchLabel')}</span>
                <input
                  type="search"
                  value={query}
                  placeholder={t('list.searchPlaceholder')}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>

            <ParticipantsTable
              studyId={studyId}
              rows={rows}
              dayColumns={dayColumns}
              studyStart={studyQuery.data?.starts_on ?? null}
              today={today}
              timeZone={timeZone}
              canReadIdentity={canReadIdentity}
            />

            <div className="pts-list-notes">
              <div className="pts-legend">
                <span className="pts-legend-title">{t('list.legendTitle')}</span>
                <span>
                  <i className="pts-key is-answered" /> {t('list.legend75')}
                </span>
                <span>
                  <i className="pts-key is-pending" /> {t('list.legend50')}
                </span>
                <span>
                  <i className="pts-key is-expired" /> {t('list.legendBelow')}
                </span>
              </div>
              <p className="pts-list-summary">
                {list?.length === 1
                  ? t('list.footerCountOne')
                  : t('list.footerCount', { count: list?.length ?? 0 })}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
