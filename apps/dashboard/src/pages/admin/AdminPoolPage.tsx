import { usePoolOverview, type PoolOverview } from '../../api/admin'
import { LockIcon } from '../../components/admin/icons'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value * 100) / total) : 0
}

function fieldRows(data: PoolOverview): { labelKey: AdminKey; count: number }[] {
  return [
    { labelKey: 'pool.field.town', count: data.fields.concelho },
    { labelKey: 'pool.field.parish', count: data.fields.freguesia },
    { labelKey: 'pool.field.age', count: data.fields.age_band },
    { labelKey: 'pool.field.gender', count: data.fields.gender },
    { labelKey: 'pool.field.situation', count: data.fields.occupation },
    { labelKey: 'pool.field.travel', count: data.fields.usual_transport },
    { labelKey: 'pool.field.languages', count: data.fields.languages },
  ]
}

export default function AdminPoolPage() {
  const overview = usePoolOverview()

  if (overview.isLoading) {
    return (
      <div className="ad-page">
        <header className="ad-page-head">
          <div className="ad-head-copy">
            <h1 className="ad-title">{t('pool.title')}</h1>
            <p className="ad-subtitle">{t('pool.subtitle')}</p>
          </div>
        </header>
        <p className="ad-empty">{t('pool.loading')}</p>
      </div>
    )
  }

  if (overview.isError || !overview.data) {
    return (
      <div className="ad-page">
        <header className="ad-page-head">
          <div className="ad-head-copy">
            <h1 className="ad-title">{t('pool.title')}</h1>
            <p className="ad-subtitle">{t('pool.subtitle')}</p>
          </div>
        </header>
        <div className="ad-empty" role="alert">
          <span>{t('pool.loadError')}</span>
          <button type="button" className="btn btn-sm" onClick={() => void overview.refetch()}>
            {t('pool.retry')}
          </button>
        </div>
      </div>
    )
  }

  const data = overview.data
  const total = data.members_total
  const townRows = data.concelhos
  const maxTown = Math.max(1, ...townRows.map((town) => town.members))
  const fields = fieldRows(data)
  const topNames = townRows
    .filter((town) => town.concelho !== 'Outros')
    .slice(0, 3)
    .map((town) => town.concelho)
  const others = townRows.find((town) => town.concelho === 'Outros')
  const pendingInvites = Math.max(0, data.invitations_sent - data.invitations_accepted)

  const kpis: { labelKey: AdminKey; value: string; note: string }[] = [
    {
      labelKey: 'pool.kpi.members',
      value: String(total),
      note: t('pool.kpi.membersNote'),
    },
    {
      labelKey: 'pool.kpi.topTowns',
      value: String(data.top_concelhos),
      note:
        topNames.length > 0
          ? t('pool.kpi.topTownsNote', { names: topNames.join(', ') })
          : t('pool.kpi.topTownsNoteEmpty'),
    },
    {
      labelKey: 'pool.kpi.invited',
      value: String(data.invitations_sent),
      note: t('pool.kpi.invitedNote', { pending: pendingInvites }),
    },
    {
      labelKey: 'pool.kpi.accepted',
      value: String(data.invitations_accepted),
      note: t('pool.kpi.acceptedNote', {
        percent: percent(data.invitations_accepted, data.invitations_sent),
      }),
    },
  ]

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('pool.title')}</h1>
          <p className="ad-subtitle">{t('pool.subtitle')}</p>
        </div>
      </header>

      <section className="ad-kpis" aria-label={t('pool.title')}>
        {kpis.map((kpi) => (
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
            <span className="ad-card-lead">{t('pool.townsNote', { total })}</span>
          </div>

          <ul className="ad-bars ad-town-bars">
            {townRows.map((town) => (
              <li key={town.concelho}>
                <span className="ad-bar-name">{town.concelho}</span>
                <div className="ad-bar ad-bar-lg">
                  <div
                    className={town.concelho === 'Outros' ? 'ad-bar-fill is-muted' : 'ad-bar-fill'}
                    style={{ width: `${(town.members * 100) / maxTown}%` }}
                  />
                </div>
                <span className="ad-bar-value">
                  {town.members}{' '}
                  <span className="ad-bar-pct">{percent(town.members, total)} %</span>
                </span>
              </li>
            ))}
          </ul>

          {townRows.length > 0 ? (
            <p className="ad-card-footnote">
              {others
                ? t('pool.townsFootnote', { others: others.members })
                : t('pool.townsFootnoteEmpty')}
            </p>
          ) : null}
        </section>

        <section className="ad-chart-card">
          <div className="ad-card-heading">
            <h2 className="ad-card-title">{t('pool.fieldsTitle')}</h2>
            <span className="ad-card-lead">{t('pool.fieldsNote', { total })}</span>
          </div>

          <ul className="ad-bars ad-field-bars">
            {fields.map((field, index) => (
              <li key={field.labelKey}>
                <span className="ad-bar-name">{t(field.labelKey)}</span>
                <div className="ad-bar ad-bar-sm">
                  <div
                    className={index === 0 ? 'ad-bar-fill is-strong' : 'ad-bar-fill'}
                    style={{ width: `${percent(field.count, total)}%` }}
                  />
                </div>
                <span className="ad-bar-value">
                  {field.count}{' '}
                  <span className="ad-bar-pct">{percent(field.count, total)} %</span>
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

        {data.invitation_results.length === 0 ? (
          <p className="ad-card-footnote">{t('pool.invitesEmpty')}</p>
        ) : (
          data.invitation_results.map((invite) => {
            const outcomes = invite.accepted + invite.declined + invite.expired
            return (
              <div className="ad-invites" key={invite.study_id}>
                <div className="ad-invites-head">
                  <span className="ad-invites-title">{invite.study_title}</span>
                  <span className="ad-invites-meta">
                    {t('pool.invitesMeta', { count: invite.sent })}
                  </span>
                </div>

                <div
                  className="ad-invites-bar"
                  role="img"
                  aria-label={t('pool.invitesBarAria', {
                    total: outcomes,
                    accepted: invite.accepted,
                    refused: invite.declined,
                    expired: invite.expired,
                  })}
                >
                  <div
                    className="ad-invites-seg is-accepted"
                    style={{ width: `${percent(invite.accepted, outcomes)}%` }}
                  >
                    {invite.accepted}
                  </div>
                  <div
                    className="ad-invites-seg is-refused"
                    style={{ width: `${percent(invite.declined, outcomes)}%` }}
                  >
                    {invite.declined}
                  </div>
                  <div
                    className="ad-invites-seg is-expired"
                    style={{ width: `${percent(invite.expired, outcomes)}%` }}
                  >
                    {invite.expired}
                  </div>
                </div>

                <div className="ad-invites-legend">
                  <span>
                    <span className="ad-swatch is-accepted" aria-hidden="true" />
                    <strong>{invite.accepted}</strong> {t('pool.legend.accepted')} (
                    {percent(invite.accepted, outcomes)} %)
                  </span>
                  <span>
                    <span className="ad-swatch is-refused" aria-hidden="true" />
                    <strong>{invite.declined}</strong> {t('pool.legend.refused')} (
                    {percent(invite.declined, outcomes)} %)
                  </span>
                  <span>
                    <span className="ad-swatch is-expired" aria-hidden="true" />
                    <strong>{invite.expired}</strong> {t('pool.legend.expired')} (
                    {percent(invite.expired, outcomes)} %)
                  </span>
                </div>
              </div>
            )
          })
        )}
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
