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

export function formatPlanLimit(plan: AcademyPlan) {
  const limit = PLAN_LIMITS[plan];
  return limit === null ? "Ilimitado" : String(limit);
}
