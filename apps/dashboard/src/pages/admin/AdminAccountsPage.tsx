import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AdminApiError,
  useAccounts,
  useChangeAccountRole,
  useCreateAccount,
  useDeleteAccount,
  useLockAccount,
  useUnlockAccount,
  type AdminAccount,
  type CreatedAccount,
  type UserRole,
} from '../../api/admin'
import AccountDialog, { type AccountDraft } from '../../components/admin/AccountDialog'
import { formatDateTime, shortId } from '../../components/admin/format'
import {
  ClockIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
} from '../../components/admin/icons'
import { useAuth } from '../../auth/useAuth'
import { t, type AdminKey } from '../../i18n/admin'
import '../../styles/admin.css'

type FilterKey = 'all' | 'active' | 'locked'

const filters: { key: FilterKey; labelKey: AdminKey }[] = [
  { key: 'all', labelKey: 'acct.filter.all' },
  { key: 'active', labelKey: 'acct.filter.active' },
  { key: 'locked', labelKey: 'acct.filter.locked' },
]

function roleLabel(role: UserRole) {
  return role === 'admin' ? t('acct.role.admin') : t('acct.role.researcher')
}

function accountErrorText(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return t('acct.error.generic', { code: 'unknown' })
  }
  switch (error.code) {
    case 'email_in_use':
      return t('acct.error.emailInUse')
    case 'invalid_email':
      return t('acct.error.invalidEmail')
    case 'cannot_lock_own_account':
    case 'cannot_delete_own_account':
    case 'cannot_change_own_role':
      return t('acct.error.self')
    case 'account_not_found':
      return t('acct.error.notFound')
    default:
      return t('acct.error.generic', { code: error.code })
  }
}

export default function AdminAccountsPage({ newAccountOpen = false }: { newAccountOpen?: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const createAccount = useCreateAccount()
  const changeRole = useChangeAccountRole()
  const lockAccount = useLockAccount()
  const unlockAccount = useUnlockAccount()
  const deleteAccount = useDeleteAccount()

  const [createOpen, setCreateOpen] = useState(newAccountOpen)
  const [created, setCreated] = useState<CreatedAccount | null>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])

  const counts = useMemo(
    () => ({
      all: accounts.length,
      active: accounts.filter((account) => !account.locked).length,
      locked: accounts.filter((account) => account.locked).length,
    }),
    [accounts],
  )

  const visibleAccounts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !account.locked) ||
        (filter === 'locked' && account.locked)
      const matchesQuery = term.length === 0 || account.email.toLowerCase().includes(term)
      return matchesFilter && matchesQuery
    })
  }, [accounts, filter, query])

  function closeCreate() {
    createAccount.reset()
    if (newAccountOpen) {
      navigate('/admin/contas')
      return
    }
    setCreateOpen(false)
  }

  function handleCreate(draft: AccountDraft) {
    createAccount.mutate(draft, {
      onSuccess: (account) => {
        setCreateOpen(false)
        setNotice('')
        setCopied(false)
        setCreated(account)
      },
    })
  }

  function handleUpdate(draft: AccountDraft) {
    if (!editing) {
      return
    }
    changeRole.mutate(
      { userId: editing.id, role: draft.role },
      {
        onSuccess: () => {
          setNotice(t('acct.updated', { email: editing.email }))
          setEditing(null)
        },
      },
    )
  }

  function handleLock(account: AdminAccount) {
    setActionError('')
    lockAccount.mutate(account.id, {
      onSuccess: () => setNotice(t('acct.locked', { email: account.email })),
      onError: (error) => {
        setNotice('')
        setActionError(accountErrorText(error))
      },
    })
  }

  function handleUnlock(account: AdminAccount) {
    setActionError('')
    unlockAccount.mutate(account.id, {
      onSuccess: () => setNotice(t('acct.unlocked', { email: account.email })),
      onError: (error) => {
        setNotice('')
        setActionError(accountErrorText(error))
      },
    })
  }

  function handleDelete(account: AdminAccount) {
    if (!window.confirm(t('acct.deleteConfirm', { email: account.email }))) {
      return
    }
    setActionError('')
    deleteAccount.mutate(account.id, {
      onSuccess: () => setNotice(t('acct.deleted', { email: account.email })),
      onError: (error) => {
        setNotice('')
        setActionError(accountErrorText(error))
      },
    })
  }

  async function copyPassword() {
    if (!created) {
      return
    }
    try {
      await navigator.clipboard.writeText(created.temporary_password)
      setCopied(true)
    } catch {
      // The password stays visible so it can be copied by hand.
    }
  }

  return (
    <div className="ad-page">
      <header className="ad-page-head">
        <div className="ad-head-copy">
          <h1 className="ad-title">{t('acct.title')}</h1>
          <p className="ad-subtitle">{t('acct.subtitle')}</p>
        </div>
        <Link
          className="btn btn-p"
          to="/admin/contas/nova"
          onClick={() => {
            createAccount.reset()
            setCreateOpen(true)
            setCopied(false)
          }}
        >
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

      {actionError ? (
        <div className="ad-error-notice" role="alert">
          {actionError}
        </div>
      ) : null}

      {created ? (
        <section className="ad-temp-card" role="status">
          <div>
            <h2 className="ad-info-title">{t('acct.tempTitle')}</h2>
            <p className="ad-info-text">{t('acct.tempBody', { email: created.email })}</p>
          </div>
          <div className="ad-temp-row">
            <span className="ad-label">{t('acct.tempLabel')}</span>
            <code className="ad-temp-password">{created.temporary_password}</code>
            <button type="button" className="ad-btn-sm" onClick={() => void copyPassword()}>
              {copied ? t('acct.copied') : t('acct.copy')}
            </button>
            <button type="button" className="btn btn-p" onClick={() => setCreated(null)}>
              {t('acct.tempDone')}
            </button>
          </div>
        </section>
      ) : null}

      <section className="ad-table-card" aria-label={t('acct.listLabel')}>
        <div className="ad-table-scroll">
          <div className="ad-account-grid ad-table-head">
            <span>{t('acct.col.account')}</span>
            <span>{t('acct.col.role')}</span>
            <span>{t('acct.col.state')}</span>
            <span>{t('acct.col.totp')}</span>
            <span>{t('acct.col.actions')}</span>
          </div>

          {accountsQuery.isPending ? (
            <div className="ad-empty" aria-busy="true">
              {t('acct.loading')}
            </div>
          ) : null}

          {accountsQuery.isError ? (
            <div className="ad-empty">
              <p>{t('acct.loadError')}</p>
              <button type="button" className="ad-btn-sm" onClick={() => void accountsQuery.refetch()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {!accountsQuery.isPending && !accountsQuery.isError
            ? visibleAccounts.map((account) => {
                const isSelf = account.id === user?.id
                return (
                  <div
                    key={account.id}
                    className={
                      isSelf ? 'ad-account-grid ad-table-row is-self' : 'ad-account-grid ad-table-row'
                    }
                  >
                    <div className="ad-account-identity">
                      <span className={account.locked ? 'ad-account-name is-disabled' : 'ad-account-name'}>
                        {account.email}
                      </span>
                      <span className="ad-account-email">
                        {formatDateTime(account.created_at)} · {shortId(account.id)}
                      </span>
                    </div>

                    <span className="ad-cell-strong">{roleLabel(account.role)}</span>

                    <div>
                      <span className={`pill ${account.locked ? 'ne' : 'ok'} ad-state-pill`}>
                        <span
                          className={`ad-state-dot ${account.locked ? '' : 'is-active'}`}
                          aria-hidden="true"
                        />
                        {account.locked ? t('acct.state.locked') : t('acct.state.active')}
                      </span>
                    </div>

                    <div>
                      {account.totp_enrolled ? (
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
                        className={isSelf ? 'ad-btn-sm ad-btn-muted' : 'ad-btn-sm'}
                        aria-label={isSelf ? t('acct.selfAria') : t('acct.editAria', { email: account.email })}
                        onClick={() => setEditing(account)}
                        disabled={isSelf || changeRole.isPending}
                      >
                        {t('common.edit')}
                      </button>

                      {account.locked ? (
                        <button
                          type="button"
                          className="ad-btn-sm"
                          aria-label={t('acct.unlockAria', { email: account.email })}
                          onClick={() => handleUnlock(account)}
                          disabled={unlockAccount.isPending}
                        >
                          {t('acct.unlock')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={isSelf ? 'ad-btn-sm ad-btn-muted' : 'ad-btn-sm ad-btn-danger'}
                          aria-label={isSelf ? t('acct.selfAria') : t('acct.lockAria', { email: account.email })}
                          onClick={() => handleLock(account)}
                          disabled={isSelf || lockAccount.isPending}
                        >
                          {t('acct.lock')}
                        </button>
                      )}

                      <button
                        type="button"
                        className={isSelf ? 'ad-btn-sm ad-btn-muted' : 'ad-btn-sm ad-btn-danger'}
                        aria-label={isSelf ? t('acct.selfAria') : t('acct.deleteAria', { email: account.email })}
                        onClick={() => handleDelete(account)}
                        disabled={isSelf || deleteAccount.isPending}
                      >
                        {t('acct.delete')}
                      </button>
                    </div>
                  </div>
                )
              })
            : null}

          {!accountsQuery.isPending && !accountsQuery.isError && visibleAccounts.length === 0 ? (
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

      {createOpen ? (
        <AccountDialog
          mode="create"
          submitting={createAccount.isPending}
          error={createAccount.error ? accountErrorText(createAccount.error) : ''}
          onClose={closeCreate}
          onSubmit={handleCreate}
        />
      ) : null}

      {editing ? (
        <AccountDialog
          key={editing.id}
          mode="edit"
          account={editing}
          submitting={changeRole.isPending}
          error={changeRole.error ? accountErrorText(changeRole.error) : ''}
          onClose={() => {
            changeRole.reset()
            setEditing(null)
          }}
          onSubmit={handleUpdate}
        />
      ) : null}
    </div>
  )
}
