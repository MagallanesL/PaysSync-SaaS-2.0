export type FeeCategory = "monthly_fee" | "enrollment" | "uniform" | "product" | "exam" | "other";
export type FeePaymentMode = "monthly" | "one_time";
export type FeeStatus = "pending" | "partial" | "paid" | "overdue";
export type LateFeeType = "fixed" | "percent";

export interface AcademyBillingSettings {
  defaultDueDay: number;
  lateFeeEnabled: boolean;
  lateFeeStartsAfterDays: number;
  lateFeeType: LateFeeType;
  lateFeeValue: number;
}

export interface FeeLike {
  amount: number;
  paidAmount?: number;
  dueDate: string;
}

export const DEFAULT_ACADEMY_BILLING_SETTINGS: AcademyBillingSettings = {
  defaultDueDay: 10,
  lateFeeEnabled: false,
  lateFeeStartsAfterDays: 3,
  lateFeeType: "fixed",
  lateFeeValue: 0
};

export function normalizeAcademyBillingSettings(raw: unknown): AcademyBillingSettings {
  const input = (raw ?? {}) as Partial<AcademyBillingSettings>;
  return {
    defaultDueDay:
      typeof input.defaultDueDay === "number" && Number.isFinite(input.defaultDueDay)
        ? Math.min(28, Math.max(1, Math.round(input.defaultDueDay)))
        : DEFAULT_ACADEMY_BILLING_SETTINGS.defaultDueDay,
    lateFeeEnabled:
      typeof input.lateFeeEnabled === "boolean" ? input.lateFeeEnabled : DEFAULT_ACADEMY_BILLING_SETTINGS.lateFeeEnabled,
    lateFeeStartsAfterDays:
      typeof input.lateFeeStartsAfterDays === "number" && Number.isFinite(input.lateFeeStartsAfterDays)
        ? Math.max(1, Math.round(input.lateFeeStartsAfterDays))
        : DEFAULT_ACADEMY_BILLING_SETTINGS.lateFeeStartsAfterDays,
    lateFeeType: input.lateFeeType === "percent" ? "percent" : DEFAULT_ACADEMY_BILLING_SETTINGS.lateFeeType,
    lateFeeValue:
      typeof input.lateFeeValue === "number" && Number.isFinite(input.lateFeeValue)
        ? Math.max(0, Math.round(input.lateFeeValue))
        : DEFAULT_ACADEMY_BILLING_SETTINGS.lateFeeValue
  };
}

export function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function diffDays(targetDate: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${targetDate}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function getDaysOverdue(targetDate: string) {
  return Math.max(0, -diffDays(targetDate));
}

export function normalizePaidAmount(amount: number, paidAmount?: number) {
  const normalizedAmount = Number(amount || 0);
  const normalizedPaid = Number(paidAmount || 0);
  return Math.min(Math.max(normalizedPaid, 0), Math.max(normalizedAmount, 0));
}

export function getFeeBalance(amount: number, paidAmount?: number) {
  return Math.max(0, Number(amount || 0) - normalizePaidAmount(amount, paidAmount));
}

export function resolveFeeStatus({
  amount,
  paidAmount,
  dueDate
}: FeeLike): FeeStatus {
  const normalizedAmount = Number(amount || 0);
  const delivered = normalizePaidAmount(normalizedAmount, paidAmount);

  if (normalizedAmount === 0 || delivered >= normalizedAmount) {
    return "paid";
  }

  if (diffDays(dueDate) < 0) {
    return "overdue";
  }

  if (delivered > 0) {
    return "partial";
  }

  return "pending";
}

export function resolvePaymentMode(input?: string, category?: FeeCategory): FeePaymentMode {
  if (input === "monthly" || input === "one_time") {
    return input;
  }
  return category === "monthly_fee" ? "monthly" : "one_time";
}

export function compareFeePriority(
  a: { dueDate: string; balance: number },
  b: { dueDate: string; balance: number }
) {
  const aDaysLeft = diffDays(a.dueDate);
  const bDaysLeft = diffDays(b.dueDate);
  const aDaysOverdue = getDaysOverdue(a.dueDate);
  const bDaysOverdue = getDaysOverdue(b.dueDate);
  const aHasDebt = a.balance > 0;
  const bHasDebt = b.balance > 0;
  const aIsOverdueDebt = aHasDebt && aDaysOverdue > 0;
  const bIsOverdueDebt = bHasDebt && bDaysOverdue > 0;
  const aIsUpcomingDebt = aHasDebt && aDaysLeft >= 0;
  const bIsUpcomingDebt = bHasDebt && bDaysLeft >= 0;

  if (aIsOverdueDebt !== bIsOverdueDebt) return aIsOverdueDebt ? -1 : 1;
  if (aIsOverdueDebt && bIsOverdueDebt) {
    if (aDaysOverdue !== bDaysOverdue) return bDaysOverdue - aDaysOverdue;
    if (a.balance !== b.balance) return b.balance - a.balance;
    return aDaysLeft - bDaysLeft;
  }

  if (aIsUpcomingDebt !== bIsUpcomingDebt) return aIsUpcomingDebt ? -1 : 1;
  if (aIsUpcomingDebt && bIsUpcomingDebt) {
    if (aDaysLeft !== bDaysLeft) return aDaysLeft - bDaysLeft;
    if (a.balance !== b.balance) return b.balance - a.balance;
    return a.dueDate.localeCompare(b.dueDate);
  }

  if (aDaysLeft !== bDaysLeft) return aDaysLeft - bDaysLeft;
  if (a.balance !== b.balance) return b.balance - a.balance;
  return a.dueDate.localeCompare(b.dueDate);
}

export function getLateFeeAmount(fee: FeeLike, settings: AcademyBillingSettings) {
  const daysOverdue = getDaysOverdue(fee.dueDate);
  const balanceWithoutLateFee = getFeeBalance(fee.amount, fee.paidAmount);

  if (!settings.lateFeeEnabled || settings.lateFeeValue <= 0 || balanceWithoutLateFee <= 0) return 0;
  if (daysOverdue < settings.lateFeeStartsAfterDays) return 0;

  if (settings.lateFeeType === "percent") {
    return Math.round((Number(fee.amount || 0) * settings.lateFeeValue) / 100);
  }

  return settings.lateFeeValue;
}

export function applyBillingSettingsToFee<T extends FeeLike>(fee: T, settings: AcademyBillingSettings) {
  const lateFeeAmount = getLateFeeAmount(fee, settings);
  const totalAmount = Number(fee.amount || 0) + lateFeeAmount;
  const paidAmount = normalizePaidAmount(totalAmount, fee.paidAmount);
  const balance = getFeeBalance(totalAmount, paidAmount);
  const status = resolveFeeStatus({
    amount: totalAmount,
    paidAmount,
    dueDate: fee.dueDate
  });

  return {
    ...fee,
    paidAmount,
    amount: totalAmount,
    balance,
    status,
    lateFeeAmount,
    baseAmount: Number(fee.amount || 0)
  };
}
