export type FeeCategory = "monthly_fee" | "enrollment" | "uniform" | "product" | "exam" | "other";
export type FeePaymentMode = "monthly" | "one_time";
export type FeeStatus = "pending" | "partial" | "paid" | "overdue";

export interface FeeLike {
  amount: number;
  paidAmount?: number;
  dueDate: string;
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
