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
  };
  planLimits?: {
    maxStudents: number | null;
  };
  counters?: {
    students: number;
    fees: number;
    payments: number;
  };
  createdAt?: unknown;
}
