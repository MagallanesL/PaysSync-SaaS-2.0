import { useAuth } from "../contexts/AuthContext";

export function NoMembershipPage() {
  const { profile, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <div className="w-full max-w-lg rounded-brand border border-warning/40 bg-surface p-6 shadow-soft">
        <h1 className="font-display text-2xl text-warning">Sin membresía activa</h1>
        <p className="mt-3 text-sm text-muted">
          El usuario <span className="text-text">{profile?.email}</span> no tiene acceso activo a ningun centro.
          Contacta al administrador de plataforma para que habilite tu membresía.
        </p>
        <button
          onClick={() => void logout()}
          className="mt-6 rounded-brand border border-slate-600 px-3 py-2 text-sm text-muted hover:border-primary hover:text-primary"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
