import type { Academy } from "./types";

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof value.toMillis === "function") {
    return new Date(value.toMillis() as number);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "number") return new Date(value);
  return null;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function getCurrentPeriodFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function resolveSubscriptionDates(academy: Pick<Academy, "createdAt" | "subscription">) {
  const startedAt =
    toDate(academy.subscription?.startedAt) ??
    toDate(academy.createdAt);
  const renewsAt =
    toDate(academy.subscription?.renewsAt) ??
    (startedAt ? addMonths(startedAt, 1) : null);

  return { startedAt, renewsAt };
}
