import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db, functions } from "../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanDescription,
  getPlanHighlight,
  getPlanLabel,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../lib/plans";
import type { Academy, AcademyPlan } from "../lib/types";

type GateAcademyInfo = Pick<Academy, "name" | "plan" | "status" | "subscription" | "trial">;

type CreateCheckoutResult = {
  checkoutSessionId: string;
  preferenceId: string | null;
  initPoint: string;
  plan: AcademyPlan;
  amount: number;
  reused?: boolean;
};

const PLAN_FEATURES: Record<AcademyPlan, string[]> = {
  basic: ["Seguimiento de alumnos y cuotas", "Base simple para organizar el centro", "Operacion diaria ordenada"],
  pro: ["Mas capacidad para crecer", "Mejor control operativo", "Pensado para academias activas"],
  premium: ["Escala para equipos grandes", "Mayor amplitud de uso", "Ideal para volumen alto"]
};

function formatDate(millis: number | null) {
  if (!millis) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(millis));
}

export function SubscriptionGatePage() {
  const { membership, academyAccess, profile, logout } = useAuth();
  const [academy, setAcademy] = useState<GateAcademyInfo | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<AcademyPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const createMercadoPagoCheckout = useMemo(
    () =>
      httpsCallable<
        {
          academyId: string;
          plan: AcademyPlan;
          origin: string;
        },
        CreateCheckoutResult
      >(functions, "createMercadoPagoCheckout"),
    []
  );

  useEffect(() => {
    async function loadGateData() {
      if (!membership) {
        setAcademy(null);
        return;
      }

      const [academySnap, configSnap] = await Promise.all([
        getDoc(doc(db, "academies", membership.academyId)),
        getDoc(doc(db, "platform", "config"))
      ]);

      if (academySnap.exists()) {
        setAcademy(academySnap.data() as GateAcademyInfo);
      }

      setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }

    void loadGateData();
  }, [membership]);

  async function handlePlanCheckout(plan: AcademyPlan) {
    if (!membership || membership.role !== "owner") {
      setCheckoutError("Solo el owner puede contratar o renovar el plan del centro.");
      return;
    }
    if (typeof window === "undefined") return;

    setCheckoutError(null);
    setCheckoutLoadingPlan(plan);

    try {
      const result = await createMercadoPagoCheckout({
        academyId: membership.academyId,
        plan,
        origin: window.location.origin
      });

      const initPoint = result.data.initPoint?.trim();
      if (!initPoint) {
        throw new Error("Mercado Pago no devolvio una URL valida para continuar.");
      }

      window.location.assign(initPoint);
    } catch (error) {
      const firebaseMessage =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : null;
      setCheckoutError(
        firebaseMessage || (error instanceof Error ? error.message : "No se pudo iniciar el checkout del plan.")
      );
    } finally {
      setCheckoutLoadingPlan(null);
    }
  }

  const title =
    academyAccess?.blockedVariant === "trial"
      ? "Tu periodo de prueba finalizo"
      : academyAccess?.blockedVariant === "renewal"
        ? "Tu suscripcion esta vencida"
        : "Tu centro no tiene acceso habilitado";

  const detail =
    academyAccess?.blockedVariant === "trial"
      ? "Para seguir usando PaySync necesitas contratar un plan. Mientras tanto, el acceso al contenido y a los modulos internos queda bloqueado."
      : academyAccess?.blockedVariant === "renewal"
        ? "La suscripcion ya supero la gracia de 2 dias. Renueva tu plan para volver a entrar con normalidad."
        : "Necesitas regularizar el estado del centro para volver a entrar.";

  const helper =
    academyAccess?.state === "trial_expired"
      ? `Prueba finalizada${formatDate(academyAccess.trialEndsAtMillis) ? ` el ${formatDate(academyAccess.trialEndsAtMillis)}` : ""}.`
      : academyAccess?.state === "expired"
        ? `Suscripcion vencida${formatDate(academyAccess.renewsAtMillis) ? ` el ${formatDate(academyAccess.renewsAtMillis)}` : ""}.`
        : academyAccess?.state === "blocked"
          ? "El centro esta bloqueado hasta regularizar su acceso."
          : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F1A] px-4 py-6 text-[#F5F7FB] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] p-6 shadow-soft">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-[#00D1FF]">
                {academy?.name ?? membership?.academyName ?? "PaySync"}
              </p>
              <h1 className="mt-3 font-display text-3xl text-[#F5F7FB] sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-[#C9D3EA]">{detail}</p>
              {helper ? (
                <div className="mt-4 inline-flex rounded-brand border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {helper}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-brand border border-[rgba(0,209,255,0.12)] bg-slate-950/20 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9FB0D0]">Usuario</p>
                <p className="mt-1 text-[#F5F7FB]">{profile?.email ?? "Sin email"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9FB0D0]">Accion disponible</p>
                <p className="mt-1 text-[#F5F7FB]">
                  {membership?.role === "owner"
                    ? academyAccess?.blockedVariant === "renewal"
                      ? "Renovar suscripcion"
                      : "Contratar plan"
                    : "Contactar al owner del centro"}
                </p>
              </div>
              <button
                onClick={() => void logout()}
                className="rounded-brand border border-[rgba(0,209,255,0.15)] px-3 py-2 text-xs text-[#9FB0D0] transition hover:border-[#00D1FF] hover:text-[#00D1FF]"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </section>

        {checkoutError ? (
          <div className="rounded-brand border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {checkoutError}
          </div>
        ) : null}

        <section className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] p-5 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">Planes disponibles</p>
              <h2 className="mt-2 font-display text-2xl text-[#F5F7FB]">
                {academyAccess?.blockedVariant === "renewal" ? "Renueva o cambia tu plan" : "Activa tu primer plan"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[#C9D3EA]">
                Reutilizamos el mismo flujo de pago actual de PaySync para que puedas regularizar el centro sin salir de la experiencia.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {(["basic", "pro", "premium"] as const).map((plan) => {
              const isCurrent = plan === academy?.plan;
              const isLoading = checkoutLoadingPlan === plan;
              const isOwner = membership?.role === "owner";
              const actionLabel =
                academyAccess?.blockedVariant === "renewal" && isCurrent
                  ? "Renovar este plan"
                  : isCurrent
                    ? "Contratar este plan"
                    : "Elegir y contratar";

              return (
                <div
                  key={plan}
                  className={`rounded-brand border p-4 ${
                    isCurrent
                      ? "border-[rgba(0,209,255,0.35)] bg-[rgba(0,209,255,0.08)]"
                      : "border-[rgba(255,255,255,0.08)] bg-slate-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-lg font-semibold ${isCurrent ? "text-[#00D1FF]" : "text-[#F5F7FB]"}`}>
                        {getPlanLabel(platformConfig, plan)}
                      </p>
                      <p className="mt-2 text-sm text-[#C9D3EA]">{getPlanDescription(platformConfig, plan)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-[#41E2BA]">${getPlanPrice(platformConfig, plan)}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#9FB0D0]">por mes</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-brand border border-[rgba(255,255,255,0.08)] bg-[#0B0F1A] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#9FB0D0]">
                    {getPlanHighlight(platformConfig, plan)}
                  </div>

                  <ul className="mt-4 grid gap-2 text-sm text-[#C9D3EA]">
                    {PLAN_FEATURES[plan].map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#00D1FF]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={!isOwner || isLoading}
                    onClick={() => void handlePlanCheckout(plan)}
                    className={`mt-5 inline-flex w-full items-center justify-center rounded-brand px-3 py-2 text-xs font-semibold transition ${
                      isOwner
                        ? "bg-[#00D1FF] text-[#0B0F1A] hover:brightness-110"
                        : "cursor-not-allowed border border-slate-700 text-[#9FB0D0]"
                    }`}
                  >
                    {isLoading ? "Redirigiendo..." : actionLabel}
                  </button>
                </div>
              );
            })}
          </div>

          {membership?.role !== "owner" ? (
            <div className="mt-4 rounded-brand border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Solo el owner puede contratar o renovar el plan. Pidele que ingrese con su usuario para completar el pago.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
