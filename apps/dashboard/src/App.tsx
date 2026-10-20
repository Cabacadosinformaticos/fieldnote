import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PlaceholderPage from './pages/PlaceholderPage'
import SignInPage from './pages/SignInPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/entrar" replace />} />
      <Route path="/entrar" element={<SignInPage />} />

      <Route path="/estudos" element={<AppLayout />}>
        <Route index element={<PlaceholderPage titleKey="pages.studies.title" />} />
      </Route>

      <Route path="/estudos/:studyId" element={<AppLayout />}>
        <Route index element={<Navigate to="visao-geral" replace />} />
        <Route path="visao-geral" element={<PlaceholderPage titleKey="pages.overview.title" />} />
        <Route path="plano" element={<PlaceholderPage titleKey="pages.plan.title" />} />
        <Route path="atividades" element={<PlaceholderPage titleKey="pages.activities.title" />} />
        <Route
          path="participantes"
          element={<PlaceholderPage titleKey="pages.participants.title" />}
        />
        <Route path="registos" element={<PlaceholderPage titleKey="pages.entries.title" />} />
        <Route path="exportar" element={<PlaceholderPage titleKey="pages.export.title" />} />
        <Route path="definicoes" element={<PlaceholderPage titleKey="pages.settings.title" />} />
      </Route>

      <Route path="/admin" element={<AppLayout role="admin" />}>
        <Route index element={<Navigate to="contas" replace />} />
        <Route path="contas" element={<PlaceholderPage titleKey="pages.admin.accounts.title" />} />
        <Route path="estudos" element={<PlaceholderPage titleKey="pages.admin.studies.title" />} />
        <Route
          path="bolsa-de-voluntarios"
          element={<PlaceholderPage titleKey="pages.admin.pool.title" />}
        />
        <Route path="auditoria" element={<PlaceholderPage titleKey="pages.admin.audit.title" />} />
        <Route
          path="pedidos-de-apagamento"
          element={<PlaceholderPage titleKey="pages.admin.erasure.title" />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/entrar" replace />} />
    </Routes>
  )
}
