import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import SubjectDetail from './pages/SubjectDetail';
import {
  Subjects,
  Materials,
  Notes,
  Agenda,
  Assignments,
  Rooms,
  Notifications,
  ProfessorPanel,
} from './pages/Pages';
import Abnt from './pages/Abnt';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Social from './pages/Social';
import Messages from './pages/Messages';
import Flashcards from './pages/Flashcards';
import Chat from './pages/Chat';
import Boletim from './pages/Boletim';
import SearchPage from './pages/Search';
import Tutor from './pages/Tutor';
import { useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';
function Private() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}
function RequireRole({ role, children }: { role: string; children: ReactElement }) {
  const { user } = useAuth();
  if (!user || user.role !== role) return <Navigate to="/" replace />;
  return children;
}
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/resetar-senha" element={<ResetPassword />} />
            <Route element={<Private />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/busca" element={<SearchPage />} />
              <Route path="/tutor" element={<Tutor />} />
              <Route path="/disciplinas" element={<Subjects />} />
              <Route path="/disciplinas/:id" element={<SubjectDetail />} />
              <Route path="/materiais" element={<Materials />} />
              <Route path="/notas" element={<Notes />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/trabalhos" element={<Assignments />} />
              <Route path="/boletim" element={<Boletim />} />
              <Route path="/salas" element={<Rooms />} />
              <Route path="/abnt" element={<Abnt />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/perfil/:id" element={<UserProfile />} />
              <Route path="/social" element={<Social />} />
              <Route path="/mensagens" element={<Messages />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/forum" element={<Navigate to="/social" replace />} />
              <Route path="/notificacoes" element={<Notifications />} />
              <Route
                path="/professor"
                element={
                  <RequireRole role="PROFESSOR">
                    <ProfessorPanel />
                  </RequireRole>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
