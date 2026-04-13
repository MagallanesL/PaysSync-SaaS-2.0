import { getTrialEndsAtMillis } from "./trial";
import type { Academy, AcademyAccess } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_GRACE_DAYS = 2;

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

export function resolveAcademyAccess(
  academy: Pick<Academy, "status" | "createdAt" | "trial" | "subscription">,
  trialDurationDays: number,
  now = Date.now()
): AcademyAccess {
  const trialEndsAtMillis = getTrialEndsAtMillis(academy, trialDurationDays);
  const renewsAtMillis = toMillis(academy.subscription?.renewsAt);
  const graceEndsAtMillis = renewsAtMillis ? renewsAtMillis + SUBSCRIPTION_GRACE_DAYS * DAY_IN_MS : null;
  const billingStatus = String(academy.subscription?.billingStatus ?? "").trim().toLowerCase();
  const hasPaidSubscription = Boolean(
    toMillis(academy.subscription?.startedAt) ||
      toMillis(academy.subscription?.lastPaidAt) ||
      renewsAtMillis ||
      billingStatus === "paid" ||
      billingStatus === "overdue"
  );
  const isTrialAcademy = String(academy.status ?? "").toLowerCase() === "trial";
  const isSuspendedAcademy = String(academy.status ?? "").toLowerCase() === "suspended";

  // Manual suspension from root must override any otherwise-valid subscription window.
  if (isSuspendedAcademy) {
    return {
      state: "blocked",
      canAccessApp: false,
      blockedVariant: hasPaidSubscription ? "renewal" : "trial",
      trialEndsAtMillis,
      renewsAtMillis,
      graceEndsAtMillis,
      hasPaidSubscription
    };
  }

  if (isTrialAcademy) {
    if (trialEndsAtMillis !== null && trialEndsAtMillis <= now) {
      return {
        state: "trial_expired",
        canAccessApp: false,
        blockedVariant: "trial",
        trialEndsAtMillis,
        renewsAtMillis,
        graceEndsAtMillis,
        hasPaidSubscription
      };
    }

    return {
      state: "trial_active",
      canAccessApp: true,
      blockedVariant: null,
      trialEndsAtMillis,
      renewsAtMillis,
      graceEndsAtMillis,
      hasPaidSubscription
    };
  }

  if (renewsAtMillis !== null) {
    if (renewsAtMillis >= now) {
      return {
        state: "active",
        canAccessApp: true,
        blockedVariant: null,
        trialEndsAtMillis,
        renewsAtMillis,
        graceEndsAtMillis,
        hasPaidSubscription
      };
    }

    if (graceEndsAtMillis !== null && graceEndsAtMillis >= now) {
      return {
        state: "grace_period",
        canAccessApp: true,
        blockedVariant: null,
        trialEndsAtMillis,
        renewsAtMillis,
        graceEndsAtMillis,
        hasPaidSubscription
      };
    }

    return {
      state: "expired",
      canAccessApp: false,
      blockedVariant: "renewal",
      trialEndsAtMillis,
      renewsAtMillis,
      graceEndsAtMillis,
      hasPaidSubscription
    };
  }

  return {
    state: hasPaidSubscription ? "active" : "blocked",
    canAccessApp: hasPaidSubscription,
    blockedVariant: hasPaidSubscription ? null : "blocked",
    trialEndsAtMillis,
    renewsAtMillis,
    graceEndsAtMillis,
    hasPaidSubscription
  };
}
