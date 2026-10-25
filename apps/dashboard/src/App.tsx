import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import TotpPage from './auth/TotpPage'
import AppLayout from './layout/AppLayout'
import ActivitiesListPage from './pages/activities/ActivitiesListPage'
import ActivityEditPage from './pages/activities/ActivityEditPage'
import StudySettingsPage from './pages/activities/StudySettingsPage'
import AdminAccountNewPage from './pages/admin/AdminAccountNewPage'
import AdminAccountsPage from './pages/admin/AdminAccountsPage'
import AdminAuditPage from './pages/admin/AdminAuditPage'
import AdminErasurePage from './pages/admin/AdminErasurePage'
import AdminPoolPage from './pages/admin/AdminPoolPage'
import AdminStudiesPage from './pages/admin/AdminStudiesPage'
import EntriesPage from './pages/entries/EntriesPage'
import EntriesTimelinePage from './pages/entries/EntriesTimelinePage'
import ExportPage from './pages/entries/ExportPage'
import InviteCodeNewPage from './pages/participants/InviteCodeNewPage'
import InviteCodesPage from './pages/participants/InviteCodesPage'
import ParticipantAddPage from './pages/participants/ParticipantAddPage'
import ParticipantDetailPage from './pages/participants/ParticipantDetailPage'
import ParticipantsPage from './pages/participants/ParticipantsPage'
import PosterPage from './pages/participants/PosterPage'
import RecruitPage from './pages/participants/RecruitPage'
import SignInPage from './pages/SignInPage'
import StudiesListPage from './pages/studies/StudiesListPage'
import StudyNewPage from './pages/studies/StudyNewPage'
import StudyOverviewPage from './pages/studies/StudyOverviewPage'
import StudyPlanPage from './pages/studies/StudyPlanPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/estudos" replace />} />
      <Route path="/entrar" element={<SignInPage />} />
      <Route path="/entrar/codigo" element={<TotpPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/estudos" element={<AppLayout />}>
          <Route index element={<StudiesListPage />} />
          <Route path="novo" element={<StudyNewPage />} />
        </Route>

        <Route path="/estudos/:studyId" element={<AppLayout />}>
          <Route index element={<Navigate to="visao-geral" replace />} />
          <Route path="visao-geral" element={<StudyOverviewPage />} />
          <Route path="plano" element={<StudyPlanPage />} />
          <Route path="atividades" element={<ActivitiesListPage />} />
          <Route path="atividades/nova" element={<ActivityEditPage />} />
          <Route path="atividades/:activityId" element={<ActivityEditPage />} />
          <Route path="participantes" element={<ParticipantsPage />} />
          <Route path="participantes/adicionar" element={<ParticipantAddPage />} />
          <Route path="participantes/codigos" element={<InviteCodesPage />} />
          <Route path="participantes/codigos/novo" element={<InviteCodeNewPage />} />
          <Route path="participantes/codigos/cartaz" element={<PosterPage />} />
          <Route path="participantes/convidar" element={<RecruitPage />} />
          <Route path="participantes/:participantId" element={<ParticipantDetailPage />} />
          <Route path="registos" element={<EntriesPage />} />
          <Route path="registos/linha-do-tempo" element={<EntriesTimelinePage />} />
          <Route path="exportar" element={<ExportPage />} />
          <Route path="definicoes" element={<StudySettingsPage />} />
        </Route>

        <Route element={<RequireAuth admin />}>
          <Route path="/admin" element={<AppLayout />}>
            <Route index element={<Navigate to="contas" replace />} />
            <Route path="contas" element={<AdminAccountsPage />} />
            <Route path="contas/nova" element={<AdminAccountNewPage />} />
            <Route path="estudos" element={<AdminStudiesPage />} />
            <Route path="bolsa-de-voluntarios" element={<AdminPoolPage />} />
            <Route path="auditoria" element={<AdminAuditPage />} />
            <Route path="pedidos-de-apagamento" element={<AdminErasurePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/estudos" replace />} />
    </Routes>
  )
}
