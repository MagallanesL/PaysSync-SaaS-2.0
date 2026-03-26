import type { Academy } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function toMillis(value: unknown) {
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

export function getTrialEndsAtMillis(academy: Pick<Academy, "createdAt" | "trial">, trialDurationDays: number) {
  const explicitEndsAt = toMillis(academy.trial?.endsAt);
  if (explicitEndsAt) return explicitEndsAt;

  const createdAtMillis = toMillis(academy.createdAt);
  if (!createdAtMillis) return null;

  return createdAtMillis + trialDurationDays * DAY_IN_MS;
}

export function isTrialExpired(academy: Pick<Academy, "createdAt" | "trial">, trialDurationDays: number) {
  const endsAtMillis = getTrialEndsAtMillis(academy, trialDurationDays);
  if (!endsAtMillis) return false;
  return endsAtMillis <= Date.now();
}
