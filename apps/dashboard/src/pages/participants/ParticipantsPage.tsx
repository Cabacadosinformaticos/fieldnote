import { useMemo, useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
import ParticipantsTable from '../../components/participants/ParticipantsTable'
import ParticipantsTabs from '../../components/participants/ParticipantsTabs'
import { SearchIcon, TicketIcon, UserPlusIcon } from '../../components/participants/icons'
import {
  filterLabelOverrides,
  participantFilterCount,
  participantFilters,
  participantsForFilter,
  searchParticipants,
  type FilterKey,
} from '../../fake/participants'
import { t } from '../../i18n/participants'

export default function ParticipantsPage() {
  const { studyId = 'jardim-da-estrela' } = useParams<{ studyId: string }>()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(
    () => searchParticipants(participantsForFilter(filter), query),
    [filter, query],
  )
  const base = `/estudos/${studyId}/participantes`

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

      <ParticipantsTabs studyId={studyId} />

      <div className="pts-waiting">
        <span className="pts-waiting-icon">
          <TicketIcon />
        </span>
        <p>
          <strong>{t('list.waitingBanner')}</strong>
          <span>{t('list.waitingBannerNote')}</span>
        </p>
        <Link className="btn btn-sm" to={`${base}/codigos`}>
          {t('list.review')}
        </Link>
      </div>

      <section className="pts-list">
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
                {filterLabelOverrides[item.key] ?? t(item.labelKey)}
                <span className="pts-filter-count">{participantFilterCount(item.key)}</span>
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

        <ParticipantsTable studyId={studyId} rows={rows} />

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
            <span className="pts-legend-today">{t('list.legendToday')}</span>
          </div>
          <p className="pts-list-summary">{t('list.footerA')}</p>
          <p className="pts-list-footnote">{t('list.footerB')}</p>
          <div className="pts-list-details">
            <details className="pts-states">
              <summary>
                {t('list.newStates')}
                <span aria-hidden="true">+</span>
              </summary>
              <div>
                <p>
                  <strong>{t('status.left')}</strong> {t('list.newStatesLeft')}
                </p>
                <p>
                  <strong>{t('status.withdrawn')}</strong> {t('list.newStatesRight')}
                </p>
                <p>
                  <strong>{t('status.deleting')}</strong> {t('list.newStateDeleting')}
                </p>
              </div>
            </details>
            <details className="pts-states">
              <summary>
                {t('list.entry')}
                <span aria-hidden="true">+</span>
              </summary>
              <div>
                <p>{t('list.entryNote')}</p>
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>
  )
}
