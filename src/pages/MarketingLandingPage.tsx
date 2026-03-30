import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthEntryPanel } from "../components/auth/AuthEntryPanel";
import {
  DEFAULT_PLATFORM_CONFIG,
  formatPlanLimitValue,
  getPlanDescription,
  getPlanHighlight,
  getPlanLabel,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../lib/plans";
import { db } from "../lib/firebase";
import type { AcademyPlan } from "../lib/types";

const PLAN_ORDER: AcademyPlan[] = ["basic", "pro", "premium"];

const painPoints = [
  "No sabes rapido quien pago y quien no.",
  "Revisas chats, transferencias y comprobantes a mano.",
  "Perdes tiempo persiguiendo cuotas todos los meses.",
  "Llevas el control entre Excel, cuaderno y memoria."
];

const workflowSteps = [
  "Registras alumnos y ordenas tu base en un solo lugar.",
  "Controlas cuotas, vencimientos y estados de pago.",
  "Marcas pagos y pendientes sin revisar mensajes por todos lados.",
  "Ves el resumen del mes y actuas mas rapido."
];

const audienceTags = [
  "Academias",
  "Escuelas de danza",
  "Gimnasios",
  "Running teams",
  "Entrenadores",
  "Centros deportivos"
];

const paymentOptions = [
  "Abono mensual simple y sin implementaciones largas.",
  "Pago por transferencia o coordinacion comercial segun el plan.",
  "Cambio de plan a medida que tu centro crece."
];

const faqs = [
  {
    question: "Necesito instalar algo?",
    answer: "No. Puedes empezar desde tu navegador en pocos minutos."
  },
  {
    question: "Puedo usarlo desde el celular?",
    answer: "Si. Puedes consultar y gestionar tambien desde mobile."
  },
  {
    question: "Puedo probarlo antes de decidir?",
    answer: `Si. Puedes empezar con ${DEFAULT_PLATFORM_CONFIG.trialDurationDays} dias de prueba.`
  }
];

function isRecommended(plan: AcademyPlan) {
  return plan === "pro";
}

function getPlanCardClass(plan: AcademyPlan) {
  if (plan === "pro") {
    return "border-[#10B981] bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(16,185,129,0.08))] shadow-[0_22px_70px_rgba(16,185,129,0.12)]";
  }
  if (plan === "premium") {
    return "border-[#38BDF8]/25 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(56,189,248,0.06))]";
  }
  return "border-[#1F2937] bg-[#111827]";
}

export function MarketingLandingPage() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    async function loadPlatformConfig() {
      const configSnap = await getDoc(doc(db, "platform", "config"));
      setConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }

    void loadPlatformConfig();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B1020] text-[#F9FAFB]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_26%)]" />
      {authModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl">
            <AuthEntryPanel initialMode={authModalMode} embedded onRequestClose={() => setAuthModalMode(null)} />
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[20px] border border-[#1F2937] bg-[rgba(17,24,39,0.82)] px-4 py-4 backdrop-blur sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="font-display text-2xl text-[#F9FAFB]">PaySync</p>
            <p className="text-sm text-[#94A3B8]">Cobros y alumnos en una sola herramienta.</p>
          </div>

          <nav className="flex flex-col gap-3 text-sm text-[#94A3B8] sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center gap-3">
              <a href="#como-funciona" className="transition hover:text-[#F9FAFB]">
                Como funciona
              </a>
              <a href="#planes" className="transition hover:text-[#F9FAFB]">
                Planes
              </a>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalMode("login")}
              className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[#1F2937] px-4 py-2 font-medium text-[#F9FAFB] transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setAuthModalMode("register")}
              className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#10B981] px-4 py-2 font-semibold text-[#0B1020] transition hover:brightness-110"
            >
              Solicitar demo
            </button>
          </nav>
        </header>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="inline-flex max-w-full rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#10B981] sm:text-xs">
            Menos Excel. Menos WhatsApp. Mas control.
          </div>

          <h1 className="mt-6 max-w-4xl font-display text-[2.2rem] leading-[1.02] text-[#F9FAFB] sm:text-5xl lg:text-6xl">
            Cobra cuotas, ordena alumnos y deja de perseguir pagos por WhatsApp.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-[#94A3B8] sm:text-lg sm:leading-8">
            PaySync centraliza alumnos, vencimientos y estados de pago en una sola plataforma para academias,
            gimnasios y grupos deportivos.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setAuthModalMode("register")}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#0B1020] transition hover:brightness-110 sm:min-w-[180px]"
            >
              Solicitar demo
            </button>
            <a
              href="#como-funciona"
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] border border-[#1F2937] bg-[#111827] px-5 py-3 text-sm font-semibold text-[#F9FAFB] transition hover:border-[#38BDF8] hover:text-[#38BDF8] sm:min-w-[180px]"
            >
              Ver como funciona
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5 sm:mt-10 sm:gap-3">
            {audienceTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#1F2937] bg-[#111827] px-3.5 py-2 text-xs font-medium text-[#E5E7EB] sm:px-4 sm:text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] bg-[#10B981]/8 blur-2xl sm:translate-x-5 sm:translate-y-5" />
          <div className="relative rounded-[24px] border border-[#1F2937] bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(11,16,32,1))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:rounded-[28px] sm:p-5">
            <div className="flex flex-col gap-3 rounded-[18px] border border-[#1F2937] bg-[#0F172A] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#38BDF8]">PaySync</p>
                <p className="mt-1 text-sm text-[#94A3B8]">Resumen claro del mes</p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-[#10B981]/10 px-3 py-1 text-xs font-semibold text-[#10B981]">
                Activo
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
              <MockMetric label="Pagado" value="72%" tone="text-[#10B981]" />
              <MockMetric label="Pendiente" value="18%" tone="text-[#F9FAFB]" />
              <MockMetric label="Vence hoy" value="10%" tone="text-[#38BDF8]" />
            </div>

            <div className="mt-4 rounded-[22px] border border-[#1F2937] bg-[#111827] p-3.5 sm:p-4">
              <div className="grid gap-3">
                <MockRow label="Alumnos activos" value="126" accent="text-[#F9FAFB]" />
                <MockRow label="Cuotas pagadas" value="91" accent="text-[#10B981]" />
                <MockRow label="Cuotas pendientes" value="23" accent="text-[#38BDF8]" />
                <MockRow label="Vencimientos de hoy" value="12" accent="text-[#F9FAFB]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[26px] border border-[#1F2937] bg-[#111827] p-5 sm:rounded-[30px] sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="El problema"
            title="Cobrar no deberia ser un caos todos los meses."
            description="Si tu control vive entre chats, planillas, transferencias y memoria, lo normal es perder tiempo y claridad."
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {painPoints.map((item) => (
              <CardItem key={item} text={item} icon="!" tone="text-[#38BDF8]" bg="bg-[#38BDF8]/10" />
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="overflow-hidden rounded-[26px] border border-[#1F2937] bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.32)] sm:rounded-[30px] sm:p-6 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="inline-flex rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#10B981]">
                Como funciona
              </div>
              <h2 className="mt-4 font-display text-[2rem] leading-tight text-[#F9FAFB] sm:text-[2.4rem]">
                Cobras mejor cuando todo el mes se ve claro desde el primer dia.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#94A3B8]">
                PaySync te guia en un flujo simple para ordenar alumnos, cuotas y estados de pago sin depender de Excel, cuadernos ni chats.
              </p>

              <div className="mt-6 grid gap-3">
                <HighlightRow
                  title="Alta rapida"
                  detail="Registras tu centro, eliges plan y entras con prueba gratis sin una implementacion larga."
                />
                <HighlightRow
                  title="Seguimiento mensual"
                  detail="Ves pagos, pendientes y vencimientos en una sola vista para actuar rapido."
                />
                <HighlightRow
                  title="Mas orden, menos friccion"
                  detail="Tu operacion diaria queda mas prolija y mas facil de sostener a medida que creces."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {workflowSteps.map((step, index) => (
                <StepCard key={step} step={`Paso ${index + 1}`} detail={step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="Planes"
            title="Precios simples para vender con confianza."
            description={`Empiezas con ${config.trialDurationDays} dias de prueba y luego eliges el plan segun la cantidad de alumnos que manejas.`}
          />

          <div className="w-fit rounded-[16px] border border-[#10B981]/25 bg-[#10B981]/10 px-4 py-3 text-sm font-medium text-[#10B981]">
            Prueba inicial incluida
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const definition = config.plans[plan];
            const recommended = isRecommended(plan);

            return (
              <article key={plan} className={`relative rounded-[24px] border p-5 sm:rounded-[28px] sm:p-6 ${getPlanCardClass(plan)}`}>
                {recommended && (
                  <div className="absolute -top-3 left-5 rounded-full bg-[#10B981] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B1020] sm:left-6 sm:text-xs">
                    Recomendado
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-display text-2xl text-[#F9FAFB]">{getPlanLabel(config, plan)}</p>
                    <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{getPlanDescription(config, plan)}</p>
                  </div>
                  <div className="rounded-[16px] border border-[#1F2937] bg-[#0F172A] px-4 py-3 text-left sm:text-right">
                    <p className="text-2xl font-semibold text-[#F9FAFB] sm:text-3xl">${getPlanPrice(config, plan)}</p>
                    <p className="text-xs uppercase tracking-wide text-[#94A3B8]">por mes</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[18px] border border-[#1F2937] bg-[#0F172A] px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Capacidad</p>
                  <p className="mt-1 text-base font-semibold text-[#F9FAFB]">
                    {formatPlanLimitValue(definition.maxStudents)} alumnos
                  </p>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#1F2937] bg-[#0F172A] px-4 py-3 text-sm text-[#94A3B8]">
                  {getPlanHighlight(config, plan)}
                </div>

                <button
                  type="button"
                  onClick={() => setAuthModalMode("register")}
                  className={`mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[16px] px-4 py-3 text-sm font-semibold transition ${
                    recommended
                      ? "bg-[#10B981] text-[#0B1020] hover:brightness-110"
                      : "border border-[#1F2937] bg-[#0F172A] text-[#F9FAFB] hover:border-[#38BDF8] hover:text-[#38BDF8]"
                  }`}
                >
                  Solicitar demo
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <div className="rounded-[26px] border border-[#1F2937] bg-[#111827] p-5 sm:rounded-[30px] sm:p-6">
          <SectionHeader
            eyebrow="Formas de pago"
            title="Una propuesta simple de contratar."
            description="Lo importante es que el producto sea facil de adoptar y facil de sostener."
          />

          <div className="mt-6 grid gap-3">
            {paymentOptions.map((option) => (
              <div key={option} className="rounded-[18px] border border-[#1F2937] bg-[#0F172A] px-4 py-3 text-sm leading-6 text-[#94A3B8]">
                {option}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-[#1F2937] bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(17,24,39,0.98))] p-5 sm:rounded-[30px] sm:p-6">
          <SectionHeader
            eyebrow="FAQ"
            title="Lo necesario para decidir rapido."
            description="Respuestas claras para las dudas mas comunes antes de empezar."
          />

          <div className="mt-6 grid gap-3">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-[18px] border border-[#1F2937] bg-[#0F172A] p-4">
                <p className="font-semibold text-[#F9FAFB]">{item.question}</p>
                <p className="mt-2 text-sm leading-7 text-[#94A3B8]">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="rounded-[28px] border border-[#10B981]/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(17,24,39,0.98))] p-6 text-center sm:rounded-[34px] sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[#10B981]">PaySync</p>
          <h2 className="mt-4 font-display text-[1.9rem] text-[#F9FAFB] sm:text-4xl">
            Ordena tus cuotas y tu gestion mensual con una sola herramienta.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#94A3B8]">
            Pedi una demo y conoce como PaySync puede ayudarte a cobrar mejor y administrar con mas claridad.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAuthModalMode("register")}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#0B1020] transition hover:brightness-110 sm:min-w-[180px]"
            >
              Solicitar demo
            </button>
            <button
              type="button"
              onClick={() => setAuthModalMode("login")}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] border border-[#1F2937] bg-[#0F172A] px-5 py-3 text-sm font-semibold text-[#F9FAFB] transition hover:border-[#38BDF8] hover:text-[#38BDF8] sm:min-w-[180px]"
            >
              Ingresar
            </button>
          </div>
          <div className="mt-4 text-center text-sm text-muted">
            <Link to="/login" className="transition hover:text-primary">
              O abrir la pagina completa de acceso
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.24em] text-[#38BDF8]">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[1.9rem] leading-tight text-[#F9FAFB] sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#94A3B8]">{description}</p>
    </div>
  );
}

function MockMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#1F2937] bg-[#111827] p-4">
      <p className="text-xs uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-2 font-display text-xl ${tone} sm:text-2xl`}>{value}</p>
    </div>
  );
}

function MockRow({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#1F2937] bg-[#0B1020] px-4 py-3">
      <span className="min-w-0 text-sm text-[#94A3B8]">{label}</span>
      <span className={`shrink-0 text-sm font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

function CardItem({
  text,
  icon,
  tone,
  bg
}: {
  text: string;
  icon: string;
  tone: string;
  bg: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#1F2937] bg-[#0F172A] p-5">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] font-semibold ${tone} ${bg}`}>
        {icon}
      </div>
      <p className="text-sm leading-7 text-[#E5E7EB]">{text}</p>
    </div>
  );
}

function StepCard({
  step,
  detail
}: {
  step: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#1F2937] bg-[#111827] p-5 sm:p-6">
      <div className="mb-4 inline-flex rounded-full border border-[#10B981]/20 bg-[#10B981]/10 px-3 py-1 text-xs font-semibold text-[#10B981]">
        {step}
      </div>
      <p className="text-sm leading-7 text-[#E5E7EB]">{detail}</p>
    </div>
  );
}

function HighlightRow({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#1F2937] bg-[#0F172A] p-4">
      <p className="text-sm font-semibold text-[#F9FAFB]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{detail}</p>
    </div>
  );
}
