import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { t } from '../i18n'
import { useAuth } from './useAuth'

export default function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div
        style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}
        aria-busy="true"
      >
        {t('auth.loading')}
      </div>
    )
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }

  if (user.must_change_password && location.pathname !== '/conta/palavra-passe') {
    return <Navigate to="/conta/palavra-passe" replace />
  }

  if (admin && user.role !== 'admin') {
    return <Navigate to="/estudos" replace />
  }

  return <Outlet />
}
