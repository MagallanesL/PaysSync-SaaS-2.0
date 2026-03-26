import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AcademyOnly, NoMembershipOnly, RootOnly } from "./components/auth/RouteGuards";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./contexts/AuthContext";

const LoginPage = lazy(async () => {
  const module = await import("./pages/LoginPage");
  return { default: module.LoginPage };
});
const NoMembershipPage = lazy(async () => {
  const module = await import("./pages/NoMembershipPage");
  return { default: module.NoMembershipPage };
});
const RootDashboardPage = lazy(async () => {
  const module = await import("./pages/root/RootDashboardPage");
  return { default: module.RootDashboardPage };
});
const AcademyDashboardPage = lazy(async () => {
  const module = await import("./pages/app/AcademyDashboardPage");
  return { default: module.AcademyDashboardPage };
});
const StudentsPage = lazy(async () => {
  const module = await import("./pages/app/StudentsPage");
  return { default: module.StudentsPage };
});
const DisciplinesPage = lazy(async () => {
  const module = await import("./pages/app/DisciplinesPage");
  return { default: module.DisciplinesPage };
});
const FeesPage = lazy(async () => {
  const module = await import("./pages/app/FeesPage");
  return { default: module.FeesPage };
});
const UsersPage = lazy(async () => {
  const module = await import("./pages/app/UsersPage");
  return { default: module.UsersPage };
});
const SettingsPage = lazy(async () => {
  const module = await import("./pages/app/SettingsPage");
  return { default: module.SettingsPage };
});

function IndexRedirect() {
  const { loading, firebaseUser, isRoot, membership } = useAuth();
  if (loading) return null;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (isRoot) return <Navigate to="/root/dashboard" replace />;
  if (membership) return <Navigate to="/app/dashboard" replace />;
  return <Navigate to="/no-membership" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/root" element={<Navigate to="/root/dashboard" replace />} />
        <Route
          path="/no-membership"
          element={
            <NoMembershipOnly>
              <NoMembershipPage />
            </NoMembershipOnly>
          }
        />
        <Route
          path="/root/dashboard"
          element={
            <RootOnly>
              <RootDashboardPage />
            </RootOnly>
          }
        />
        <Route
          path="/app"
          element={
            <AcademyOnly>
              <AppShell />
            </AcademyOnly>
          }
        >
          <Route path="dashboard" element={<AcademyDashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="disciplinas" element={<DisciplinesPage />} />
          <Route path="disciplines" element={<Navigate to="/app/disciplinas" replace />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="payments" element={<Navigate to="/app/fees" replace />} />
          <Route path="debt" element={<Navigate to="/app/fees" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-center text-sm text-muted">
      Cargando modulo...
    </div>
  );
}
