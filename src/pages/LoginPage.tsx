import { Navigate } from "react-router-dom";
import { AuthEntryPanel } from "../components/auth/AuthEntryPanel";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { firebaseUser, isRoot, membership, loading, isPreviewMode } = useAuth();

  if (isPreviewMode) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (!loading && firebaseUser) {
    if (isRoot) return <Navigate to="/root/dashboard" replace />;
    if (membership) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/no-membership" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-text">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(0,194,255,0.2),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(34,197,94,0.15),transparent_35%)]" />
      <div className="z-10 w-full">
        <AuthEntryPanel initialMode="login" />
      </div>
    </div>
  );
}
