import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { auth, db } from "../lib/firebase";
import { DEFAULT_PLATFORM_CONFIG, normalizePlatformConfig } from "../lib/plans";
import { isTrialExpired } from "../lib/trial";
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
const SESSION_IDLE_MINUTES = Math.max(1, Number(import.meta.env.VITE_SESSION_IDLE_MINUTES ?? "30"));
const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_MINUTES * 60 * 1000;
let platformConfigCachePromise: Promise<ReturnType<typeof normalizePlatformConfig>> | null = null;

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

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const fallbackProfile: UserProfile = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    platformRole: "user",
    active: true
  };

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: fallbackProfile.email,
      displayName: fallbackProfile.displayName,
      platformRole: "user",
      active: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  return fallbackProfile;
}

async function loadPlatformConfigCached() {
  if (!platformConfigCachePromise) {
    platformConfigCachePromise = getDoc(doc(db, "platform", "config")).then((configSnap) =>
      normalizePlatformConfig(configSnap.exists() ? configSnap.data() : DEFAULT_PLATFORM_CONFIG)
    );
  }

  return platformConfigCachePromise;
}

async function safeGetDocs<T>(promise: Promise<T>) {
  try {
    return await promise;
  } catch (error) {
    console.warn("PaySync auth lookup fallback", error);
    return null;
  }
}

function isMembershipActive(status: unknown) {
  const normalized = String(status ?? "").toLowerCase().trim();
  return normalized === "active" || normalized === "activo";
}

async function loadActiveMembership(uid: string, email?: string): Promise<AcademyMembership | null> {
  const normalizedEmail = email?.toLowerCase().trim();
  const ownerByUidQuery = query(collection(db, "academies"), where("owner.uid", "==", uid), limit(5));
  const ownerByEmailQuery = normalizedEmail
    ? query(collection(db, "academies"), where("owner.email", "==", normalizedEmail), limit(5))
    : null;
  const byUserIdQuery = query(collectionGroup(db, "users"), where("userId", "==", uid), limit(20));
  const byEmailQuery = normalizedEmail
    ? query(collectionGroup(db, "users"), where("email", "==", normalizedEmail), limit(20))
    : null;
  const byMailQuery = normalizedEmail
    ? query(collectionGroup(db, "users"), where("mail", "==", normalizedEmail), limit(20))
    : null;

  const platformConfig = await loadPlatformConfigCached();
  const ownerByUidSnap = await safeGetDocs(getDocs(ownerByUidQuery));
  const ownerByEmailSnap = ownerByEmailQuery ? await safeGetDocs(getDocs(ownerByEmailQuery)) : null;

  let ownerAcademyDoc = ownerByUidSnap?.docs.find((docSnap) => docSnap.data().status !== "suspended");

  if (!ownerAcademyDoc && ownerByEmailSnap) {
    ownerAcademyDoc = ownerByEmailSnap.docs.find((docSnap) => docSnap.data().status !== "suspended");
  }

  if (ownerAcademyDoc) {
    const ownerData = ownerAcademyDoc.data() as Record<string, unknown>;
    const ownerAcademy = ownerData as {
      createdAt?: unknown;
      trial?: { active?: boolean; startedAt?: unknown; endsAt?: unknown };
    };
    if (
      String(ownerData.status ?? "").toLowerCase() === "trial" &&
      isTrialExpired(ownerAcademy, platformConfig.trialDurationDays)
    ) {
      await updateDoc(doc(db, "academies", ownerAcademyDoc.id), {
        status: "suspended",
        trial: {
          ...(ownerData.trial as Record<string, unknown> | undefined),
          active: false
        },
        updatedAt: serverTimestamp()
      });
      return null;
    }

    void setDoc(
      doc(db, `academies/${ownerAcademyDoc.id}/users/${uid}`),
      {
        userId: uid,
        email: normalizedEmail ?? String(ownerData.ownerEmail ?? ""),
        role: "owner",
        status: "active",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    return {
      academyId: ownerAcademyDoc.id,
      academyName: String(ownerData.name ?? ownerAcademyDoc.id),
      userId: uid,
      email: normalizedEmail ?? "",
      role: "owner",
      status: "active"
    };
  }

  const byUserIdSnap = await safeGetDocs(getDocs(byUserIdQuery));
  const byEmailSnap = byEmailQuery ? await safeGetDocs(getDocs(byEmailQuery)) : null;
  const byMailSnap = byMailQuery ? await safeGetDocs(getDocs(byMailQuery)) : null;

  let membershipDoc = byUserIdSnap?.docs.find((docSnap) => isMembershipActive(docSnap.data().status));

  if (!membershipDoc && byEmailSnap) {
    membershipDoc = byEmailSnap.docs.find((docSnap) => isMembershipActive(docSnap.data().status));
  }
  if (!membershipDoc && byMailSnap) {
    membershipDoc = byMailSnap.docs.find((docSnap) => isMembershipActive(docSnap.data().status));
  }

  if (!membershipDoc) return null;
  const academyRef = membershipDoc.ref.parent.parent;
  if (!academyRef) return null;
  const academySnap = await getDoc(academyRef);
  if (!academySnap.exists()) return null;
  const academyData = academySnap.data() as Record<string, unknown>;
  const academyTrialData = academyData as {
    createdAt?: unknown;
    trial?: { active?: boolean; startedAt?: unknown; endsAt?: unknown };
  };
  if (
    String(academyData.status ?? "").toLowerCase() === "trial" &&
    isTrialExpired(academyTrialData, platformConfig.trialDurationDays)
  ) {
    await updateDoc(academyRef, {
      status: "suspended",
      trial: {
        ...(academyData.trial as Record<string, unknown> | undefined),
        active: false
      },
      updatedAt: serverTimestamp()
    });
    return null;
  }

  const academyStatus = academyData.status as string | undefined;
  if (academyStatus === "suspended") return null;
  const academyName = academySnap.exists() ? (academyData.name as string) : academyRef.id;

  return {
    academyId: academyRef.id,
    academyName,
    ...(membershipDoc.data() as Omit<AcademyMembership, "academyId" | "academyName">),
    email: String(membershipDoc.data().email ?? membershipDoc.data().mail ?? email ?? "")
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<AcademyMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimeoutRef = useRef<number | null>(null);

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
        const effectiveProfile = loadedProfile ?? (await ensureUserProfile(user));
        setProfile(effectiveProfile);

        if (effectiveProfile.platformRole === "root") {
          setMembership(null);
        } else {
          const activeMembership = await loadActiveMembership(user.uid, user.email ?? undefined);
          setMembership(activeMembership);
        }
      } catch {
        setMembership(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      idleTimeoutRef.current = window.setTimeout(() => {
        void signOut(auth);
      }, SESSION_IDLE_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [firebaseUser]);

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
