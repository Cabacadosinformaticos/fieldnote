import type { ComponentType, SVGProps } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import {
  ActivitiesIcon,
  ChevronRightIcon,
  EntriesIcon,
  ErasureIcon,
  ExportIcon,
  FolderIcon,
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

export type AppRole = 'researcher' | 'admin'

type NavItem = {
  key: TranslationKey
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const DEMO_STUDY_ID = 'jardim-da-estrela'

const adminNav: NavItem[] = [
  { key: 'nav.admin.accounts', to: '/admin/contas', icon: ParticipantsIcon },
  { key: 'nav.admin.studies', to: '/admin/estudos', icon: FolderIcon },
  { key: 'nav.admin.pool', to: '/admin/bolsa-de-voluntarios', icon: PoolIcon },
  { key: 'nav.admin.audit', to: '/admin/auditoria', icon: ShieldCheckIcon },
  { key: 'nav.admin.erasure', to: '/admin/pedidos-de-apagamento', icon: ErasureIcon },
]

export default function AppLayout({ role = 'researcher' }: { role?: AppRole }) {
  const location = useLocation()
  const params = useParams<{ studyId?: string }>()
  const studyId = params.studyId ?? DEMO_STUDY_ID

  const researcherNav: NavItem[] = [
    { key: 'nav.overview', to: `/estudos/${studyId}/visao-geral`, icon: OverviewIcon },
    { key: 'nav.plan', to: `/estudos/${studyId}/plano`, icon: PlanIcon },
    { key: 'nav.activities', to: `/estudos/${studyId}/atividades`, icon: ActivitiesIcon },
    { key: 'nav.participants', to: `/estudos/${studyId}/participantes`, icon: ParticipantsIcon },
    { key: 'nav.entries', to: `/estudos/${studyId}/registos`, icon: EntriesIcon },
    { key: 'nav.export', to: `/estudos/${studyId}/exportar`, icon: ExportIcon },
    { key: 'nav.settings', to: `/estudos/${studyId}/definicoes`, icon: SettingsIcon },
  ]

  const isAdmin = role === 'admin'
  const navItems = isAdmin ? adminNav : researcherNav
  const currentItem = navItems.find((item) => item.to === location.pathname)
  const isStudiesIndex = location.pathname === '/estudos'

  const user = isAdmin
    ? { name: t('user.admin.name'), role: t('user.admin.role'), initials: 'CN' }
    : { name: t('user.researcher.name'), role: t('user.researcher.role'), initials: 'IM' }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <LogoMark />
            <span className="brand-name">{t('app.name')}</span>
          </div>

          {!isAdmin ? (
            <Link
              className="study-switcher"
              to="/estudos"
              aria-label={t('study.switcherAria', {
                study: t('study.demoTitle'),
                status: t('study.status.ongoing'),
              })}
            >
              <span className="study-switcher-text">
                <span className="study-switcher-label">{t('study.switcherLabel')}</span>
                <span className="study-switcher-name">{t('study.demoTitle')}</span>
                <span className="study-status-pill">
                  <span className="status-dot" aria-hidden="true" />
                  {t('study.status.ongoing')}
                </span>
              </span>
              <UpDownIcon />
            </Link>
          ) : null}

          <nav
            className="sidebar-nav"
            aria-label={isAdmin ? t('nav.administration') : t('nav.studySections')}
          >
            {isAdmin ? <span className="sidebar-nav-label">{t('nav.administration')}</span> : null}
            {navItems.map((item) => {
              const Icon = item.icon
              const active = item.to === location.pathname

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
                </Link>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <div className={isAdmin ? 'user-card user-card-admin' : 'user-card'}>
              <span className="user-avatar">{user.initials}</span>
              <span className="user-meta">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </span>
            </div>
            <nav className="sidebar-nav" aria-label={t('nav.account')}>
              <Link className="nav-link" to="/entrar">
                <SignOutIcon width={isAdmin ? 18 : 20} height={isAdmin ? 18 : 20} />
                <span className="nav-link-text">{t('nav.signOut')}</span>
              </Link>
            </nav>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <nav className="breadcrumb" aria-label={t('breadcrumb.label')}>
            {isAdmin ? (
              <>
                <span>{t('nav.administration')}</span>
                <ChevronRightIcon width={14} height={14} />
                <span className="breadcrumb-current">
                  {currentItem ? t(currentItem.key) : null}
                </span>
              </>
            ) : isStudiesIndex ? (
              <span className="breadcrumb-current">{t('breadcrumb.studies')}</span>
            ) : (
              <>
                <Link className="breadcrumb-link" to="/estudos">
                  {t('breadcrumb.studies')}
                </Link>
                <span aria-hidden="true">/</span>
                <Link className="breadcrumb-link" to={`/estudos/${studyId}/visao-geral`}>
                  {t('study.demoTitle')}
                </Link>
                <span aria-hidden="true">/</span>
                <span className="breadcrumb-current">
                  {currentItem ? t(currentItem.key) : null}
                </span>
              </>
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
