import type { StudyStatus } from '../../fake/studies'
import { t } from '../../i18n/studies'

export default function StudyStatusPill({ status }: { status: StudyStatus }) {
  return (
    <span className={`st-status st-status-${status}`}>
      {status === 'ongoing' ? <span className="st-status-dot" aria-hidden="true" /> : null}
      {t(`status.${status}`)}
    </span>
  )
}
