import { Link, useParams } from 'react-router-dom'
import { InfoIcon, MapPinIcon, PencilIcon, PlusIcon } from '../../components/activities/ActivityIcons'
import TypeIcon from '../../components/activities/TypeIcon'
import {
  shortTime,
  useActivities,
  type Activity,
  type CaptureType,
} from '../../api/activities'
import {
  studiesErrorMessage,
  useEntries,
  useStudy,
  useStudyRole,
} from '../../api/studies'
import { t, type ActivitiesKey } from '../../i18n/activities'
import '../../styles/activities.css'

const typeLabels: Record<Exclude<CaptureType, 'scale'>, ActivitiesKey> = {
  photo: 'type.photo',
  text: 'type.text',
  video: 'type.video',
  audio: 'type.audio',
}

const tones = ['blue', 'teal', 'amber'] as const

function toneClass(index: number) {
  return `ac-tone-${tones[index % tones.length]}`
}

function isCaptureType(value: string): value is CaptureType {
  return value === 'photo' || value === 'text' || value === 'video' || value === 'audio' || value === 'scale'
}

function typeLabel(activity: Activity, type: CaptureType): string {
  if (type === 'scale') {
    return t('type.scaleRange', { points: activity.options?.points ?? 7 })
  }

  return t(typeLabels[type])
}

export default function ActivitiesListPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const basePath = `/estudos/${studyId}/atividades`
  const studyQuery = useStudy(studyId)
  const activitiesQuery = useActivities(studyId)
  const entriesQuery = useEntries(studyId, studyQuery.data)
  const access = useStudyRole(studyId)
  const study = studyQuery.data
  const activities = activitiesQuery.data ?? []
  const entries = entriesQuery.data?.items ?? []
  const maxRequestsPerDay = study?.max_prompts_per_day ?? 0
  const requestsPerDay = activities.reduce(
    (total, activity) => total + activity.prompts_per_day,
    0,
  )
  const totalMinutes = activities.reduce(
    (total, activity) => total + activity.expected_minutes * activity.prompts_per_day,
    0,
  )
  const breakdown = activities.map((activity) => activity.prompts_per_day).join(' + ')
  const loading = studyQuery.isLoading || activitiesQuery.isLoading
  const error = studyQuery.error ?? activitiesQuery.error ?? entriesQuery.error ?? null
  const canDesign = access.canDesign

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">{t('list.title')}</h1>
          <p className="ac-subtitle">{t('list.subtitle')}</p>
        </div>
        <div className="ac-header-actions">
          {canDesign ? (
            <Link className="btn btn-p" to={`${basePath}/nova`}>
              <PlusIcon />
              {t('list.new')}
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="ac-warning-box" role="alert">
          <span>{studiesErrorMessage(error)}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              void studyQuery.refetch()
              void activitiesQuery.refetch()
            }}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      {loading ? <p className="ac-empty">{t('state.loading')}</p> : null}

      <section className="card ac-effort-card" aria-label={t('list.effortTitle')}>
        <div className="ac-effort-head">
          <div className="ac-effort-copy">
            <h2 className="h2">{t('list.effortTitle')}</h2>
            <p className="ac-sub">{t('list.effortSubtitle')}</p>
          </div>
          <div className="ac-effort-total">
            <span className="ac-effort-value">{t('list.effortTotal', { total: totalMinutes })}</span>
            <span className="ac-sub">{t('common.perDay')}</span>
          </div>
        </div>

        <div
          className="ac-effort-bar"
          role="img"
          aria-label={activities
            .map((activity, index) =>
              t('list.effortAria', {
                code: `A${index + 1}`,
                minutes: activity.expected_minutes * activity.prompts_per_day,
              }),
            )
            .join(', ')}
        >
          {activities.map((activity, index) => {
            const minutes = activity.expected_minutes * activity.prompts_per_day
            return (
              <span
                key={activity.id}
                className={`ac-effort-segment ${toneClass(index)}${
                  index === 0 ? ' ac-effort-segment-first' : ''
                }${index === activities.length - 1 ? ' ac-effort-segment-last' : ''}`}
                style={{ flexGrow: minutes, flexBasis: 0 }}
              >
                {t('list.effortSegment', { code: `A${index + 1}`, minutes })}
              </span>
            )
          })}
        </div>

        <div className="ac-effort-legend">
          {activities.map((activity, index) => {
            const minutes = activity.expected_minutes * activity.prompts_per_day
            return (
              <span key={activity.id}>
                {t(
                  activity.prompts_per_day === 1 ? 'list.effortLegendOne' : 'list.effortLegendMany',
                  {
                    code: `A${index + 1}`,
                    requests: activity.prompts_per_day,
                    minutes: activity.expected_minutes,
                  },
                )}
                <b>{t('list.effortTotal', { total: minutes })}</b>
              </span>
            )
          })}
          <span className="ac-muted">{t('list.effortNote')}</span>
        </div>

        <div className="ac-info-box">
          <InfoIcon />
          <span>
            {t('list.effortLimitPrefix', {
              count: requestsPerDay,
              breakdown,
              max: maxRequestsPerDay,
            })}
            <Link to={`/estudos/${studyId}/definicoes`}>{t('list.effortLimitLink')}</Link>
            {t('list.effortLimitSuffix')}
          </span>
        </div>
      </section>

      <section className="ac-activity-list" aria-label={t('list.title')}>
        {activities.map((activity, index) => {
          const types = activity.entry_types.filter(isCaptureType)
          const freeCount = entries.filter(
            (entry) => entry.activity_id === activity.id && entry.prompt_id === null,
          ).length

          return (
            <article className="card ac-activity-card" key={activity.id}>
              <div className="ac-activity-head">
                <div className="ac-activity-heading">
                  <span
                    className={`ac-activity-badge ${toneClass(index)}`}
                    aria-label={t('list.activityAria', { code: `A${index + 1}` })}
                  >
                    A{index + 1}
                  </span>
                  <div className="ac-activity-copy">
                    <h2 className="h2">{activity.title}</h2>
                    <p className="ac-sub ac-activity-description">
                      {activity.instructions ?? t('list.noInstructions')}
                    </p>
                  </div>
                </div>
                {canDesign ? (
                  <Link
                    className="btn btn-sm ac-activity-edit"
                    to={`${basePath}/${activity.id}`}
                    aria-label={t('list.editAria', { title: activity.title })}
                  >
                    <PencilIcon width={16} height={16} />
                    {t('common.edit')}
                  </Link>
                ) : null}
              </div>

              <div className="ac-type-row" aria-label={t('list.typesAria')}>
                {types.map((type) => (
                  <span className="ac-type-chip" key={type}>
                    <TypeIcon type={type} size={14} />
                    {typeLabel(activity, type)}
                  </span>
                ))}
              </div>

              <dl className="ac-activity-details">
                <div className="ac-detail">
                  <dt>{t('list.details.window')}</dt>
                  <dd className="mono">
                    {t('list.windowValue', {
                      start: shortTime(activity.window_start),
                      end: shortTime(activity.window_end),
                    })}
                  </dd>
                </div>
                <div className="ac-detail">
                  <dt>{t('list.details.requests')}</dt>
                  <dd>{activity.prompts_per_day}</dd>
                </div>
                <div className="ac-detail">
                  <dt>{t('list.details.gap')}</dt>
                  <dd>{t('list.gapValue', { minutes: activity.min_gap_minutes })}</dd>
                </div>
                <div className="ac-detail">
                  <dt>{t('list.details.effort')}</dt>
                  <dd>{t('list.effortValue', { minutes: activity.expected_minutes })}</dd>
                </div>
                <div className="ac-detail">
                  <dt>{t('list.details.location')}</dt>
                  <dd>
                    {activity.capture_location ? (
                      <span className="ac-location-on">
                        <MapPinIcon width={16} height={16} />
                        {t('list.locationRequested')}
                      </span>
                    ) : (
                      t('list.locationNotRequested')
                    )}
                  </dd>
                </div>
                <div className="ac-detail">
                  <dt>{t('list.details.free')}</dt>
                  <dd>
                    {activity.allow_free_entries ? (
                      <>
                        {t('list.freeYes', { max: activity.max_free_entries_per_day ?? 0 })}
                        <span className="ac-detail-note">
                          {t('list.freeCount', { count: freeCount })}
                        </span>
                      </>
                    ) : (
                      t('list.freeNo')
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          )
        })}

        {!loading && !error && activities.length === 0 ? (
          <p className="ac-empty">{t('list.empty')}</p>
        ) : null}
      </section>
    </div>
  )
}
