export type PlatformRole = "root" | "user";
export type AcademyRole = "owner" | "staff" | "viewer";
export type MembershipStatus = "active" | "inactive" | "suspended";
export type AcademyPlan = "basic" | "pro" | "premium";

export interface UserProfile {
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  active: boolean;
}

export interface AcademyMembership {
  academyId: string;
  academyName: string;
  userId: string;
  email: string;
  role: AcademyRole;
  status: MembershipStatus;
}

export interface Academy {
  id: string;
  name: string;
  slug: string;
  plan: AcademyPlan;
  status: "trial" | "active" | "suspended";
  owner: {
    uid: string;
    name: string;
    email: string;
    phone?: string;
  };
  planLimits?: {
    maxStudents: number | null;
  };
  counters?: {
    students: number;
    fees: number;
    payments: number;
  };
  trial?: {
    active?: boolean;
    startedAt?: unknown;
    endsAt?: unknown;
  };
  subscription?: {
    active?: boolean;
    mrr?: number;
    billingStatus?: "paid" | "pending" | "overdue";
    currentPeriod?: string;
    dueDay?: number;
    startedAt?: unknown;
    renewsAt?: unknown;
    lastPaidAt?: unknown;
    amount?: number;
    pendingPlan?: AcademyPlan;
    paymentProvider?: "mercado_pago";
    paymentProviderPaymentId?: string;
  };
  createdAt?: unknown;
}
