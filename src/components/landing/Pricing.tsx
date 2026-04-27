import {
  formatPlanLimitValue,
  getPlanDescription,
  getPlanHighlight,
  getPlanLimit,
  getPlanPrice,
  type PlatformConfig
} from "../../lib/plans";
import type { AcademyPlan } from "../../lib/types";

export function Pricing({
  trialDays,
  platformConfig,
  onPrimaryClick
}: {
  trialDays: number;
  platformConfig: PlatformConfig;
  onPrimaryClick: () => void;
}) {
  const orderedPlans = (["basic", "pro", "premium"] as AcademyPlan[])
    .map((planKey) => ({
      planKey,
      dbLabel: platformConfig.plans[planKey].label,
      price: getPlanPrice(platformConfig, planKey),
      limit: getPlanLimit(platformConfig, planKey),
      description: getPlanDescription(platformConfig, planKey),
      highlight: getPlanHighlight(platformConfig, planKey)
    }))
    .sort((left, right) => left.price - right.price)
    .map((plan, index, collection) => ({
      ...plan,
      visualName: getVisualPlanName(index, collection.length, plan.dbLabel),
      commercialCopy: getCommercialCopy(index, collection.length),
      ctaLabel: getCtaLabel(index, collection.length),
      isFeatured: index === Math.floor(collection.length / 2)
    }));

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.96),rgba(11,11,11,0.98))] px-5 py-8 sm:px-7 sm:py-10">
      <div className="grid gap-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Planes y acceso</p>
          <h2 className="mt-3 text-[2rem] font-semibold leading-tight text-white sm:text-[2.9rem]">
            Deja de perder control en tus cobros en menos de 7 dias
          </h2>
          <p className="mt-4 text-base leading-7 text-[#B3B3B3] sm:text-lg">
            Elegi el plan que mejor se adapte a tu academia
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#8E9AAF] sm:text-base">
            Todos los planes parten de la misma base: ordenar cuotas, seguimiento y pagos pendientes sin planillas ni
            procesos eternos.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {orderedPlans.map((plan) => (
            <article
              key={plan.planKey}
              className={`relative flex h-full flex-col rounded-[28px] border p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] transition duration-300 ${
                plan.isFeatured
                  ? "scale-[1.02] border-[#00C896]/45 bg-[linear-gradient(180deg,rgba(20,20,20,1),rgba(11,11,11,0.98))] shadow-[0_20px_90px_rgba(0,200,150,0.16)]"
                  : "border-white/10 bg-[#101010]"
              }`}
            >
              {plan.isFeatured ? (
                <div className="absolute left-6 top-0 -translate-y-1/2 rounded-full border border-[#00C896]/35 bg-[#00C896] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0B0B0B]">
                  Mas elegido
                </div>
              ) : null}

              <div className="flex-1">
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${plan.isFeatured ? "text-[#00C896]" : "text-[#00D1FF]"}`}>
                  {plan.visualName}
                </p>
                <h3 className="mt-3 text-3xl font-semibold text-white">{plan.dbLabel}</h3>
                <p className="mt-2 text-sm font-medium text-[#D7DFEA]">{plan.commercialCopy}</p>
                <p className="mt-4 text-sm leading-6 text-[#8E9AAF]">{plan.description}</p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-semibold text-white">${plan.price}</span>
                  <span className="pb-1 text-sm text-[#B3B3B3]">/ mes</span>
                </div>

                <div className="mt-6 grid gap-3">
                  <PriceItem text={`${trialDays} dias para probar sin friccion`} featured={plan.isFeatured} />
                  <PriceItem text={plan.highlight} featured={plan.isFeatured} />
                  <PriceItem
                    text={
                      plan.limit === null
                        ? "Escala sin techo de alumnos"
                        : `Hasta ${formatPlanLimitValue(plan.limit)} alumnos con control claro`
                    }
                    featured={plan.isFeatured}
                  />
                </div>

                {plan.isFeatured ? (
                  <div className="mt-5 rounded-[18px] border border-[#00C896]/20 bg-[#00C896]/8 px-4 py-3 text-sm text-[#DDFBF2]">
                    Probalo 7 dias. Si no te ordena los cobros, no pagas.
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onPrimaryClick}
                className={`mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[16px] px-6 py-3 text-sm font-semibold transition ${
                  plan.isFeatured
                    ? "bg-[#00C896] text-[#0B0B0B] hover:brightness-110"
                    : "border border-white/10 bg-white/[0.03] text-white hover:border-[#00C896] hover:text-[#00C896]"
                }`}
              >
                {plan.ctaLabel}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function getVisualPlanName(index: number, total: number, fallback: string) {
  if (total < 3) return fallback;
  if (index === 0) return "Inicio";
  if (index === 1) return "Profesional";
  if (index === total - 1) return "Premium";
  return fallback;
}

function getCommercialCopy(index: number, total: number) {
  if (total < 3) return "Elegi el plan que mejor acompane tu crecimiento";
  if (index === 0) return "Para empezar a ordenar tus cobros";
  if (index === 1) return "El plan que usan la mayoria";
  if (index === total - 1) return "Para academias con mayor volumen";
  return "Elegi el plan que mejor acompane tu crecimiento";
}

function getCtaLabel(index: number, total: number) {
  if (total < 3) return "Empezar ahora";
  if (index === 0) return "Empezar ahora";
  if (index === 1) return "Probar demo";
  if (index === total - 1) return "Contactar";
  return "Empezar ahora";
}

function PriceItem({ text, featured = false }: { text: string; featured?: boolean }) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-sm ${
        featured
          ? "border-[#00C896]/16 bg-[#00C896]/6 text-white"
          : "border-white/10 bg-white/[0.03] text-white"
      }`}
    >
      {text}
    </div>
  );
}
