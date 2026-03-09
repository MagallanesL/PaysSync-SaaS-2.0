import { signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../lib/firebase";

export function LoginPage() {
  const navigate = useNavigate();
  const { firebaseUser, isRoot, membership, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && firebaseUser) {
    if (isRoot) return <Navigate to="/root/dashboard" replace />;
    if (membership) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/no-membership" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(0,194,255,0.2),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(34,197,94,0.15),transparent_35%)]" />
      <form onSubmit={handleSubmit} className="z-10 w-full max-w-md rounded-brand border border-slate-700/80 bg-surface p-6 shadow-soft">
        <h1 className="font-display text-3xl text-primary">PaySync</h1>
        <p className="mt-2 text-sm text-muted">Gestión financiera para academias.</p>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1 text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              required
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
          >
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
      </form>
    </div>
  );
}
