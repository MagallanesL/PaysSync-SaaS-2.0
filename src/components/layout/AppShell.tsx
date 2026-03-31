import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { formatAcademyRole } from "../../lib/display";

const navItems = [
  { to: "/app/dashboard", label: "Resumen" },
  { to: "/app/students", label: "Alumnos" },
  { to: "/app/disciplinas", label: "Disciplinas" },
  { to: "/app/fees", label: "Cuotas" },
  { to: "/app/settings", label: "Configuracion" }
];

export function AppShell() {
  const { membership, profile, logout } = useAuth();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F1A] text-[#F5F7FB]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-4 md:flex-row md:px-6">
        <aside className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] p-4 shadow-soft md:w-64 md:shrink-0">
          <p className="font-display text-xl text-[#00D1FF]">PaySync</p>
          <p className="mt-1 text-xs text-[#9FB0D0]">{membership?.academyName ?? "Centro"}</p>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 md:grid md:gap-2 md:overflow-visible md:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap rounded-brand border px-3 py-2.5 text-sm transition md:shrink md:whitespace-normal ${
                    isActive
                      ? "border-[rgba(0,209,255,0.28)] bg-[rgba(0,209,255,0.12)] text-[#00D1FF] shadow-[0_0_18px_rgba(0,209,255,0.12)]"
                      : "border-transparent text-[#9FB0D0] hover:border-[rgba(0,209,255,0.12)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#F5F7FB]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-4 flex flex-col gap-3 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">{membership?.academyName ?? "Centro"}</p>
              <p className="mt-1 text-sm break-words text-[#F5F7FB]">
                {profile?.displayName} | <span className="uppercase text-[#00D1FF]">{formatAcademyRole(membership?.role ?? "viewer")}</span>
              </p>
            </div>
            <button
              onClick={() => void logout()}
              className="w-full rounded-brand border border-[rgba(0,209,255,0.15)] px-3 py-2 text-xs text-[#9FB0D0] transition hover:border-[#00D1FF] hover:text-[#00D1FF] sm:w-auto"
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
