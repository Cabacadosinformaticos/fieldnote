import { LockIcon } from '../../components/admin/icons'
import {
  poolDraft,
  poolFields,
  poolInvites,
  poolKpis,
  poolTotal,
  poolTowns,
} from '../../fake/admin'
import { t } from '../../i18n/admin'
import '../../styles/admin.css'

function percent(value: number) {
  return Math.round((value * 100) / poolTotal)
}

export default function AdminPoolPage() {
  const maxTown = Math.max(...poolTowns.map((town) => town.count))
  const invitesTotal = poolInvites.accepted + poolInvites.refused + poolInvites.expired

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('pool.title')}</h1>
          <p className="ad-subtitle">{t('pool.subtitle')}</p>
        </div>
      </header>

      <div className="ad-banner">
        <LockIcon width={20} height={20} />
        <p>
          <strong>{t('pool.localTitle')}</strong>
          {t('pool.localBody')}
        </p>
      </div>

      <section className="ad-kpis" aria-label={t('pool.title')}>
        {poolKpis.map((kpi) => (
          <div key={kpi.labelKey} className="ad-kpi">
            <span className="ad-kpi-label">{t(kpi.labelKey)}</span>
            <span className="ad-kpi-value">{kpi.value}</span>
            <span className="ad-kpi-note">{kpi.note}</span>
          </div>
        ))}
      </section>

      <div className="ad-pool-grid">
        <section className="ad-chart-card">
          <div className="ad-card-heading">
            <h2 className="ad-card-title">{t('pool.townsTitle')}</h2>
            <span className="ad-card-lead">
              {t('pool.townsNote', { total: poolTotal })}
            </span>
          </div>

          <ul className="ad-bars ad-town-bars">
            {poolTowns.map((town) => (
              <li key={town.name}>
                <span className="ad-bar-name">{town.name}</span>
                <div className="ad-bar ad-bar-lg">
                  <div
                    className={town.other ? 'ad-bar-fill is-muted' : 'ad-bar-fill'}
                    style={{ width: `${(town.count * 100) / maxTown}%` }}
                  />
                </div>
                <span className="ad-bar-value">
                  {town.count} <span className="ad-bar-pct">{percent(town.count)} %</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="ad-card-footnote">{t('pool.townsFootnote')}</p>
        </section>

        <section className="ad-chart-card">
          <div className="ad-card-heading">
            <h2 className="ad-card-title">{t('pool.fieldsTitle')}</h2>
            <span className="ad-card-lead">
              {t('pool.fieldsNote', { total: poolTotal })}
            </span>
          </div>

          <ul className="ad-bars ad-field-bars">
            {poolFields.map((field, index) => (
              <li key={field.labelKey}>
                <span className="ad-bar-name">{t(field.labelKey)}</span>
                <div className="ad-bar ad-bar-sm">
                  <div
                    className={index === 0 ? 'ad-bar-fill is-strong' : 'ad-bar-fill'}
                    style={{ width: `${(field.count * 100) / poolTotal}%` }}
                  />
                </div>
                <span className="ad-bar-value">
                  {field.count} <span className="ad-bar-pct">{percent(field.count)} %</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="ad-card-footnote">{t('pool.fieldsFootnote')}</p>
        </section>
      </div>

      <section className="ad-chart-card">
        <div className="ad-card-heading">
          <h2 className="ad-card-title">{t('pool.invitesTitle')}</h2>
          <span className="ad-card-lead">{t('pool.invitesNote')}</span>
        </div>

        <div className="ad-invites">
          <div className="ad-invites-head">
            <span className="ad-invites-title">
              <span className="ad-mono ad-study-id">{poolInvites.study}</span> ·{' '}
              {poolInvites.title}{' '}
              <span className="ad-cell-muted ad-invites-team">· equipa de {poolInvites.team}</span>
            </span>
            <span className="ad-invites-meta">
              {t('pool.invitesMeta', { count: poolInvites.sent, when: poolInvites.when })}
            </span>
          </div>

          <div
            className="ad-invites-bar"
            role="img"
            aria-label={t('pool.invitesBarAria', {
              total: invitesTotal,
              accepted: poolInvites.accepted,
              refused: poolInvites.refused,
              expired: poolInvites.expired,
            })}
          >
            <div
              className="ad-invites-seg is-accepted"
              style={{ width: `${(poolInvites.accepted * 100) / invitesTotal}%` }}
            >
              {poolInvites.accepted}
            </div>
            <div
              className="ad-invites-seg is-refused"
              style={{ width: `${(poolInvites.refused * 100) / invitesTotal}%` }}
            >
              {poolInvites.refused}
            </div>
            <div
              className="ad-invites-seg is-expired"
              style={{ width: `${(poolInvites.expired * 100) / invitesTotal}%` }}
            >
              {poolInvites.expired}
            </div>
          </div>

          <div className="ad-invites-legend">
            <span>
              <span className="ad-swatch is-accepted" aria-hidden="true" />
              <strong>{poolInvites.accepted}</strong> {t('pool.legend.accepted')} (
              {Math.round((poolInvites.accepted * 100) / invitesTotal)} %)
            </span>
            <span>
              <span className="ad-swatch is-refused" aria-hidden="true" />
              <strong>{poolInvites.refused}</strong> {t('pool.legend.refused')} (
              {Math.round((poolInvites.refused * 100) / invitesTotal)} %)
            </span>
            <span>
              <span className="ad-swatch is-expired" aria-hidden="true" />
              <strong>{poolInvites.expired}</strong> {t('pool.legend.expired')} (
              {Math.round((poolInvites.expired * 100) / invitesTotal)} %)
            </span>
          </div>
        </div>

        <div className="ad-invites-draft">
          <span>
            <span className="ad-mono ad-study-id">{poolDraft.study}</span> · {poolDraft.title}:{' '}
            {poolDraft.note}
          </span>
          <span className="ad-cell-muted">{t('pool.draftLabel')}</span>
        </div>
      </section>

      <section className="ad-info-card">
        <LockIcon />
        <div>
          <h2 className="ad-info-title">{t('pool.rulesTitle')}</h2>
          <ul className="ad-info-list">
            <li>{t('pool.rule1')}</li>
            <li>{t('pool.rule2')}</li>
            <li>{t('pool.rule3')}</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
