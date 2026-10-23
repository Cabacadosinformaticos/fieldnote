import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AccountDialog, { type AccountDraft } from '../../components/admin/AccountDialog'
import {
  ClockIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
} from '../../components/admin/icons'
import {
  accounts as initialAccounts,
  type AccountState,
  type AdminAccount,
} from '../../fake/admin'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

type FilterKey = 'all' | AccountState

const filters: { key: FilterKey; labelKey: AdminKey }[] = [
  { key: 'all', labelKey: 'acct.filter.all' },
  { key: 'active', labelKey: 'acct.filter.active' },
  { key: 'disabled', labelKey: 'acct.filter.disabled' },
  { key: 'blocked', labelKey: 'acct.filter.blocked' },
]

const stateLabel: Record<AccountState, 'acct.state.active' | 'acct.state.disabled' | 'acct.state.blocked'> = {
  active: 'acct.state.active',
  disabled: 'acct.state.disabled',
  blocked: 'acct.state.blocked',
}

export default function AdminAccountsPage({ newAccountOpen = false }: { newAccountOpen?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { created?: string } | null
  const createdEmail = locationState?.created ?? ''

  const [accounts, setAccounts] = useState<AdminAccount[]>(initialAccounts)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [notice, setNotice] = useState(
    createdEmail ? t('acct.created', { email: createdEmail }) : '',
  )

  const counts = useMemo(() => {
    return {
      all: accounts.length,
      active: accounts.filter((account) => account.state === 'active').length,
      disabled: accounts.filter((account) => account.state === 'disabled').length,
      blocked: accounts.filter((account) => account.state === 'blocked').length,
    }
  }, [accounts])

  const visibleAccounts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesFilter = filter === 'all' || account.state === filter
      const matchesQuery =
        term.length === 0 ||
        account.name.toLowerCase().includes(term) ||
        account.email.toLowerCase().includes(term)
      return matchesFilter && matchesQuery
    })
  }, [accounts, filter, query])

  function closeDialog() {
    if (newAccountOpen) {
      navigate('/admin/contas')
      return
    }
    setEditing(null)
  }

  function handleCreate(draft: AccountDraft) {
    navigate('/admin/contas', { state: { created: draft.email } })
  }

  function handleUpdate(draft: AccountDraft) {
    if (!editing) {
      return
    }
    setAccounts((current) =>
      current.map((account) =>
        account.id === editing.id
          ? {
              ...account,
              name: draft.name,
              email: draft.email,
              role: draft.role,
              roleLabel:
                draft.role === account.role
                  ? account.roleLabel
                  : draft.role === 'admin'
                    ? 'Administrador'
                    : 'Investigador',
            }
          : account,
      ),
    )
    setNotice(t('acct.updated', { name: draft.name }))
    setEditing(null)
  }

  function changeState(account: AdminAccount, state: AccountState) {
    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? { ...item, state } : item)),
    )
    setNotice(
      state === 'disabled'
        ? t('acct.deactivated', { name: account.name })
        : t('acct.reactivated', { name: account.name }),
    )
  }

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('acct.title')}</h1>
          <p className="ad-subtitle">{t('acct.subtitle')}</p>
        </div>
        <Link className="btn btn-p" to="/admin/contas/nova">
          <PlusIcon />
          {t('acct.new')}
        </Link>
      </header>

      <div className="ad-toolbar">
        <div className="ad-toolbar-left">
          <div className="ad-search">
            <SearchIcon />
            <label className="ad-visually-hidden" htmlFor="ad-account-search">
              {t('acct.searchLabel')}
            </label>
            <input
              id="ad-account-search"
              type="search"
              className="ad-input"
              placeholder={t('acct.searchLabel')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="ad-filters" role="group" aria-label={t('acct.filterLabel')}>
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={filter === item.key ? 'ad-filter is-active' : 'ad-filter'}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {t(item.labelKey)} <span className="ad-filter-count">{counts[item.key]}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="ad-muted">{t('acct.sortNote')}</span>
      </div>

      {notice ? (
        <div className="ad-notice" role="status">
          {notice}
        </div>
      ) : null}

      <section className="ad-table-card" aria-label={t('acct.listLabel')}>
        <div className="ad-table-scroll">
          <div className="ad-account-grid ad-table-head">
            <span>{t('acct.col.account')}</span>
            <span>{t('acct.col.role')}</span>
            <span>{t('acct.col.studies')}</span>
            <span>{t('acct.col.lastSession')}</span>
            <span>{t('acct.col.state')}</span>
            <span>{t('acct.col.totp')}</span>
            <span>{t('acct.col.actions')}</span>
          </div>

          {visibleAccounts.map((account) => (
            <div
              key={account.id}
              className={
                account.self ? 'ad-account-grid ad-table-row is-self' : 'ad-account-grid ad-table-row'
              }
            >
              <div className="ad-account-identity">
                <span
                  className={
                    account.state === 'disabled'
                      ? 'ad-account-name is-disabled'
                      : 'ad-account-name'
                  }
                >
                  {account.name}
                </span>
                <span className="ad-account-email">{account.email}</span>
              </div>

              <span className="ad-cell-strong">{account.roleLabel}</span>

              <span
                className={
                  account.studies === 'Nenhum' ? 'ad-cell ad-cell-muted' : 'ad-cell'
                }
              >
                {account.studies}
              </span>

              <div className="ad-last-session">
                <span className="ad-cell-strong">{account.lastDay}</span>
                <span className="ad-mono ad-time">{account.lastTime}</span>
              </div>

              <div>
                <span
                  className={`pill ${account.state === 'active' ? 'ok' : 'ne'} ad-state-pill`}
                >
                  <span
                    className={`ad-state-dot ${account.state === 'active' ? 'is-active' : ''}`}
                    aria-hidden="true"
                  />
                  {t(stateLabel[account.state])}
                </span>
              </div>

              <div>
                {account.totp ? (
                  <span className="pill ok ad-totp-pill">
                    <ShieldCheckIcon width={14} height={14} />
                    {t('acct.totp.active')}
                  </span>
                ) : (
                  <span className="ad-cell ad-cell-muted">{t('acct.totp.notRequired')}</span>
                )}
              </div>

              <div className="ad-row-actions">
                <button
                  type="button"
                  className="ad-btn-sm"
                  aria-label={t('acct.editAria', { name: account.name })}
                  onClick={() => setEditing(account)}
                >
                  {t('common.edit')}
                </button>

                {account.state !== 'disabled' ? (
                  <button
                    type="button"
                    className="ad-btn-sm"
                    aria-label={t('acct.sendLinkAria', { name: account.name })}
                    onClick={() => setNotice(t('acct.linkSent', { email: account.email }))}
                  >
                    {t('acct.sendLink')}
                  </button>
                ) : null}

                {account.state === 'disabled' || account.state === 'blocked' ? (
                  <button
                    type="button"
                    className="ad-btn-sm"
                    aria-label={t('acct.reactivateAria', { name: account.name })}
                    onClick={() => changeState(account, 'active')}
                  >
                    {t('acct.reactivate')}
                  </button>
                ) : account.self ? (
                  <button
                    type="button"
                    className="ad-btn-sm ad-btn-muted"
                    aria-label={t('acct.selfAria')}
                    disabled
                  >
                    {t('acct.deactivate')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ad-btn-sm ad-btn-danger"
                    aria-label={t('acct.deactivateAria', { name: account.name })}
                    onClick={() => changeState(account, 'disabled')}
                  >
                    {t('acct.deactivate')}
                  </button>
                )}
              </div>
            </div>
          ))}

          {visibleAccounts.length === 0 ? (
            <div className="ad-empty">{t('acct.empty')}</div>
          ) : null}
        </div>

        <div className="ad-table-foot">
          <span>
            {visibleAccounts.length === 1
              ? t('acct.footerCountOne')
              : t('acct.footerCount', { count: visibleAccounts.length })}
          </span>
          <span>{t('acct.footerNote')}</span>
        </div>
      </section>

      <div className="ad-info-grid">
        <section className="ad-info-card">
          <LockIcon />
          <div>
            <h2 className="ad-info-title">{t('acct.protectionTitle')}</h2>
            <p className="ad-info-text">{t('acct.protectionText')}</p>
          </div>
        </section>
        <section className="ad-info-card">
          <ClockIcon />
          <div>
            <h2 className="ad-info-title">{t('acct.deactivateTitle')}</h2>
            <p className="ad-info-text">{t('acct.deactivateText')}</p>
          </div>
        </section>
      </div>

      {newAccountOpen ? (
        <AccountDialog mode="create" onClose={closeDialog} onSubmit={handleCreate} />
      ) : null}

      {editing ? (
        <AccountDialog
          key={editing.id}
          mode="edit"
          account={editing}
          onClose={closeDialog}
          onSubmit={handleUpdate}
        />
      ) : null}
    </div>
  )
}
