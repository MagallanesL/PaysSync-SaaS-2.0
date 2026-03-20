import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/app/dashboard", label: "Resumen" },
  { to: "/app/students", label: "Alumnos" },
  { to: "/app/fees", label: "Cuotas" },
  { to: "/app/payments", label: "Pagos" },
  { to: "/app/debt", label: "Morosidad" },
  { to: "/app/users", label: "Equipo" },
  { to: "/app/settings", label: "Academia" }
];

export function AppShell() {
  const { membership, profile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:px-6">
        <aside className="rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft md:w-64">
          <p className="font-display text-xl text-primary">PaySync</p>
          <p className="mt-1 text-xs text-muted">{membership?.academyName ?? "Academy"}</p>
          <nav className="mt-5 grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-brand px-3 py-2 text-sm transition ${
                    isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-slate-700/40 hover:text-text"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <header className="mb-4 flex items-center justify-between rounded-brand border border-slate-700/80 bg-surface px-4 py-3 shadow-soft">
            <div>
              <p className="text-sm text-muted">Academy panel</p>
              <p className="text-sm">
                {profile?.displayName} · <span className="uppercase text-primary">{membership?.role}</span>
              </p>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary"
            >
              Cerrar sesion
            </button>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
