import { Navigate, Outlet } from 'react-router-dom'
import { t } from '../i18n'
import { useAuth } from './useAuth'

export default function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { status, user } = useAuth()

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
    return <Navigate to="/entrar" replace />
  }

  if (admin && user.role !== 'admin') {
    return <Navigate to="/estudos" replace />
  }

  return <Outlet />
}
