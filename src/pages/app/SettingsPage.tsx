import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { formatMembershipStatus } from "../../lib/display";
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
import type { Academy } from "../../lib/types";

type AcademySettings = Pick<Academy, "name" | "slug" | "plan" | "status" | "planLimits" | "trial" | "createdAt">;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

export function SettingsPage() {
  const { membership, isPreviewMode } = useAuth();
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

  useEffect(() => {
    async function loadSettings() {
      if (isPreviewMode) {
        setSettings({
          name: "Centro Demo",
          slug: "academia-demo",
          plan: "pro",
          status: "active",
          planLimits: {
            maxStudents: 100
          }
        });
        setPlatformConfig(DEFAULT_PLATFORM_CONFIG);
        return;
      }
      if (!membership) return;
      const [academySnap, configSnap] = await Promise.all([
        getDoc(doc(db, "academies", membership.academyId)),
        getDoc(doc(db, "platform", "config"))
      ]);
      if (academySnap.exists()) {
        setSettings(academySnap.data() as AcademySettings);
      }
      setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }
    void loadSettings();
  }, [isPreviewMode, membership]);

  if (!settings) {
    return <p className="text-sm text-muted">Cargando configuracion...</p>;
  }

  const trialSummary = settings.status === "trial" ? getTrialSummary(settings, platformConfig.trialDurationDays) : null;

  return (
    <div className="grid gap-4">
      <Panel title="Configuracion">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-brand border border-slate-700 bg-bg p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Organizacion</p>
            <h2 className="mt-2 font-display text-2xl text-text">{settings.name}</h2>
            <p className="mt-1 text-sm text-muted">Slug: {settings.slug}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InfoCard label="Plan actual" value={getPlanLabel(platformConfig, settings.plan)} accent="text-primary" />
              <InfoCard
                label="Capacidad"
                value={getPlanLimit(platformConfig, settings.plan) === null ? "Ilimitado" : String(getPlanLimit(platformConfig, settings.plan) ?? "-")}
                accent="text-secondary"
              />
              <InfoCard label="Estado" value={formatMembershipStatus(settings.status)} accent="text-warning" />
            </div>

            <div className="mt-4 rounded-brand border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-wide text-primary">Resumen del plan</p>
              <p className="mt-2 text-lg font-semibold text-text">{getPlanLabel(platformConfig, settings.plan)}</p>
              <p className="mt-1 text-sm text-muted">{getPlanDescription(platformConfig, settings.plan)}</p>
              <p className="mt-3 text-sm text-secondary">{getPlanHighlight(platformConfig, settings.plan)}</p>
            </div>

            {trialSummary && (
              <div className="mt-4 rounded-brand border border-warning/30 bg-warning/10 p-4">
                <p className="text-xs uppercase tracking-wide text-warning">Modo prueba</p>
                <p className={`mt-2 text-lg font-semibold ${trialSummary.accent}`}>{trialSummary.title}</p>
                <p className="mt-1 text-sm text-muted">{trialSummary.detail}</p>
              </div>
            )}
          </div>

          <div className="rounded-brand border border-slate-700 bg-bg p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Cambiar plan</p>
            <p className="mt-2 text-sm text-muted">
              De momento esto es visual. Sirve para validar como se veria el selector de plan antes de conectar la logica real.
            </p>

            <div className="mt-4 grid gap-3">
              {(["basic", "pro", "premium"] as const).map((plan) => {
                const isCurrent = plan === settings.plan;
                return (
                  <div
                    key={plan}
                    className={`rounded-brand border p-4 transition ${
                      isCurrent ? "border-primary bg-primary/10" : "border-slate-700 bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : "text-text"}`}>
                          {getPlanLabel(platformConfig, plan)}
                        </p>
                        <p className="mt-1 text-xs text-muted">{getPlanDescription(platformConfig, plan)}</p>
                      </div>
                      <span className="text-sm font-medium text-secondary">${getPlanPrice(platformConfig, plan)}/mes</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted">{getPlanHighlight(platformConfig, plan)}</span>
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
          </div>
        </div>
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
    <div className="rounded-brand border border-slate-700 bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
