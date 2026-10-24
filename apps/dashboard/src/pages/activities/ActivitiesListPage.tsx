import { Link, useParams } from 'react-router-dom'
import { InfoIcon, MapPinIcon, PencilIcon, PlusIcon } from '../../components/activities/ActivityIcons'
import TypeIcon from '../../components/activities/TypeIcon'
import {
  activities,
  activityToneClass,
  demoStudyId,
  getStudySettings,
  requestsTotalPerDay,
  type ActivitySummary,
  type ActivityTypeId,
} from '../../fake/activities'
import { t, type ActivitiesKey } from '../../i18n/activities'
import '../../styles/activities.css'

const typeLabels: Record<Exclude<ActivityTypeId, 'scale'>, ActivitiesKey> = {
  photo: 'type.photo',
  text: 'type.text',
  video: 'type.video',
  audio: 'type.audio',
}

function typeLabel(activity: ActivitySummary, type: ActivityTypeId): string {
  if (type === 'scale') {
    return t('type.scaleRange', { points: activity.scale?.points ?? 7 })
  }

  return t(typeLabels[type])
}

export default function ActivitiesListPage() {
  const { studyId = demoStudyId } = useParams<{ studyId: string }>()
  const basePath = `/estudos/${studyId}/atividades`
  const maxRequestsPerDay = getStudySettings().maxRequestsPerDay
  const requestsPerDay = requestsTotalPerDay()
  const totalMinutes = activities.reduce(
    (total, activity) => total + activity.effortMinutes * activity.requestsPerDay,
    0,
  )
  const breakdown = activities.map((activity) => activity.requestsPerDay).join(' + ')

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">{t('list.title')}</h1>
          <p className="ac-subtitle">{t('list.subtitle')}</p>
        </div>
        <div className="ac-header-actions">
          <Link className="btn btn-p" to={`${basePath}/nova`}>
            <PlusIcon />
            {t('list.new')}
          </Link>
        </div>
      </header>

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
            .map((activity) =>
              t('list.effortAria', {
                code: activity.code,
                minutes: activity.effortMinutes * activity.requestsPerDay,
              }),
            )
            .join(', ')}
        >
          {activities.map((activity, index) => {
            const minutes = activity.effortMinutes * activity.requestsPerDay
            return (
              <span
                key={activity.id}
                className={`ac-effort-segment ${activityToneClass(activity.tone)}${
                  index === 0 ? ' ac-effort-segment-first' : ''
                }${index === activities.length - 1 ? ' ac-effort-segment-last' : ''}`}
                style={{ flexGrow: minutes, flexBasis: 0 }}
              >
                {t('list.effortSegment', { code: activity.code, minutes })}
              </span>
            )
          })}
        </div>

        <div className="ac-effort-legend">
          {activities.map((activity) => {
            const minutes = activity.effortMinutes * activity.requestsPerDay
            return (
              <span key={activity.id}>
                {t(
                  activity.requestsPerDay === 1 ? 'list.effortLegendOne' : 'list.effortLegendMany',
                  {
                    code: activity.code,
                    requests: activity.requestsPerDay,
                    minutes: activity.effortMinutes,
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
        {activities.map((activity) => (
          <article className="card ac-activity-card" key={activity.id}>
            <div className="ac-activity-head">
              <div className="ac-activity-heading">
                <span
                  className={`ac-activity-badge ${activityToneClass(activity.tone)}`}
                  aria-label={t('list.activityAria', { code: activity.code })}
                >
                  {activity.code}
                </span>
                <div className="ac-activity-copy">
                  <h2 className="h2">{activity.title}</h2>
                  <p className="ac-sub ac-activity-description">{activity.description}</p>
                </div>
              </div>
              <Link
                className="btn btn-sm ac-activity-edit"
                to={`${basePath}/${activity.id}`}
                aria-label={t('list.editAria', { title: activity.title })}
              >
                <PencilIcon width={16} height={16} />
                {t('common.edit')}
              </Link>
            </div>

            <div className="ac-type-row" aria-label={t('list.typesAria')}>
              {activity.types.map((type) => (
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
                    start: activity.windowStart,
                    end: activity.windowEnd,
                  })}
                </dd>
              </div>
              <div className="ac-detail">
                <dt>{t('list.details.requests')}</dt>
                <dd>{activity.requestsPerDay}</dd>
              </div>
              <div className="ac-detail">
                <dt>{t('list.details.gap')}</dt>
                <dd>{t('list.gapValue', { minutes: activity.minGapMinutes })}</dd>
              </div>
              <div className="ac-detail">
                <dt>{t('list.details.effort')}</dt>
                <dd>{t('list.effortValue', { minutes: activity.effortMinutes })}</dd>
              </div>
              <div className="ac-detail">
                <dt>{t('list.details.location')}</dt>
                <dd>
                  {activity.locationRequested ? (
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
                  {activity.freeEntries.enabled ? (
                    <>
                      {t('list.freeYes', { max: activity.freeEntries.maxPerDay })}
                      <span className="ac-detail-note">
                        {t('list.freeCount', { count: activity.freeEntries.countSoFar })}
                      </span>
                    </>
                  ) : (
                    t('list.freeNo')
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  )
}
