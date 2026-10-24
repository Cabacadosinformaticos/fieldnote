import type { ParticipantDetail } from '../../fake/participants'
import { t } from '../../i18n/participants'

const DAYS = 14

const cellLabels = {
  answered: 'detail.cellAnswered',
  expired: 'detail.cellExpired',
  pending: 'detail.cellPending',
  notSent: 'detail.cellNotSent',
} as const

export default function AdherenceMatrix({ detail }: { detail: ParticipantDetail }) {
  const counts = { answered: 0, expired: 0, pending: 0 }
  detail.matrix.forEach((row) => {
    row.forEach((cell) => {
      if (cell === 'answered') counts.answered += 1
      if (cell === 'expired') counts.expired += 1
      if (cell === 'pending') counts.pending += 1
    })
  })

  return (
    <section className="card pts-matrix-card" aria-labelledby="pts-matrix-title">
      <div className="pts-section-head">
        <div>
          <h2 className="h2" id="pts-matrix-title">
            {t('detail.adherenceTitle')}
          </h2>
          <p className="sub">{t('detail.adherenceSub')}</p>
        </div>
        <div className="pts-matrix-score">
          <strong>{t('detail.adherenceValue', { percent: detail.totals.percent })}</strong>
          <span>
            {t('detail.adherenceOf', {
              answered: detail.totals.answered,
              total: detail.totals.sent,
            })}
          </span>
        </div>
      </div>

      <div className="pts-matrix-legend">
        <span className="pill ok">{t('detail.answeredPill', { count: counts.answered })}</span>
        <span className="pill ne">{t('detail.expiredPill', { count: counts.expired })}</span>
        <span className="pill wa">{t('detail.pendingPill', { count: counts.pending })}</span>
      </div>

      <div className="pts-matrix-scroll">
        <table className="pts-matrix">
          <thead>
            <tr>
              <th scope="col" className="pts-matrix-corner" />
              {Array.from({ length: DAYS }, (_, index) => (
                <th scope="col" key={`day-${index}`} className="pts-matrix-day">
                  <span>{index + 1}</span>
                  <small>{index + 6} out.</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.matrix.map((row, requestIndex) => (
              <tr key={`request-${requestIndex}`}>
                <th scope="row">{t('detail.request', { n: requestIndex + 1 })}</th>
                {row.map((cell, dayIndex) => (
                  <td key={`r${requestIndex}-d${dayIndex}`}>
                    <span
                      className={`pts-matrix-cell is-${cell}`}
                      title={t(cellLabels[cell])}
                      aria-label={t(cellLabels[cell])}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="pts-matrix-free">
              <th scope="row">{t('detail.free')}</th>
              {detail.free.map((value, dayIndex) => (
                <td key={`free-${dayIndex}`}>
                  {value === null ? (
                    <span className="pts-free-empty">{t('table.dash')}</span>
                  ) : (
                    <span className={value > 0 ? 'pts-free-value has-value' : 'pts-free-value'}>
                      {value}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pts-matrix-key">
        <span>
          <i className="pts-key is-answered" />
          {t('detail.legendAnswered')}
        </span>
        <span>
          <i className="pts-key is-expired" />
          {t('detail.legendExpired')}
        </span>
        <span>
          <i className="pts-key is-pending" />
          {t('detail.legendPending')}
        </span>
        <span>
          <i className="pts-key is-notSent" />
          {t('detail.legendNotSent')}
        </span>
      </div>
    </section>
  )
}
