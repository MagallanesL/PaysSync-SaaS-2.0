import { Navigate, Route, Routes } from "react-router-dom";
import { AcademyOnly, NoMembershipOnly, RootOnly } from "./components/auth/RouteGuards";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./contexts/AuthContext";
import { AcademyDashboardPage } from "./pages/app/AcademyDashboardPage";
import { DebtPage } from "./pages/app/DebtPage";
import { FeesPage } from "./pages/app/FeesPage";
import { PaymentsPage } from "./pages/app/PaymentsPage";
import { SettingsPage } from "./pages/app/SettingsPage";
import { StudentsPage } from "./pages/app/StudentsPage";
import { UsersPage } from "./pages/app/UsersPage";
import { LoginPage } from "./pages/LoginPage";
import { NoMembershipPage } from "./pages/NoMembershipPage";
import { RootDashboardPage } from "./pages/root/RootDashboardPage";

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
        <Route path="fees" element={<FeesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="debt" element={<DebtPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
