import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { ReactNode } from "react";
import { SubscriptionGatePage } from "../../pages/SubscriptionGatePage";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-text">
      <div className="rounded-brand border border-slate-700/70 bg-surface px-6 py-4 text-sm text-muted">
        Cargando PaySync...
      </div>
    </div>
  );
}

export function RootOnly({ children }: { children: ReactNode }) {
  const { loading, firebaseUser, isRoot, membership } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!firebaseUser) return <Navigate to="/" replace />;
  if (!isRoot) {
    if (membership) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/no-membership" replace />;
  }
  return <>{children}</>;
}

export function AcademyOnly({ children }: { children: ReactNode }) {
  const { loading, firebaseUser, isRoot, membership, academyAccess } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!firebaseUser) return <Navigate to="/" replace />;
  if (isRoot) return <Navigate to="/root/dashboard" replace />;
  if (!membership) return <Navigate to="/no-membership" replace />;
  if (academyAccess && !academyAccess.canAccessApp) return <SubscriptionGatePage />;
  return <>{children}</>;
}

export function NoMembershipOnly({ children }: { children: ReactNode }) {
  const { loading, firebaseUser, isRoot, membership } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!firebaseUser) return <Navigate to="/" replace />;
  if (isRoot) return <Navigate to="/root/dashboard" replace />;
  if (membership) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}
