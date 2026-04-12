import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { formatAcademyRole } from "../../lib/display";
import { db } from "../../lib/firebase";
import type { Academy } from "../../lib/types";

const navItems = [
  { to: "/app/dashboard", label: "Resumen" },
  { to: "/app/students", label: "Alumnos" },
  { to: "/app/disciplinas", label: "Disciplinas" },
  { to: "/app/fees", label: "Cuotas" },
  { to: "/app/settings", label: "Configuracion" }
];

type AcademyShellInfo = Pick<Academy, "status" | "subscription">;

function toMillis(value: unknown) {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

function formatDate(value: unknown) {
  const millis = toMillis(value);
  if (!millis) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(millis));
}

export function AppShell() {
  const { membership, profile, logout } = useAuth();
  const [academyInfo, setAcademyInfo] = useState<AcademyShellInfo | null>(null);

  useEffect(() => {
    async function loadAcademyInfo() {
      if (!membership) {
        setAcademyInfo(null);
        return;
      }

      const academySnap = await getDoc(doc(db, "academies", membership.academyId));
      if (!academySnap.exists()) {
        setAcademyInfo(null);
        return;
      }

      setAcademyInfo(academySnap.data() as AcademyShellInfo);
    }

    void loadAcademyInfo();
  }, [membership]);

  const subscriptionBadge = useMemo(() => {
    if (!academyInfo) return null;

    if (academyInfo.status === "trial") {
      return {
        label: "Version de prueba",
        detail: "Activa un plan para habilitar tu primer mes completo.",
        className: "border-warning/40 bg-warning/10 text-warning"
      };
    }

    if (academyInfo.subscription?.pendingPlan) {
      return {
        label: "Pago en revision",
        detail: "Estamos esperando la acreditacion del plan.",
        className: "border-warning/40 bg-warning/10 text-warning"
      };
    }

    if (academyInfo.subscription?.billingStatus === "paid") {
      const renewsAtLabel = formatDate(academyInfo.subscription?.renewsAt);
      return {
        label: renewsAtLabel ? `Plan activo hasta ${renewsAtLabel}` : "Plan activo",
        detail: "Cada pago habilita 1 mes de suscripcion para el centro.",
        className: "border-secondary/40 bg-secondary/10 text-secondary"
      };
    }

    return {
      label: "Sin plan activo",
      detail: "Todavia no hay una suscripcion mensual confirmada.",
      className: "border-danger/40 bg-danger/10 text-danger"
    };
  }, [academyInfo]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F1A] text-[#F5F7FB]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 md:gap-4 md:px-6 md:py-4 md:flex-row">
        <aside className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] p-3 shadow-soft md:w-64 md:shrink-0 md:p-4">
          <div className="flex items-center justify-between gap-3 md:block">
            <div className="min-w-0">
              <p className="font-display text-lg text-[#00D1FF] md:text-xl">PaySync</p>
              <p className="mt-1 truncate text-[11px] text-[#9FB0D0] md:text-xs">{membership?.academyName ?? "Centro"}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-brand border border-[rgba(0,209,255,0.15)] px-3 py-2 text-[11px] text-[#9FB0D0] transition hover:border-[#00D1FF] hover:text-[#00D1FF] md:hidden"
            >
              Salir
            </button>
          </div>

          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-5 md:grid-cols-1 md:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center justify-center rounded-brand border px-3 py-2 text-center text-sm transition md:justify-start md:text-left ${
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
          <header className="mb-3 flex flex-col gap-3 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between md:mb-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">{membership?.academyName ?? "Centro"}</p>
              <p className="mt-1 text-sm break-words text-[#F5F7FB]">
                {profile?.displayName} | <span className="uppercase text-[#00D1FF]">{formatAcademyRole(membership?.role ?? "viewer")}</span>
              </p>
              {subscriptionBadge ? (
                <div className={`mt-3 inline-flex max-w-full flex-col rounded-brand border px-3 py-2 text-left ${subscriptionBadge.className}`}>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">{subscriptionBadge.label}</span>
                  <span className="mt-1 text-xs text-[#C9D3EA]">{subscriptionBadge.detail}</span>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => void logout()}
              className="hidden rounded-brand border border-[rgba(0,209,255,0.15)] px-3 py-2 text-xs text-[#9FB0D0] transition hover:border-[#00D1FF] hover:text-[#00D1FF] sm:w-auto md:inline-flex"
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
