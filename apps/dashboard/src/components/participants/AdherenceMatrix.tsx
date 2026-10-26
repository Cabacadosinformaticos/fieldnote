import type { AdherenceView } from '../../api/participants'
import { t } from '../../i18n/participants'
import { formatDate } from './format'

const cellLabels = {
  answered: 'detail.cellAnswered',
  expired: 'detail.cellExpired',
  pending: 'detail.cellPending',
  notSent: 'detail.cellNotSent',
} as const

export default function AdherenceMatrix({ view }: { view: AdherenceView }) {
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
          <strong>{t('detail.adherenceValue', { percent: view.totals.percent })}</strong>
          <span>
            {t('detail.adherenceOf', {
              answered: view.totals.answered,
              total: view.totals.sent,
            })}
          </span>
        </div>
      </div>

      <div className="pts-matrix-legend">
        <span className="pill ok">{t('detail.answeredPill', { count: view.counts.answered })}</span>
        <span className="pill ne">{t('detail.expiredPill', { count: view.counts.expired })}</span>
        <span className="pill wa">{t('detail.pendingPill', { count: view.counts.pending })}</span>
      </div>

      <div className="pts-matrix-scroll">
        <table className="pts-matrix">
          <thead>
            <tr>
              <th scope="col" className="pts-matrix-corner" />
              {view.days.map((date, index) => (
                <th scope="col" key={`day-${date}-${index}`} className="pts-matrix-day">
                  <span>{index + 1}</span>
                  <small>{formatDate(date)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.matrix.map((row, requestIndex) => (
              <tr key={`request-${view.slots[requestIndex] ?? requestIndex}`}>
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
              {view.free.map((value, dayIndex) => (
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
