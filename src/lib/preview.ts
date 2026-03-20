import type { Academy, AcademyMembership, UserProfile } from "./types";

// Preview/demo mode is disabled so the app uses real Firebase data only.
export const PUBLIC_EXPLORATION_MODE = false;

export const previewProfile: UserProfile = {
  email: "explore@paysync.local",
  displayName: "Modo Exploracion",
  platformRole: "user",
  active: true
};

export const previewMembership: AcademyMembership = {
  academyId: "preview-academy",
  academyName: "Academia Demo",
  userId: "preview-user",
  email: previewProfile.email,
  role: "owner",
  status: "active"
};

export const previewAcademies: Academy[] = [
  {
    id: "academy-demo",
    name: "Academia Demo",
    slug: "academia-demo",
    plan: "pro",
    status: "active",
    owner: {
      uid: "preview-user",
      name: "Modo Exploracion",
      email: previewProfile.email
    },
    planLimits: {
      maxStudents: 100
    },
    counters: {
      students: 24,
      fees: 18,
      payments: 12
    }
  },
  {
    id: "academy-trial",
    name: "Academia Trial",
    slug: "academia-trial",
    plan: "basic",
    status: "trial",
    owner: {
      uid: "preview-owner-2",
      name: "Owner Demo",
      email: "owner-demo@paysync.local"
    },
    planLimits: {
      maxStudents: 50
    },
    counters: {
      students: 8,
      fees: 6,
      payments: 4
    }
  }
];
