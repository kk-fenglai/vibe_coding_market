import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import PageLoader from './components/PageLoader';
import { useAuthStore } from './stores/auth';

const AdminLayout = lazy(() => import('./components/AdminLayout'));
const RequireAdmin = lazy(() => import('./components/RequireAdmin'));

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerificationSent = lazy(() => import('./pages/VerificationSent'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminLoginHistory = lazy(() => import('./pages/admin/AdminLoginHistory'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminChangePassword = lazy(() => import('./pages/admin/AdminChangePassword'));

// ↓↓↓ BuilderHub marketplace 页面 —— 后续阶段在此追加 lazy import ↓↓↓
const Marketplace = lazy(() => import('./pages/projects/Marketplace'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const PostProject = lazy(() => import('./pages/projects/PostProject'));
const MyProjects = lazy(() => import('./pages/projects/MyProjects'));
const MyApplications = lazy(() => import('./pages/projects/MyApplications'));
const BuilderProfile = lazy(() => import('./pages/BuilderProfile'));
const BuilderPublicProfile = lazy(() => import('./pages/BuilderPublicProfile'));
const Messages = lazy(() => import('./pages/Messages'));
const Wallet = lazy(() => import('./pages/Wallet'));
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'));
const AdminBuilders = lazy(() => import('./pages/admin/AdminBuilders'));
const AdminDisputes = lazy(() => import('./pages/admin/AdminDisputes'));
// ↑↑↑ BuilderHub 页面结束 ↑↑↑

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    if (localStorage.getItem('accessToken')) fetchMe();
  }, [fetchMe]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* --- Admin routes (separate layout, no top-bar) --- */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="change-password" element={<AdminChangePassword />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="logins" element={<AdminLoginHistory />} />
          <Route path="feedback" element={<AdminFeedback />} />
          {/* ↓ BuilderHub 后台路由 —— 后续阶段在此追加 ↓ */}
          <Route path="projects" element={<AdminProjects />} />
          <Route path="builders" element={<AdminBuilders />} />
          <Route path="disputes" element={<AdminDisputes />} />
          {/* ↑ BuilderHub 后台路由结束 ↑ */}
        </Route>

        {/* --- Public + user routes --- */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verification-sent" element={<VerificationSent />} />

          {/* ═══ BuilderHub marketplace 路由 —— 后续阶段在此追加 ═══ */}
          <Route path="/projects" element={<Marketplace />} />
          <Route path="/projects/new" element={<RequireAuth><PostProject /></RequireAuth>} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<RequireAuth><PostProject /></RequireAuth>} />
          <Route path="/my/projects" element={<RequireAuth><MyProjects /></RequireAuth>} />
          <Route path="/my/applications" element={<RequireAuth><MyApplications /></RequireAuth>} />
          <Route path="/builder/profile" element={<RequireAuth><BuilderProfile /></RequireAuth>} />
          <Route path="/builders/:id" element={<BuilderPublicProfile />} />
          <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
          {/* ═══ BuilderHub 路由结束 ═══ */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
