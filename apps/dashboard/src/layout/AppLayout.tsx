import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { emailDisplayName, emailInitials } from '../components/participants/format'
import { useAuth } from '../auth/useAuth'
import { useErasures } from '../api/admin'
import { statusFromApi, useStudies } from '../api/studies'
import {
  ActivitiesIcon,
  ChevronRightIcon,
  EntriesIcon,
  ErasureIcon,
  ExportIcon,
  FolderIcon,
  KeyIcon,
  LogoMark,
  OverviewIcon,
  ParticipantsIcon,
  PlanIcon,
  PoolIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UpDownIcon,
} from '../components/icons'
import { t, type TranslationKey } from '../i18n'

type NavItem = {
  key: TranslationKey
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const adminNav: NavItem[] = [
  { key: 'nav.admin.accounts', to: '/admin/contas', icon: ParticipantsIcon },
  { key: 'nav.admin.studies', to: '/admin/estudos', icon: FolderIcon },
  { key: 'nav.admin.pool', to: '/admin/bolsa-de-voluntarios', icon: PoolIcon },
  { key: 'nav.admin.audit', to: '/admin/auditoria', icon: ShieldCheckIcon },
  { key: 'nav.admin.erasure', to: '/admin/pedidos-de-apagamento', icon: ErasureIcon },
]

const statusKeys = {
  ongoing: 'study.status.ongoing',
  draft: 'study.status.draft',
  finished: 'study.status.finished',
} as const

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const params = useParams<{ studyId?: string }>()
  const studyId = params.studyId
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!switcherOpen) {
      return
    }
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSwitcherOpen(false)
      }
    }
    const closeOnOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnKey)
    window.addEventListener('mousedown', closeOnOutside)
    return () => {
      window.removeEventListener('keydown', closeOnKey)
      window.removeEventListener('mousedown', closeOnOutside)
    }
  }, [switcherOpen])

  const isAdmin = user?.role === 'admin'
  // While a temporary password is pending, every other API route answers 403; do not ask.
  const mustChangePassword = user?.must_change_password ?? false
  const studiesQuery = useStudies(!mustChangePassword)
  const erasuresQuery = useErasures(isAdmin && !mustChangePassword)
  const studies = studiesQuery.data ?? []
  const currentStudy = studies.find((study) => study.id === studyId)
  const studyTitle =
    currentStudy?.title ?? (studiesQuery.isLoading ? t('study.switcherLoading') : t('study.switcherEmpty'))
  const studyStatus = currentStudy ? t(statusKeys[statusFromApi(currentStudy.status)]) : ''

  const researcherNav: NavItem[] = studyId
    ? [
        { key: 'nav.overview', to: `/estudos/${studyId}/visao-geral`, icon: OverviewIcon },
        { key: 'nav.plan', to: `/estudos/${studyId}/plano`, icon: PlanIcon },
        { key: 'nav.activities', to: `/estudos/${studyId}/atividades`, icon: ActivitiesIcon },
        { key: 'nav.participants', to: `/estudos/${studyId}/participantes`, icon: ParticipantsIcon },
        { key: 'nav.entries', to: `/estudos/${studyId}/registos`, icon: EntriesIcon },
        { key: 'nav.export', to: `/estudos/${studyId}/exportar`, icon: ExportIcon },
        { key: 'nav.settings', to: `/estudos/${studyId}/definicoes`, icon: SettingsIcon },
      ]
    : []

  const navItems = isAdmin ? adminNav : researcherNav
  const currentItem = navItems.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )
  const isStudiesIndex = location.pathname === '/estudos'
  const isPasswordPage = location.pathname === '/conta/palavra-passe'

  const userEmail = user?.email ?? ''
  const userCard = {
    name: userEmail ? emailDisplayName(userEmail) : '',
    role: t(isAdmin ? 'user.role.admin' : 'user.role.researcher'),
    initials: userEmail ? emailInitials(userEmail) : '',
  }
  const pendingErasures = erasuresQuery.data?.scheduled.length ?? 0

  async function handleSignOut() {
    await signOut()
    navigate('/entrar', { replace: true })
  }

  function switchStudy(nextId: string) {
    setSwitcherOpen(false)
    navigate(`/estudos/${nextId}/visao-geral`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <LogoMark />
            <span className="brand-name">{t('app.name')}</span>
          </div>

          {!isAdmin && studyId ? (
            <div className="study-switcher-wrap" ref={switcherRef}>
              <button
                type="button"
                className="study-switcher"
                aria-haspopup="menu"
                aria-expanded={switcherOpen}
                aria-label={t('study.switcherAria', {
                  study: studyTitle,
                  status: studyStatus,
                })}
                onClick={() => setSwitcherOpen((open) => !open)}
              >
                <span className="study-switcher-text">
                  <span className="study-switcher-label">{t('study.switcherLabel')}</span>
                  <span className="study-switcher-name">{studyTitle}</span>
                  {currentStudy ? (
                    <span className="study-status-pill">
                      <span className="status-dot" aria-hidden="true" />
                      {studyStatus}
                    </span>
                  ) : null}
                </span>
                <UpDownIcon />
              </button>

              {switcherOpen ? (
                <div className="study-switcher-menu" role="menu">
                  {studies.map((study) => (
                    <button
                      key={study.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={study.id === studyId}
                      className="study-switcher-option"
                      onClick={() => switchStudy(study.id)}
                    >
                      <span className="study-switcher-option-name">{study.title}</span>
                      <span className="study-switcher-option-status">
                        {t(statusKeys[statusFromApi(study.status)])}
                      </span>
                    </button>
                  ))}
                  {studies.length === 0 && !studiesQuery.isLoading ? (
                    <span className="study-switcher-empty">{t('study.switcherNoStudies')}</span>
                  ) : null}
                  <Link className="study-switcher-all" to="/estudos" onClick={() => setSwitcherOpen(false)}>
                    {t('study.switcherAll')}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {navItems.length > 0 ? (
            <nav
              className="sidebar-nav"
              aria-label={isAdmin ? t('nav.administration') : t('nav.studySections')}
            >
              {isAdmin ? <span className="sidebar-nav-label">{t('nav.administration')}</span> : null}
              {navItems.map((item) => {
                const Icon = item.icon
                const active = item.to === currentItem?.to
                const badge =
                  isAdmin && item.to === '/admin/pedidos-de-apagamento' && pendingErasures > 0
                    ? pendingErasures
                    : null

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={isAdmin ? 'nav-link nav-link-admin' : 'nav-link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon
                      width={isAdmin ? 18 : 20}
                      height={isAdmin ? 18 : 20}
                      strokeWidth={isAdmin ? 2 : 1.9}
                    />
                    <span className="nav-link-text">{t(item.key)}</span>
                    {badge !== null ? <span className="nav-badge">{badge}</span> : null}
                  </Link>
                )
              })}
            </nav>
          ) : null}

          <div className="sidebar-footer">
            <div className={isAdmin ? 'user-card user-card-admin' : 'user-card'}>
              <span className="user-avatar">{userCard.initials}</span>
              <span className="user-meta">
                <span className="user-name">{userCard.name}</span>
                <span className="user-role">{userCard.role}</span>
              </span>
              <Link
                className="user-card-link"
                to="/conta/palavra-passe"
                title={t('nav.password')}
                aria-label={t('nav.password')}
              >
                <KeyIcon width={16} height={16} />
              </Link>
            </div>
            <nav className="sidebar-nav" aria-label={t('nav.account')}>
              <button
                type="button"
                className="nav-link"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={handleSignOut}
              >
                <SignOutIcon width={isAdmin ? 18 : 20} height={isAdmin ? 18 : 20} />
                <span className="nav-link-text">{t('nav.signOut')}</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <nav className="breadcrumb" aria-label={t('breadcrumb.label')}>
            {isPasswordPage ? (
              <>
                <span>{t('nav.account')}</span>
                <ChevronRightIcon width={14} height={14} />
                <span className="breadcrumb-current">{t('nav.password')}</span>
              </>
            ) : isAdmin ? (
              <>
                <span>{t('nav.administration')}</span>
                <ChevronRightIcon width={14} height={14} />
                <span className="breadcrumb-current">
                  {currentItem ? t(currentItem.key) : null}
                </span>
              </>
            ) : isStudiesIndex ? (
              <span className="breadcrumb-current">{t('breadcrumb.studies')}</span>
            ) : studyId ? (
              <>
                <Link className="breadcrumb-link" to="/estudos">
                  {t('breadcrumb.studies')}
                </Link>
                <span aria-hidden="true">/</span>
                <Link className="breadcrumb-link" to={`/estudos/${studyId}/visao-geral`}>
                  {studyTitle}
                </Link>
                <span aria-hidden="true">/</span>
                <span className="breadcrumb-current">
                  {currentItem ? t(currentItem.key) : null}
                </span>
              </>
            ) : (
              <span className="breadcrumb-current">{t('breadcrumb.studies')}</span>
            )}
          </nav>

          {isAdmin ? (
            <span className="realtime-badge realtime-badge-admin">
              <ShieldCheckIcon width={16} height={16} />
              {t('topbar.totp')}
            </span>
          ) : (
            <span className="realtime-badge">
              <span className="status-dot" aria-hidden="true" />
              {t('topbar.realtime')}
            </span>
          )}
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
