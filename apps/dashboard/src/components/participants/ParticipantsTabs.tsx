import { Link, useLocation } from 'react-router-dom'
import { t } from '../../i18n/participants'

export default function ParticipantsTabs({
  studyId,
  waitingCount = 0,
}: {
  studyId: string
  waitingCount?: number
}) {
  const { pathname } = useLocation()
  const base = `/estudos/${studyId}/participantes`
  const onCodes = pathname.startsWith(`${base}/codigos`)
  const onRecruit = pathname === `${base}/convidar`

  return (
    <nav className="pts-tabs" aria-label={t('tabs.label')}>
      <Link
        to={base}
        className={!onCodes && !onRecruit ? 'pts-tab is-active' : 'pts-tab'}
        aria-current={!onCodes && !onRecruit ? 'page' : undefined}
      >
        {t('tabs.list')}
      </Link>
      <Link
        to={`${base}/codigos`}
        className={onCodes ? 'pts-tab is-active' : 'pts-tab'}
        aria-current={onCodes ? 'page' : undefined}
      >
        {t('tabs.codes')}
        {waitingCount > 0 ? <span className="pts-tab-badge">{waitingCount}</span> : null}
      </Link>
      <Link
        to={`${base}/convidar`}
        className={onRecruit ? 'pts-tab is-active' : 'pts-tab'}
        aria-current={onRecruit ? 'page' : undefined}
      >
        {t('tabs.recruit')}
      </Link>
    </nav>
  )
}
