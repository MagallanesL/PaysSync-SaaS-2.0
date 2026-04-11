import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import {
  DEFAULT_ACADEMY_BILLING_SETTINGS,
  normalizeAcademyBillingSettings,
  type AcademyBillingSettings
} from "../../lib/fees";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanDescription,
  getPlanHighlight,
  getPlanLabel,
  getPlanLimit,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../../lib/plans";
import { getTrialEndsAtMillis } from "../../lib/trial";
import type { Academy, AcademyPlan } from "../../lib/types";

type AcademySettings = Pick<Academy, "name" | "plan" | "status" | "planLimits" | "trial" | "createdAt" | "billingSettings">;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SUPPORT_PHONE = "5492657716071";

const PLAN_FEATURES: Record<AcademyPlan, string[]> = {
  basic: ["Seguimiento de alumnos y cuotas", "Base simple para empezar", "Operacion diaria liviana"],
  pro: ["Mas capacidad operativa", "Orden para cobros y seguimiento", "Mejor margen para crecer"],
  premium: ["Mayor amplitud de uso", "Escala para centros mas grandes", "Plan pensado para volumen"]
};

function buildSupportLink(academyName: string, ownerName: string, message: string) {
  const text = `Hola, soy ${ownerName} del centro ${academyName}. ${message}`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(text)}`;
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

function getLateFeeLabel(settings: AcademyBillingSettings) {
  if (!settings.lateFeeEnabled || settings.lateFeeValue <= 0) return "Sin recargo automatico";
  const value = settings.lateFeeType === "percent" ? `${settings.lateFeeValue}%` : `$${settings.lateFeeValue}`;
  return `${value} desde ${settings.lateFeeStartsAfterDays} dia${settings.lateFeeStartsAfterDays === 1 ? "" : "s"} de mora`;
}

export function SettingsPage() {
  const { membership, profile, isPreviewMode, canWriteAcademyData } = useAuth();
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [studentsCount, setStudentsCount] = useState(0);
  const [billingForm, setBillingForm] = useState<AcademyBillingSettings>(DEFAULT_ACADEMY_BILLING_SETTINGS);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (isPreviewMode) {
        const previewSettings: AcademySettings = {
          name: "Centro Demo",
          plan: "pro",
          status: "active",
          planLimits: { maxStudents: 100 },
          billingSettings: {
            defaultDueDay: 10,
            lateFeeEnabled: true,
            lateFeeStartsAfterDays: 3,
            lateFeeType: "fixed",
            lateFeeValue: 2500
          }
        };
        setSettings(previewSettings);
        setBillingForm(normalizeAcademyBillingSettings(previewSettings.billingSettings));
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
        const nextSettings = academySnap.data() as AcademySettings;
        setSettings(nextSettings);
        setBillingForm(normalizeAcademyBillingSettings(nextSettings.billingSettings));
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
  const supportBaseLink = buildSupportLink(
    settings.name,
    profile?.displayName ?? "Owner",
    "Necesito ayuda con la configuracion del centro."
  );

  async function handleSaveBillingSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !canWriteAcademyData || isPreviewMode) return;

    const normalizedSettings = normalizeAcademyBillingSettings(billingForm);
    if (normalizedSettings.lateFeeEnabled && normalizedSettings.lateFeeValue <= 0) {
      setSaveFeedback("Define un valor de recargo mayor a 0 para activarlo.");
      window.setTimeout(() => setSaveFeedback(null), 2500);
      return;
    }

    await updateDoc(doc(db, "academies", membership.academyId), {
      billingSettings: normalizedSettings,
      updatedAt: serverTimestamp()
    });

    setBillingForm(normalizedSettings);
    setSettings((prev) => (prev ? { ...prev, billingSettings: normalizedSettings } : prev));
    setSaveFeedback("Configuracion operativa guardada.");
    window.setTimeout(() => setSaveFeedback(null), 2500);
  }

  return (
    <>
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
                      Define como quieres cobrar: dia general de vencimiento, recargos automaticos y reglas base del centro.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPlanModalOpen(true)}
                      className="rounded-brand border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      Gestionar plan
                    </button>
                    <a
                      href={supportBaseLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-brand border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10"
                    >
                      Soporte
                    </a>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InfoCard label="Plan actual" value={getPlanLabel(platformConfig, settings.plan)} accent="text-primary" />
                  <InfoCard label="Capacidad" value={usage.limit === null ? "Ilimitada" : usage.usageLabel} accent="text-secondary" />
                  <InfoCard label="Recargo" value={getLateFeeLabel(billingForm)} accent="text-warning" />
                </div>
              </section>

              <section className="rounded-brand border border-slate-700 bg-bg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Reglas de cobro</p>
                    <h3 className="mt-1 text-lg font-semibold text-text">Como funciona el centro al cobrar</h3>
                    <p className="mt-1 max-w-2xl text-sm text-muted">
                      Estas reglas se usan para definir vencimientos por defecto y calcular recargos automaticamente cuando una cuota sigue impaga.
                    </p>
                  </div>
                  {saveFeedback && <span className="rounded-brand bg-secondary/15 px-3 py-2 text-xs font-semibold text-secondary">{saveFeedback}</span>}
                </div>

                <form onSubmit={(event) => void handleSaveBillingSettings(event)} className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Dia general de vencimiento"
                      type="number"
                      min={1}
                      max={28}
                      value={String(billingForm.defaultDueDay)}
                      disabled={!canWriteAcademyData || isPreviewMode}
                      onChange={(value) =>
                        setBillingForm((prev) => ({
                          ...prev,
                          defaultDueDay: Math.min(28, Math.max(1, Number(value || prev.defaultDueDay)))
                        }))
                      }
                    />
                    <div className="rounded-brand border border-slate-700 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted">Vista previa</p>
                      <p className="mt-2 text-sm text-text">
                        Las cuotas mensuales nuevas venceran el dia <span className="font-semibold text-primary">{billingForm.defaultDueDay}</span> de cada mes.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-brand border border-slate-700 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">Recargo automatico</p>
                        <p className="mt-1 text-sm text-muted">
                          Si esta activo, el sistema suma el recargo solo cuando ya pasaron los dias de mora que definas aqui.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canWriteAcademyData || isPreviewMode}
                        onClick={() =>
                          setBillingForm((prev) => {
                            const nextEnabled = !prev.lateFeeEnabled;
                            return {
                              ...prev,
                              lateFeeEnabled: nextEnabled,
                              lateFeeValue:
                                nextEnabled && prev.lateFeeValue <= 0
                                  ? prev.lateFeeType === "percent"
                                    ? 10
                                    : 2500
                                  : prev.lateFeeValue
                            };
                          })
                        }
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${
                          billingForm.lateFeeEnabled ? "bg-secondary/15 text-secondary" : "bg-slate-800 text-muted"
                        } disabled:opacity-50`}
                      >
                        {billingForm.lateFeeEnabled ? "Activo" : "Desactivado"}
                      </button>
                    </div>

                    {billingForm.lateFeeEnabled ? (
                      <div className="mt-4 flex flex-wrap items-start gap-3">
                        <div className="w-full max-w-[190px] rounded-brand border border-slate-700 bg-bg p-3">
                          <Field
                            label="Aplicar desde"
                            type="number"
                            min={1}
                            value={String(billingForm.lateFeeStartsAfterDays)}
                            disabled={!canWriteAcademyData || isPreviewMode}
                            onChange={(value) =>
                              setBillingForm((prev) => ({
                                ...prev,
                                lateFeeStartsAfterDays: Math.max(1, Number(value || prev.lateFeeStartsAfterDays))
                              }))
                            }
                          />
                          <p className="mt-2 text-xs text-muted">Dias de mora necesarios antes de sumar el recargo.</p>
                        </div>

                        <div className="w-full max-w-[220px] rounded-brand border border-slate-700 bg-bg p-3">
                          <SelectField
                            label="Tipo"
                            value={billingForm.lateFeeType}
                            disabled={!canWriteAcademyData || isPreviewMode}
                            onChange={(value) =>
                              setBillingForm((prev) => ({
                                ...prev,
                                lateFeeType: value === "percent" ? "percent" : "fixed",
                                lateFeeValue:
                                  prev.lateFeeValue <= 0
                                    ? value === "percent"
                                      ? 10
                                      : 2500
                                    : prev.lateFeeValue
                              }))
                            }
                            options={[
                              { value: "fixed", label: "Monto fijo" },
                              { value: "percent", label: "Porcentaje" }
                            ]}
                          />
                          <p className="mt-2 text-xs text-muted">Puedes cobrar un extra fijo o un porcentaje sobre la cuota.</p>
                        </div>

                        <div className="w-full max-w-[190px] rounded-brand border border-slate-700 bg-bg p-3">
                          <Field
                            label={billingForm.lateFeeType === "percent" ? "Valor extra (%)" : "Valor extra ($)"}
                            type="number"
                            min={1}
                            value={billingForm.lateFeeValue > 0 ? String(billingForm.lateFeeValue) : ""}
                            disabled={!canWriteAcademyData || isPreviewMode}
                            onChange={(value) =>
                              setBillingForm((prev) => ({
                                ...prev,
                                lateFeeValue: value === "" ? 0 : Math.max(0, Number(value || 0))
                              }))
                            }
                          />
                          <p className="mt-2 text-xs text-muted">Este campo es obligatorio mientras el recargo este activo.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-brand border border-dashed border-slate-700 bg-bg px-4 py-3 text-sm text-muted">
                        El recargo automatico esta desactivado. Activalo para definir desde cuando se aplica y cual sera el valor extra.
                      </div>
                    )}

                    <p className="mt-3 text-xs text-muted">
                      Ejemplo: si una cuota vence el dia 10 y configuras recargo desde 3 dias de mora, el adicional se aplica a partir del dia 13 si sigue impaga.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      disabled={!canWriteAcademyData || isPreviewMode}
                      className="rounded-brand bg-primary px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
                    >
                      Guardar reglas de cobro
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-brand border border-slate-700 bg-bg p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Resumen operativo</p>
                <div className="mt-3 grid gap-3">
                  <SignalCard
                    title={`Plan ${getPlanLabel(platformConfig, settings.plan)}`}
                    detail={`${getPlanDescription(platformConfig, settings.plan)} ${getPlanHighlight(platformConfig, settings.plan)}.`}
                    accent="text-primary"
                  />
                  <SignalCard
                    title="Capacidad actual"
                    detail={
                      usage.limit === null
                        ? `Tienes ${studentsCount} alumnos y no hay limite configurado para tu plan.`
                        : `Hoy tienes ${studentsCount} alumnos sobre un maximo de ${usage.limit}.`
                    }
                    accent="text-secondary"
                  />
                  <SignalCard
                    title="Reglas de cobro activas"
                    detail={`Vencimiento general el dia ${billingForm.defaultDueDay}. ${getLateFeeLabel(billingForm)}.`}
                    accent="text-warning"
                  />
                  {trialSummary ? (
                    <SignalCard title={trialSummary.title} detail={trialSummary.detail} accent={trialSummary.accent} />
                  ) : (
                    <SignalCard
                      title="Configuracion lista"
                      detail="El centro ya tiene definidas sus reglas base para trabajar el dia a dia."
                      accent="text-secondary"
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        </Panel>
      </div>

      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-modal-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="plan-modal-title" className="font-display text-lg text-text">
                  Gestionar plan
                </h2>
                <p className="mt-1 text-xs text-muted">
                  El cambio de plan se solicita aparte para no mezclar la configuracion operativa del centro con la parte comercial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {(["basic", "pro", "premium"] as const).map((plan) => {
                const isCurrent = plan === settings.plan;
                return (
                  <div key={plan} className={`rounded-brand border p-4 ${isCurrent ? "border-primary bg-primary/10" : "border-slate-700 bg-bg"}`}>
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

                    <a
                      href={buildSupportLink(
                        settings.name,
                        profile?.displayName ?? "Owner",
                        isCurrent
                          ? `Quiero consultar detalles de mi plan actual ${getPlanLabel(platformConfig, plan)}.`
                          : `Quiero solicitar el cambio al plan ${getPlanLabel(platformConfig, plan)}.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-4 inline-flex w-full items-center justify-center rounded-brand px-3 py-2 text-xs font-semibold ${
                        isCurrent ? "border border-primary/40 bg-primary/15 text-primary" : "bg-primary text-bg hover:brightness-110"
                      }`}
                    >
                      {isCurrent ? "Consultar este plan" : "Solicitar cambio"}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full min-w-0 rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full min-w-0 rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
