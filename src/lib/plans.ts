import type { AcademyPlan } from "./types";

export const PLAN_LIMITS: Record<AcademyPlan, number | null> = {
  basic: 50,
  pro: 100,
  premium: null
};

export const PLAN_PRICES: Record<AcademyPlan, number> = {
  basic: 49,
  pro: 99,
  premium: 199
};

export interface PlanDefinition {
  label: string;
  price: number;
  maxStudents: number | null;
  description: string;
  highlight: string;
}

export interface PlatformConfig {
  trialDurationDays: number;
  plans: Record<AcademyPlan, PlanDefinition>;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  trialDurationDays: 14,
  plans: {
    basic: {
      label: "Basico",
      price: 49,
      maxStudents: 50,
      description: "Ideal para centros que estan empezando y necesitan una base simple.",
      highlight: "Hasta 50 alumnos"
    },
    pro: {
      label: "Pro",
      price: 99,
      maxStudents: 100,
      description: "Pensado para organizaciones en crecimiento con mas alumnos y operacion diaria.",
      highlight: "Hasta 100 alumnos"
    },
    premium: {
      label: "Premium",
      price: 199,
      maxStudents: null,
      description: "Para academias con mayor volumen, equipo ampliado y necesidad de escalar.",
      highlight: "Alumnos ilimitados"
    }
  }
};

export function normalizePlatformConfig(raw: unknown): PlatformConfig {
  const input = (raw ?? {}) as Partial<PlatformConfig> & {
    plans?: Partial<Record<AcademyPlan, Partial<PlanDefinition>>>;
  };

  return {
    trialDurationDays:
      typeof input.trialDurationDays === "number" && Number.isFinite(input.trialDurationDays)
        ? Math.max(1, Math.round(input.trialDurationDays))
        : DEFAULT_PLATFORM_CONFIG.trialDurationDays,
    plans: {
      basic: normalizePlan("basic", input.plans?.basic),
      pro: normalizePlan("pro", input.plans?.pro),
      premium: normalizePlan("premium", input.plans?.premium)
    }
  };
}

function normalizePlan(plan: AcademyPlan, raw: Partial<PlanDefinition> | undefined): PlanDefinition {
  const fallback = DEFAULT_PLATFORM_CONFIG.plans[plan];
  const maxStudents =
    raw?.maxStudents === null
      ? null
      : typeof raw?.maxStudents === "number" && Number.isFinite(raw.maxStudents)
        ? Math.max(1, Math.round(raw.maxStudents))
        : fallback.maxStudents;

  return {
    label: String(raw?.label ?? fallback.label).trim() || fallback.label,
    price:
      typeof raw?.price === "number" && Number.isFinite(raw.price) ? Math.max(0, Math.round(raw.price)) : fallback.price,
    maxStudents,
    description: String(raw?.description ?? fallback.description).trim() || fallback.description,
    highlight: String(raw?.highlight ?? fallback.highlight).trim() || fallback.highlight
  };
}

export function getPlanLabel(config: PlatformConfig | null | undefined, plan: AcademyPlan) {
  return config?.plans[plan]?.label ?? DEFAULT_PLATFORM_CONFIG.plans[plan].label;
}

export function getPlanPrice(config: PlatformConfig | null | undefined, plan: AcademyPlan) {
  return config?.plans[plan]?.price ?? PLAN_PRICES[plan];
}

export function getPlanLimit(config: PlatformConfig | null | undefined, plan: AcademyPlan) {
  return config?.plans[plan]?.maxStudents ?? PLAN_LIMITS[plan];
}

export function getPlanDescription(config: PlatformConfig | null | undefined, plan: AcademyPlan) {
  return config?.plans[plan]?.description ?? DEFAULT_PLATFORM_CONFIG.plans[plan].description;
}

export function getPlanHighlight(config: PlatformConfig | null | undefined, plan: AcademyPlan) {
  return config?.plans[plan]?.highlight ?? DEFAULT_PLATFORM_CONFIG.plans[plan].highlight;
}

export function formatPlanLimitValue(limit: number | null) {
  return limit === null ? "Ilimitado" : String(limit);
}

export function formatPlanLimit(plan: AcademyPlan) {
  return formatPlanLimitValue(PLAN_LIMITS[plan]);
}
