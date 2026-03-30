import { Link } from "react-router-dom";
import {
  DEFAULT_PLATFORM_CONFIG,
  formatPlanLimitValue,
  getPlanDescription,
  getPlanHighlight,
  getPlanLabel,
  getPlanPrice
} from "../lib/plans";
import type { AcademyPlan } from "../lib/types";

const PLAN_ORDER: AcademyPlan[] = ["basic", "pro", "premium"];

const PRODUCT_STEPS = [
  {
    title: "1. Creas tu centro en minutos",
    detail: "Registras tu academia, activas el trial y entras a un panel listo para trabajar sin depender de configuraciones largas."
  },
  {
    title: "2. Ordenas alumnos, cuotas y cobros",
    detail: "Centralizas alumnos, disciplinas, aranceles y seguimiento de deuda en un solo lugar, con una vista simple para el dia a dia."
  },
  {
    title: "3. Cobras mejor y decides con mas claridad",
    detail: "Visualizas estado del centro, capacidad del plan y pagos sin hojas sueltas, mensajes perdidos ni caos administrativo."
  }
];

const HIGHLIGHTS = [
  "Control de cuotas, alumnos y disciplinas desde un mismo panel",
  "Registro autoservicio para crear tu academia y empezar en trial sin esperas",
  "Seguimiento de deuda y cobros con una experiencia simple para el dia a dia",
  "Pensada para academias, gimnasios y espacios que necesitan orden sin friccion"
];

const PAYMENT_OPTIONS = [
  "Abono mensual simple, sin implementaciones largas ni costos ocultos",
  "Pago por transferencia o coordinacion comercial segun el plan contratado",
  "Escalado de Basic a Pro o Premium a medida que tu centro crece",
  "Prueba inicial de 15 dias para validar el sistema antes de decidir"
];

const FAQS = [
  {
    question: "¿Para que tipo de centros sirve PaySync?",
    answer: "Funciona muy bien para gimnasios, academias, estudios y espacios con alumnos, cuotas recurrentes y necesidad de seguimiento administrativo."
  },
  {
    question: "¿Necesito conocimientos tecnicos para empezar?",
    answer: "No. La idea es que puedas registrar tu centro, cargar alumnos y empezar a cobrar con una curva de adopcion corta."
  },
  {
    question: "¿Puedo cambiar de plan mas adelante?",
    answer: "Si. El crecimiento del centro no te obliga a migrar de sistema: simplemente ajustas el plan cuando necesites mas capacidad."
  }
];

function getPlanTone(plan: AcademyPlan) {
  if (plan === "premium") return "border-warning/45 bg-gradient-to-br from-warning/15 via-surface to-danger/10";
  if (plan === "pro") return "border-primary/45 bg-gradient-to-br from-primary/15 via-surface to-secondary/10";
  return "border-slate-700 bg-surface";
}

export function MarketingLandingPage() {
  const config = DEFAULT_PLATFORM_CONFIG;

  return (
    <div className="min-h-screen bg-transparent text-text">
      <section className="relative overflow-hidden border-b border-slate-800/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(0,194,255,0.24),transparent_25%),radial-gradient(circle_at_78%_12%,rgba(245,158,11,0.2),transparent_26%),radial-gradient(circle_at_55%_65%,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,rgba(11,16,32,0.18),rgba(11,16,32,0.94))]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-brand border border-slate-800/80 bg-slate-950/45 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl text-primary">PaySync</p>
              <p className="text-sm text-muted">Gestion financiera clara para academias y gimnasios.</p>
            </div>
            <nav className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <a href="#como-funciona" className="transition hover:text-primary">Como funciona</a>
              <a href="#planes" className="transition hover:text-primary">Planes</a>
              <a href="#pagos" className="transition hover:text-primary">Formas de pago</a>
              <Link to="/login" className="rounded-brand border border-slate-700 px-3 py-2 transition hover:border-primary hover:text-primary">
                Ingresar
              </Link>
              <Link to="/register" className="rounded-brand bg-primary px-4 py-2 font-semibold text-bg transition hover:brightness-110">
                Crear mi academia
              </Link>
            </nav>
          </header>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-warning">
                Menos caos administrativo, mas tiempo para hacer crecer tu centro
              </div>
              <h1 className="mt-6 max-w-4xl font-display text-4xl leading-tight text-text sm:text-5xl lg:text-6xl">
                Convierte el desorden diario en una operacion clara, cobrable y profesional.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                PaySync centraliza alumnos, cuotas, disciplinas, deudas y estado del negocio en una experiencia simple.
                Menos planillas, menos mensajes sueltos y mas claridad para cobrar a tiempo, ordenar tu centro y vender una experiencia mas profesional.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="inline-flex items-center justify-center rounded-brand bg-primary px-5 py-3 text-sm font-semibold text-bg transition hover:brightness-110">
                  Empezar prueba gratis
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center rounded-brand border border-slate-700 bg-slate-950/30 px-5 py-3 text-sm font-semibold text-text transition hover:border-primary hover:text-primary">
                  Ya tengo cuenta
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {HIGHLIGHTS.map((item) => (
                  <div key={item} className="rounded-brand border border-slate-800 bg-slate-950/45 p-4 text-sm text-muted">
                    <div className="mb-3 h-2 w-10 rounded-full bg-gradient-to-r from-warning via-primary to-secondary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-brand border border-primary/30 bg-gradient-to-br from-surface via-surface to-primary/10 p-5 shadow-soft">
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Lo que gana tu centro</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <MetricCard label="Cobros" value="Mas claros" tone="text-primary" />
                  <MetricCard label="Alumnos" value="Mas orden" tone="text-secondary" />
                  <MetricCard label="Gestion" value="Menos caos" tone="text-warning" />
                </div>
                <div className="mt-5 grid gap-3">
                  <PreviewRow label="Cobros del mes" value="Mas controlados" accent="text-warning" />
                  <PreviewRow label="Cuotas y deuda" value="Seguimiento centralizado" accent="text-primary" />
                  <PreviewRow label="Capacidad del plan" value="Escalable segun tu crecimiento" accent="text-secondary" />
                </div>
              </div>

              <div className="rounded-brand border border-warning/25 bg-gradient-to-br from-warning/10 via-slate-950/40 to-danger/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-warning">Ideal para centros que hoy cobran con friccion</p>
                <p className="mt-3 text-xl font-semibold text-text">
                  Un sistema que se entiende rapido y transmite valor desde el primer ingreso.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Si hoy gestionas con WhatsApp, cuadernos o planillas, PaySync te da una narrativa muy clara para cambiar:
                  cobrar mejor, seguir deuda, ordenar alumnos y tener visibilidad del negocio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Como funciona</p>
          <h2 className="mt-3 font-display text-3xl text-text sm:text-4xl">Una operacion mas prolija, sin complejidad innecesaria.</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            La app esta pensada para que el dueño del centro entienda rapido el valor y lo convierta en una mejora real del negocio.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PRODUCT_STEPS.map((step) => (
            <div key={step.title} className="rounded-brand border border-slate-800 bg-surface p-6">
              <p className="font-display text-xl text-text">{step.title}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="planes" className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Planes</p>
            <h2 className="mt-3 font-display text-3xl text-text sm:text-4xl">Precios simples para vender con confianza.</h2>
            <p className="mt-3 text-base leading-7 text-muted">
              Empiezas con 15 dias de prueba y eliges el plan segun capacidad y ritmo de crecimiento.
            </p>
          </div>
          <div className="rounded-brand border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Trial de {config.trialDurationDays} dias incluido
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const definition = config.plans[plan];
            return (
              <article key={plan} className={`rounded-brand border p-6 ${getPlanTone(plan)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl text-text">{getPlanLabel(config, plan)}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{getPlanDescription(config, plan)}</p>
                  </div>
                  <div className="rounded-brand border border-slate-700 bg-slate-950/30 px-3 py-2 text-right">
                    <p className="text-2xl font-semibold text-secondary">${getPlanPrice(config, plan)}</p>
                    <p className="text-xs uppercase tracking-wide text-muted">por mes</p>
                  </div>
                </div>

                <div className="mt-5 rounded-brand border border-slate-700/70 bg-slate-950/25 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Capacidad</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPlanLimitValue(definition.maxStudents)} alumnos
                  </p>
                </div>

                <div className="mt-4 rounded-brand border border-slate-700/70 bg-slate-950/25 px-4 py-3 text-sm text-muted">
                  {getPlanHighlight(config, plan)}
                </div>

                <ul className="mt-5 grid gap-3 text-sm text-muted">
                  <li className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-primary" />
                    Panel para alumnos, disciplinas, cuotas y pagos.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-primary" />
                    Visibilidad del centro para tomar decisiones mas rapido.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-primary" />
                    Escalado comercial sin cambiar de sistema.
                  </li>
                </ul>

                <Link
                  to="/register"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-brand bg-primary px-4 py-3 text-sm font-semibold text-bg transition hover:brightness-110"
                >
                  Empezar con {getPlanLabel(config, plan)}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pagos" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="rounded-brand border border-slate-800 bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Formas de pago</p>
          <h2 className="mt-3 font-display text-3xl text-text">Una propuesta facil de explicar y facil de cerrar.</h2>
          <div className="mt-5 grid gap-3">
            {PAYMENT_OPTIONS.map((option) => (
              <div key={option} className="rounded-brand border border-slate-700 bg-slate-950/30 px-4 py-3 text-sm text-muted">
                {option}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-brand border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-secondary/10 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Discurso comercial</p>
          <blockquote className="mt-4 border-l-2 border-primary pl-4 text-lg leading-8 text-text">
            "PaySync te ayuda a cobrar con mas orden, seguir la deuda sin friccion y tener una vista clara del centro.
            No es solo software: es una forma mas prolija de gestionar y crecer."
          </blockquote>
          <p className="mt-4 text-sm leading-7 text-muted">
            Esa narrativa conecta porque baja el problema real del owner: desorden administrativo, cobros dispersos y poca visibilidad.
            La landing y el producto ya trabajan juntos para mostrar una solucion concreta, profesional y facil de adoptar.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-brand border border-slate-800 bg-surface p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Preguntas frecuentes</p>
              <h2 className="mt-3 font-display text-3xl text-text">Lo necesario para decidir rapido.</h2>
            </div>
            <Link to="/register" className="inline-flex items-center justify-center rounded-brand bg-primary px-4 py-3 text-sm font-semibold text-bg transition hover:brightness-110">
              Quiero probar PaySync
            </Link>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {FAQS.map((item) => (
              <div key={item.question} className="rounded-brand border border-slate-700 bg-slate-950/30 p-4">
                <p className="font-semibold text-text">{item.question}</p>
                <p className="mt-2 text-sm leading-7 text-muted">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-brand border border-slate-700 bg-slate-950/35 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-brand border border-slate-800 bg-bg/70 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-semibold ${accent}`}>{value}</span>
    </div>
  );
}
