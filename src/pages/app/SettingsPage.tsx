import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanDescription,
  getPlanHighlight,
  getPlanLabel,
  getPlanPrice,
  getPlanLimit,
  normalizePlatformConfig,
  type PlatformConfig
} from "../../lib/plans";
import { getTrialEndsAtMillis } from "../../lib/trial";
import type { Academy, AcademyPlan } from "../../lib/types";

type AcademySettings = Pick<Academy, "name" | "plan" | "status" | "planLimits" | "trial" | "createdAt">;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PLAN_FEATURES: Record<AcademyPlan, string[]> = {
  basic: [
    "Seguimiento centralizado de cuotas",
    "Carga de alumnos y disciplinas",
    "Vista simple para cobros del dia"
  ],
  pro: [
    "Todo lo del Basico",
    "Mayor capacidad para crecer",
    "Mejor control operativo del centro"
  ],
  premium: [
    "Todo lo del Pro",
    "Capacidad alta o ilimitada",
    "Preparado para operaciones mas grandes"
  ]
};

const SUPPORT_PHONE = "5492657716071";

function buildSupportLink(academyName: string, ownerName: string) {
  const message = `Hola, soy ${ownerName} del centro ${academyName}. Necesito soporte tecnico.`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}

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
  if (!millis) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(millis));
}

function getTrialSummary(settings: AcademySettings, trialDurationDays: number) {
  const endsAtMillis = getTrialEndsAtMillis(settings, trialDurationDays);
  if (!endsAtMillis) {
    return {
      title: "Periodo de prueba sin fecha valida",
      detail: "No se pudo calcular el vencimiento del trial.",
      accent: "text-warning"
    };
  }

  const remainingMs = endsAtMillis - Date.now();
  if (remainingMs <= 0) {
    return {
      title: "Trial vencido",
      detail: `Finalizo el ${formatDate(endsAtMillis)}.`,
      accent: "text-danger"
    };
  }

  const remainingDays = Math.ceil(remainingMs / DAY_IN_MS);
  return {
    title: remainingDays === 1 ? "Queda 1 dia de prueba" : `Quedan ${remainingDays} dias de prueba`,
    detail: `Disponible hasta el ${formatDate(endsAtMillis)}.`,
    accent: remainingDays <= 3 ? "text-warning" : "text-secondary"
  };
}

function getPlanTone(plan: AcademyPlan, isCurrent: boolean) {
  if (isCurrent) return "border-primary bg-primary/10";
  if (plan === "premium") return "border-warning/40 bg-warning/5";
  if (plan === "pro") return "border-secondary/40 bg-secondary/5";
  return "border-slate-700 bg-surface";
}

export function SettingsPage() {
  const { membership, profile, isPreviewMode } = useAuth();
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [studentsCount, setStudentsCount] = useState(0);

  useEffect(() => {
    async function loadSettings() {
      if (isPreviewMode) {
        setSettings({
          name: "Centro Demo",
          plan: "pro",
          status: "active",
          planLimits: {
            maxStudents: 100
          }
        });
        setStudentsCount(37);
        setPlatformConfig(DEFAULT_PLATFORM_CONFIG);
        return;
      }
      if (!membership) return;
      const academyPath = `academies/${membership.academyId}`;
      const [academySnap, configSnap, studentsSnap] = await Promise.all([
        getDoc(doc(db, "academies", membership.academyId)),
        getDoc(doc(db, "platform", "config")),
        getDocs(collection(db, `${academyPath}/students`))
      ]);
      if (academySnap.exists()) {
        setSettings(academySnap.data() as AcademySettings);
      }
      setStudentsCount(studentsSnap.size);
      setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }
    void loadSettings();
  }, [isPreviewMode, membership]);

  const usage = useMemo(() => {
    if (!settings) return { limit: null as number | null, usagePercent: 0, usageLabel: "0" };
    const limit = getPlanLimit(platformConfig, settings.plan);
    const usagePercent = limit === null ? 0 : Math.min(100, Math.round((studentsCount / limit) * 100));
    return {
      limit,
      usagePercent,
      usageLabel: limit === null ? `${studentsCount} alumnos activos` : `${studentsCount} de ${limit} alumnos`
    };
  }, [platformConfig, settings, studentsCount]);

  if (!settings) {
    return <p className="text-sm text-muted">Cargando configuracion...</p>;
  }

  const trialSummary = settings.status === "trial" ? getTrialSummary(settings, platformConfig.trialDurationDays) : null;
  const currentPlanPrice = getPlanPrice(platformConfig, settings.plan);

  return (
    <div className="grid gap-4">
      <Panel title="Configuracion del centro">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <section className="rounded-brand border border-primary/30 bg-gradient-to-br from-primary/15 via-bg to-secondary/10 p-5 shadow-soft">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-primary">Centro activo</p>
                  <h2 className="mt-2 font-display text-3xl text-text">{settings.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted">
                    Tu panel de cuenta muestra plan, capacidad actual y el estado general del centro en un solo lugar.
                  </p>
                </div>
                <div className="rounded-brand border border-slate-700/80 bg-slate-950/40 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Plan actual</p>
                  <p className="mt-1 text-xl font-semibold text-primary">{getPlanLabel(platformConfig, settings.plan)}</p>
                  <p className="mt-1 text-sm text-secondary">${currentPlanPrice}/mes</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoCard label="Capacidad" value={usage.limit === null ? "Ilimitada" : usage.usageLabel} accent="text-secondary" />
                <InfoCard label="Plan activo" value={getPlanLabel(platformConfig, settings.plan)} accent="text-primary" />
                <InfoCard label="Abono mensual" value={`$${currentPlanPrice}`} accent="text-secondary" />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-brand border border-slate-700 bg-bg p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Uso del plan</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-text">{usage.usageLabel}</p>
                    <p className="mt-1 text-sm text-muted">
                      {usage.limit === null
                        ? "Tu plan no tiene limite de alumnos configurado."
                        : "Esto te ayuda a entender cuanto margen real te queda para crecer."}
                    </p>
                  </div>
                  {usage.limit !== null && (
                    <p className={`text-sm font-semibold ${usage.usagePercent >= 85 ? "text-warning" : "text-secondary"}`}>
                      {usage.usagePercent}% usado
                    </p>
                  )}
                </div>

                {usage.limit !== null ? (
                  <div className="mt-4">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usage.usagePercent >= 85 ? "bg-warning" : usage.usagePercent >= 60 ? "bg-primary" : "bg-secondary"
                        }`}
                        style={{ width: `${Math.max(8, usage.usagePercent)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {usage.limit - studentsCount > 0
                        ? `Todavia puedes sumar ${usage.limit - studentsCount} alumnos antes de llegar al limite.`
                        : "Estas en el limite actual del plan."}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-brand border border-secondary/30 bg-secondary/10 px-3 py-3 text-sm text-secondary">
                    Tu capacidad es amplia para seguir creciendo sin preocuparte por el cupo.
                  </div>
                )}
              </div>

              <div className="rounded-brand border border-slate-700 bg-bg p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Estado de cuenta</p>
                <div className="mt-3 grid gap-3">
                  <SignalCard
                    title="Plan contratado"
                    detail={getPlanDescription(platformConfig, settings.plan)}
                    accent="text-primary"
                  />
                  <SignalCard
                    title="Diferencial"
                    detail={getPlanHighlight(platformConfig, settings.plan)}
                    accent="text-secondary"
                  />
                  {trialSummary ? (
                    <SignalCard title={trialSummary.title} detail={trialSummary.detail} accent={trialSummary.accent} />
                  ) : (
                    <SignalCard
                      title="Centro listo para operar"
                      detail="La configuracion principal del centro ya esta activa y disponible para el trabajo diario."
                      accent="text-secondary"
                    />
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="rounded-brand border border-slate-700 bg-bg p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Planes disponibles</p>

            <div className="mt-4 grid gap-3">
              {(["basic", "pro", "premium"] as const).map((plan) => {
                const isCurrent = plan === settings.plan;
                return (
                  <div key={plan} className={`relative rounded-brand border p-4 transition ${getPlanTone(plan, isCurrent)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-base font-semibold ${isCurrent ? "text-primary" : "text-text"}`}>
                          {getPlanLabel(platformConfig, plan)}
                        </p>
                        <p className="mt-1 text-sm text-muted">{getPlanDescription(platformConfig, plan)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-secondary">${getPlanPrice(platformConfig, plan)}</p>
                        <p className="text-xs uppercase tracking-wide text-muted">por mes</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-brand border border-slate-700/70 bg-slate-950/30 px-3 py-2 text-xs uppercase tracking-wide text-muted">
                      {getPlanHighlight(platformConfig, plan)}
                    </div>

                    <ul className="mt-3 grid gap-2 text-sm text-muted">
                      {PLAN_FEATURES[plan].map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted">
                        {plan === "basic"
                          ? "Para centros que arrancan"
                          : plan === "pro"
                            ? "Para crecer con mas orden"
                            : "Para operar con amplitud"}
                      </span>
                      <button
                        type="button"
                        className={`rounded-brand px-3 py-2 text-xs font-semibold ${
                          isCurrent
                            ? "border border-primary/40 bg-primary/15 text-primary"
                            : "bg-primary text-bg hover:brightness-110"
                        }`}
                      >
                        {isCurrent ? "Plan actual" : "Solicitar cambio"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        {(settings.plan === "pro" || settings.plan === "premium") && (
          <a
            href={buildSupportLink(
              settings.name,
              profile?.displayName ?? "Owner"
            )}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir soporte tecnico por WhatsApp"
            className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-secondary/40 bg-secondary text-slate-950 shadow-soft transition hover:scale-105 hover:brightness-110"
            title="Soporte tecnico por WhatsApp"
          >
            <WhatsAppIcon />
          </a>
        )}
      </Panel>
    </div>
  );
}

function InfoCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-brand border border-slate-700 bg-slate-950/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function SignalCard({
  title,
  detail,
  accent
}: {
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded-brand border border-slate-700 bg-surface p-3">
      <p className={`text-sm font-semibold ${accent}`}>{title}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M19.05 4.94A9.9 9.9 0 0 0 12.03 2C6.56 2 2.1 6.46 2.1 11.93c0 1.75.46 3.47 1.34 4.98L2 22l5.24-1.37a9.92 9.92 0 0 0 4.78 1.22h.01c5.47 0 9.93-4.46 9.93-9.93a9.86 9.86 0 0 0-2.91-6.98Zm-7.02 15.23h-.01a8.3 8.3 0 0 1-4.22-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.23 8.23 0 0 1-1.27-4.39c0-4.56 3.71-8.27 8.28-8.27 2.2 0 4.27.85 5.83 2.42a8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.25 8.25Zm4.54-6.19c-.25-.13-1.47-.72-1.7-.8-.23-.09-.39-.13-.56.12-.16.25-.64.79-.78.95-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.36-1.71-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.42h-.48c-.17 0-.43.06-.65.31-.23.25-.87.85-.87 2.07 0 1.22.9 2.39 1.02 2.56.12.17 1.76 2.68 4.25 3.76.59.26 1.06.42 1.42.54.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.17.21-.58.21-1.07.15-1.17-.06-.1-.22-.16-.46-.29Z" />
    </svg>
  );
}
