import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { auth, db, functions } from "../lib/firebase";
import type { AcademyMembership, UserProfile } from "../lib/types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  membership: AcademyMembership | null;
  loading: boolean;
  isRoot: boolean;
  isPreviewMode: boolean;
  canWriteAcademyData: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  const raw = userSnap.data() as Record<string, unknown>;
  return {
    email: String(raw.email ?? raw.mail ?? ""),
    displayName: String(raw.displayName ?? raw.name ?? ""),
    platformRole: (raw.platformRole ?? raw.role ?? "user") as UserProfile["platformRole"],
    active: Boolean(raw.active ?? true)
  };
}

function isMembershipActive(status: unknown) {
  const normalized = String(status ?? "").toLowerCase().trim();
  return normalized === "active" || normalized === "activo";
}

async function loadActiveMembership(uid: string, email?: string): Promise<AcademyMembership | null> {
  // Single-filter query avoids requiring a composite index for userId+status.
  const byUserIdQuery = query(collectionGroup(db, "users"), where("userId", "==", uid), limit(20));
  const byUserIdSnap = await getDocs(byUserIdQuery);
  let membershipDoc = byUserIdSnap.docs.find((docSnap) => isMembershipActive(docSnap.data().status));

  if (!membershipDoc && email) {
    const byEmailQuery = query(collectionGroup(db, "users"), where("email", "==", email.toLowerCase().trim()), limit(20));
    const byEmailSnap = await getDocs(byEmailQuery);
    membershipDoc = byEmailSnap.docs.find((docSnap) => isMembershipActive(docSnap.data().status));
  }
  if (!membershipDoc && email) {
    const byMailQuery = query(collectionGroup(db, "users"), where("mail", "==", email.toLowerCase().trim()), limit(20));
    const byMailSnap = await getDocs(byMailQuery);
    membershipDoc = byMailSnap.docs.find((docSnap) => isMembershipActive(docSnap.data().status));
  }

  if (!membershipDoc) return null;
  const academyRef = membershipDoc.ref.parent.parent;
  if (!academyRef) return null;
  const academySnap = await getDoc(academyRef);
  if (!academySnap.exists()) return null;
  const academyStatus = academySnap.data().status as string | undefined;
  if (academyStatus === "suspended") return null;
  const academyName = academySnap.exists() ? (academySnap.data().name as string) : academyRef.id;

  return {
    academyId: academyRef.id,
    academyName,
    ...(membershipDoc.data() as Omit<AcademyMembership, "academyId" | "academyName">),
    email: String(membershipDoc.data().email ?? membershipDoc.data().mail ?? email ?? "")
  };
}

async function trySyncOwnerMembership(): Promise<void> {
  const callable = httpsCallable(functions, "syncOwnerMembership");
  await callable();
}

async function trySyncMembershipByEmail(): Promise<void> {
  const callable = httpsCallable(functions, "syncMembershipByEmail");
  await callable();
}

async function resolveMembershipFromBackend(): Promise<AcademyMembership | null> {
  const callable = httpsCallable(functions, "resolveMyMembership");
  const result = await callable();
  const payload = result.data as { membership?: AcademyMembership | null };
  return payload.membership ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<AcademyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      try {
        const loadedProfile = await loadUserProfile(user.uid);
        setProfile(loadedProfile);

        if (!loadedProfile) {
          setMembership(null);
        } else if (loadedProfile.platformRole === "root") {
          setMembership(null);
        } else {
          let activeMembership: AcademyMembership | null = null;
          try {
            activeMembership = await resolveMembershipFromBackend();
          } catch {
            activeMembership = null;
          }
          if (!activeMembership) {
            activeMembership = await loadActiveMembership(user.uid, user.email ?? undefined);
          }
          if (!activeMembership) {
            try {
              await trySyncOwnerMembership();
              activeMembership = await loadActiveMembership(user.uid, user.email ?? undefined);
            } catch {
              // No-op: fallback to no membership view.
            }
          }
          if (!activeMembership) {
            try {
              await trySyncMembershipByEmail();
              activeMembership = await loadActiveMembership(user.uid, user.email ?? undefined);
            } catch {
              // No-op: fallback to no membership view.
            }
          }
          setMembership(activeMembership);
        }
      } catch {
        setMembership(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      membership,
      loading,
      isRoot: profile?.platformRole === "root",
      isPreviewMode: false,
      canWriteAcademyData: membership?.role === "owner" || membership?.role === "staff",
      logout: () => signOut(auth)
    }),
    [firebaseUser, profile, membership, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
