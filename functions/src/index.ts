import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

type Plan = "basic" | "pro" | "premium";
type AcademyRole = "owner" | "staff" | "viewer";
type PlanSettings = {
  maxStudents: number | null;
};

interface CreateAcademyPayload {
  academyName: string;
  plan: Plan;
  ownerName: string;
  ownerEmail: string;
  ownerRole: AcademyRole;
  password?: string;
}

interface CreateAcademyUserPayload {
  academyId: string;
  displayName: string;
  email: string;
  role: AcademyRole;
  password?: string;
}

interface RegisterAcademyPayload {
  academyName: string;
  plan: Plan;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
}

interface PlatformSettings {
  trialDurationDays: number;
  plans: Record<Plan, PlanSettings>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function randomPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return output;
}

function maxStudentsByPlan(plan: Plan): number | null {
  if (plan === "basic") return 50;
  if (plan === "pro") return 100;
  return null;
}

function defaultPlatformSettings(): PlatformSettings {
  return {
    trialDurationDays: 15,
    plans: {
      basic: { maxStudents: 50 },
      pro: { maxStudents: 100 },
      premium: { maxStudents: null }
    }
  };
}

async function loadPlatformSettings(): Promise<PlatformSettings> {
  const defaults = defaultPlatformSettings();
  const configSnap = await db.doc("platform/config").get();
  if (!configSnap.exists) return defaults;

  const data = configSnap.data() as {
    trialDurationDays?: unknown;
    plans?: Partial<Record<Plan, { maxStudents?: unknown }>>;
  };

  return {
    trialDurationDays:
      typeof data.trialDurationDays === "number" && Number.isFinite(data.trialDurationDays)
        ? Math.max(1, Math.round(data.trialDurationDays))
        : defaults.trialDurationDays,
    plans: {
      basic: {
        maxStudents:
          data.plans?.basic?.maxStudents === null
            ? null
            : typeof data.plans?.basic?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.basic.maxStudents))
              : defaults.plans.basic.maxStudents
      },
      pro: {
        maxStudents:
          data.plans?.pro?.maxStudents === null
            ? null
            : typeof data.plans?.pro?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.pro.maxStudents))
              : defaults.plans.pro.maxStudents
      },
      premium: {
        maxStudents:
          data.plans?.premium?.maxStudents === null
            ? null
            : typeof data.plans?.premium?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.premium.maxStudents))
              : defaults.plans.premium.maxStudents
      }
    }
  };
}

function validatePayload(data: unknown): CreateAcademyPayload {
  if (!data || typeof data !== "object") throw new HttpsError("invalid-argument", "Payload inválido.");
  const payload = data as Partial<CreateAcademyPayload>;
  const planValues: Plan[] = ["basic", "pro", "premium"];
  const roleValues: AcademyRole[] = ["owner", "staff", "viewer"];

  if (!payload.academyName?.trim()) throw new HttpsError("invalid-argument", "academyName es requerido.");
  if (!payload.ownerName?.trim()) throw new HttpsError("invalid-argument", "ownerName es requerido.");
  if (!payload.ownerEmail?.trim()) throw new HttpsError("invalid-argument", "ownerEmail es requerido.");
  if (!payload.plan || !planValues.includes(payload.plan)) throw new HttpsError("invalid-argument", "plan inválido.");
  if (!payload.ownerRole || !roleValues.includes(payload.ownerRole)) {
    throw new HttpsError("invalid-argument", "ownerRole inválido.");
  }
  return {
    academyName: payload.academyName.trim(),
    plan: payload.plan,
    ownerName: payload.ownerName.trim(),
    ownerEmail: payload.ownerEmail.trim().toLowerCase(),
    ownerRole: payload.ownerRole,
    password: payload.password?.trim()
  };
}

function validateCreateAcademyUserPayload(data: unknown): CreateAcademyUserPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Payload invalido.");
  }

  const payload = data as Partial<CreateAcademyUserPayload>;
  const roleValues: AcademyRole[] = ["owner", "staff", "viewer"];
  const academyId = payload.academyId?.trim() ?? "";
  const displayName = payload.displayName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password?.trim();

  if (!academyId) throw new HttpsError("invalid-argument", "academyId es requerido.");
  if (!displayName) throw new HttpsError("invalid-argument", "displayName es requerido.");
  if (!email) throw new HttpsError("invalid-argument", "email es requerido.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError("invalid-argument", "email invalido.");
  if (!payload.role || !roleValues.includes(payload.role)) {
    throw new HttpsError("invalid-argument", "role invalido.");
  }
  if (password && password.length < 6) {
    throw new HttpsError("invalid-argument", "La password debe tener al menos 6 caracteres.");
  }

  return {
    academyId,
    displayName,
    email,
    role: payload.role,
    password
  };
}

function validateRegisterAcademyPayload(data: unknown): RegisterAcademyPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Payload invalido.");
  }

  const payload = data as Partial<RegisterAcademyPayload>;
  const planValues: Plan[] = ["basic", "pro", "premium"];
  const academyName = payload.academyName?.trim() ?? "";
  const ownerName = payload.ownerName?.trim() ?? "";
  const ownerEmail = payload.ownerEmail?.trim().toLowerCase() ?? "";
  const ownerPhone = normalizeInternationalWhatsApp(payload.ownerPhone);
  const password = payload.password?.trim() ?? "";

  if (!academyName) throw new HttpsError("invalid-argument", "academyName es requerido.");
  if (!ownerName) throw new HttpsError("invalid-argument", "ownerName es requerido.");
  if (!ownerEmail) throw new HttpsError("invalid-argument", "ownerEmail es requerido.");
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    throw new HttpsError("invalid-argument", "ownerEmail invalido.");
  }
  if (!payload.plan || !planValues.includes(payload.plan)) {
    throw new HttpsError("invalid-argument", "plan invalido.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "La password debe tener al menos 6 caracteres.");
  }

  return {
    academyName,
    ownerName,
    ownerEmail,
    ownerPhone,
    plan: payload.plan,
    password
  };
}

function normalizeInternationalWhatsApp(value: unknown) {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) {
    throw new HttpsError("invalid-argument", "ownerPhone es requerido.");
  }

  const normalizedValue = rawValue.replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedValue)) {
    throw new HttpsError("invalid-argument", "ownerPhone invalido.");
  }

  return normalizedValue;
}

const callableOptions = {
  region: "us-central1" as const,
  cors: true,
  invoker: "public" as const
};

export const createAcademyWithOwner = onCall(callableOptions, async (request) => {
  logger.info("createAcademyWithOwner called", {
    hasAuth: Boolean(request.auth?.uid),
    callerUid: request.auth?.uid ?? null,
    callerEmail: request.auth?.token?.email ?? null
  });

  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const callerData = callerSnap.data();
  const callerRole = callerData?.platformRole ?? callerData?.role;
  logger.info("caller profile loaded", {
    callerExists: callerSnap.exists,
    callerRole: callerRole ?? null
  });
  if (!callerSnap.exists || callerRole !== "root") {
    logger.error("permission denied in createAcademyWithOwner", {
      callerUid: request.auth.uid,
      callerRole: callerRole ?? null
    });
    throw new HttpsError("permission-denied", "Solo root puede crear academias.");
  }

  const payload = validatePayload(request.data);
  logger.info("payload validated", {
    academyName: payload.academyName,
    ownerEmail: payload.ownerEmail,
    plan: payload.plan,
    ownerRole: payload.ownerRole
  });
  let ownerUid = "";
  let generatedPassword: string | null = null;
  let isExistingUser = false;

  try {
    const existingUser = await adminAuth.getUserByEmail(payload.ownerEmail);
    ownerUid = existingUser.uid;
    isExistingUser = true;
    const updatePayload: { displayName: string; password?: string } = {
      displayName: payload.ownerName,
    };
    if (payload.password) updatePayload.password = payload.password;
    await adminAuth.updateUser(ownerUid, updatePayload);
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code !== "auth/user-not-found") {
      logger.error("owner lookup failed", {
        code: authError.code ?? "unknown",
        ownerEmail: payload.ownerEmail
      });
      throw new HttpsError("internal", "No se pudo validar el usuario owner.");
    }
    generatedPassword = payload.password || randomPassword();
    try {
      const created = await adminAuth.createUser({
        email: payload.ownerEmail,
        displayName: payload.ownerName,
        password: generatedPassword
      });
      ownerUid = created.uid;
    } catch (createError) {
      const authCreateError = createError as { code?: string; message?: string };
      logger.error("owner creation failed", {
        code: authCreateError.code ?? "unknown",
        message: authCreateError.message ?? "unknown",
        ownerEmail: payload.ownerEmail
      });
      throw new HttpsError("internal", "No se pudo crear el usuario owner en Authentication.");
    }
  }

  const academyRef = db.collection("academies").doc();
  const slugBase = slugify(payload.academyName);
  const slug = `${slugBase}-${academyRef.id.slice(0, 6)}`;
  const platformSettings = await loadPlatformSettings();
  const now = Timestamp.now();
  const trialEndsAt = Timestamp.fromMillis(
    now.toMillis() + platformSettings.trialDurationDays * 24 * 60 * 60 * 1000
  );

  const batch = db.batch();
  batch.set(
    db.doc(`users/${ownerUid}`),
    {
      email: payload.ownerEmail,
      displayName: payload.ownerName,
      platformRole: "user",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  batch.set(academyRef, {
    name: payload.academyName,
    slug,
    plan: payload.plan,
    status: "trial",
    owner: {
      uid: ownerUid,
      name: payload.ownerName,
      email: payload.ownerEmail
    },
    planLimits: {
      maxStudents: platformSettings.plans[payload.plan].maxStudents ?? maxStudentsByPlan(payload.plan)
    },
    counters: {
      students: 0,
      fees: 0,
      payments: 0
    },
    trial: {
      active: true,
      startedAt: now,
      endsAt: trialEndsAt
    },
    subscription: {
      active: false,
      mrr: 0
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc(`academies/${academyRef.id}/users/${ownerUid}`), {
    userId: ownerUid,
    email: payload.ownerEmail,
    role: payload.ownerRole,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  try {
    await batch.commit();
  } catch (batchError) {
    const firestoreError = batchError as { message?: string };
    logger.error("academy batch commit failed", {
      message: firestoreError.message ?? "unknown",
      academyName: payload.academyName,
      ownerUid
    });
    throw new HttpsError("internal", "No se pudo guardar la academia en Firestore.");
  }
  logger.info("academy created successfully", {
    academyId: academyRef.id,
    ownerUid,
    isExistingUser
  });

  return {
    academyId: academyRef.id,
    ownerUid,
    generatedPassword,
    isExistingUser
  };
});

export const syncOwnerMembership = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const uid = request.auth.uid;
  const authEmail = String(request.auth.token.email ?? "").toLowerCase().trim();
  if (!authEmail) throw new HttpsError("failed-precondition", "La cuenta no tiene email.");

  const [byOwnerObject, byOwnerEmail] = await Promise.all([
    db.collection("academies").where("owner.email", "==", authEmail).get(),
    db.collection("academies").where("ownerEmail", "==", authEmail).get()
  ]);

  const map = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  byOwnerObject.docs.forEach((docSnap) => map.set(docSnap.id, docSnap));
  byOwnerEmail.docs.forEach((docSnap) => map.set(docSnap.id, docSnap));

  const academies = Array.from(map.values());
  if (academies.length === 0) {
    return { synced: 0 };
  }

  const batch = db.batch();
  const userDocRef = db.doc(`users/${uid}`);
  const userDocSnap = await userDocRef.get();
  const existingRole = userDocSnap.data()?.platformRole ?? userDocSnap.data()?.role ?? "user";

  batch.set(
    userDocRef,
    {
      email: authEmail,
      displayName: request.auth.token.name ?? "",
      platformRole: existingRole === "root" ? "root" : "user",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: userDocSnap.exists ? userDocSnap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  academies.forEach((academySnap) => {
    const academy = academySnap.data() as { status?: string };
    const membershipStatus = academy.status === "suspended" ? "suspended" : "active";
    batch.set(
      db.doc(`academies/${academySnap.id}/users/${uid}`),
      {
        userId: uid,
        email: authEmail,
        role: "owner",
        status: membershipStatus,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await batch.commit();
  return { synced: academies.length };
});

export const registerAcademy = onCall(callableOptions, async (request) => {
  const payload = validateRegisterAcademyPayload(request.data);

  try {
    await adminAuth.getUserByEmail(payload.ownerEmail);
    throw new HttpsError("already-exists", "Ese email ya existe en Firebase Authentication.");
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code && authError.code !== "auth/user-not-found") {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "No se pudo validar el email del owner.");
    }
  }

  const academyRef = db.collection("academies").doc();
  const slugBase = slugify(payload.academyName);
  const slug = `${slugBase}-${academyRef.id.slice(0, 6)}`;
  const platformSettings = await loadPlatformSettings();
  const now = Timestamp.now();
  const trialEndsAt = Timestamp.fromMillis(
    now.toMillis() + platformSettings.trialDurationDays * 24 * 60 * 60 * 1000
  );

  let ownerUid = "";

  try {
    const createdUser = await adminAuth.createUser({
      email: payload.ownerEmail,
      displayName: payload.ownerName,
      password: payload.password
    });
    ownerUid = createdUser.uid;

    const batch = db.batch();
    batch.set(
      db.doc(`users/${ownerUid}`),
      {
        email: payload.ownerEmail,
        displayName: payload.ownerName,
        phone: payload.ownerPhone,
        platformRole: "user",
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    batch.set(academyRef, {
      name: payload.academyName,
      slug,
      plan: payload.plan,
      status: "trial",
      owner: {
        uid: ownerUid,
        name: payload.ownerName,
        email: payload.ownerEmail,
        phone: payload.ownerPhone
      },
      planLimits: {
        maxStudents: platformSettings.plans[payload.plan].maxStudents ?? maxStudentsByPlan(payload.plan)
      },
      counters: {
        students: 0,
        fees: 0,
        payments: 0
      },
      trial: {
        active: true,
        startedAt: now,
        endsAt: trialEndsAt
      },
      subscription: {
        active: false,
        mrr: 0
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.set(db.doc(`academies/${academyRef.id}/users/${ownerUid}`), {
      userId: ownerUid,
      email: payload.ownerEmail,
      displayName: payload.ownerName,
      role: "owner",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    logger.info("academy registered successfully", {
      academyId: academyRef.id,
      ownerUid,
      ownerEmail: payload.ownerEmail,
      plan: payload.plan
    });

    return {
      academyId: academyRef.id,
      ownerUid,
      trialDurationDays: platformSettings.trialDurationDays
    };
  } catch (error) {
    if (ownerUid) {
      try {
        await adminAuth.deleteUser(ownerUid);
      } catch (cleanupError) {
        logger.error("registerAcademy cleanup failed", {
          ownerUid,
          error: cleanupError
        });
      }
    }

    if (error instanceof HttpsError) throw error;

    const authError = error as { code?: string; message?: string };
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Ese email ya existe en Firebase Authentication.");
    }
    if (authError.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "El email ingresado no es valido.");
    }
    if (authError.code === "auth/invalid-password" || authError.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "La password es demasiado debil.");
    }

    logger.error("registerAcademy failed", {
      academyName: payload.academyName,
      ownerEmail: payload.ownerEmail,
      code: authError.code ?? "unknown",
      message: authError.message ?? "unknown"
    });
    throw new HttpsError("internal", "No se pudo registrar la academia.");
  }
});

export const createAcademyUser = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesion.");

  const payload = validateCreateAcademyUserPayload(request.data);
  const academyRef = db.doc(`academies/${payload.academyId}`);
  const callerMembershipRef = db.doc(`academies/${payload.academyId}/users/${request.auth.uid}`);

  const [academySnap, callerMembershipSnap] = await Promise.all([academyRef.get(), callerMembershipRef.get()]);
  if (!academySnap.exists) {
    throw new HttpsError("not-found", "La academia indicada no existe.");
  }

  const academyStatus = String(academySnap.data()?.status ?? "").toLowerCase();
  if (academyStatus === "suspended") {
    throw new HttpsError("failed-precondition", "La academia esta suspendida.");
  }

  if (!callerMembershipSnap.exists) {
    throw new HttpsError("permission-denied", "Solo el owner puede crear usuarios.");
  }

  const callerMembership = callerMembershipSnap.data() as { role?: string; status?: string };
  if (callerMembership.role !== "owner" || callerMembership.status !== "active") {
    throw new HttpsError("permission-denied", "Solo el owner activo puede crear usuarios.");
  }

  try {
    await adminAuth.getUserByEmail(payload.email);
    throw new HttpsError("already-exists", "Ese email ya existe en Firebase Authentication.");
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code && authError.code !== "auth/user-not-found") {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "No se pudo validar el email del usuario.");
    }
  }

  const generatedPassword = payload.password || randomPassword();
  let createdUserUid = "";

  try {
    const createdUser = await adminAuth.createUser({
      email: payload.email,
      displayName: payload.displayName,
      password: generatedPassword
    });
    createdUserUid = createdUser.uid;

    const batch = db.batch();
    batch.set(
      db.doc(`users/${createdUserUid}`),
      {
        email: payload.email,
        displayName: payload.displayName,
        platformRole: "user",
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    batch.set(
      db.doc(`academies/${payload.academyId}/users/${createdUserUid}`),
      {
        userId: createdUserUid,
        email: payload.email,
        displayName: payload.displayName,
        role: payload.role,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }
    );

    await batch.commit();

    return {
      uid: createdUserUid,
      email: payload.email,
      generatedPassword: payload.password ? null : generatedPassword
    };
  } catch (error) {
    if (createdUserUid) {
      try {
        await adminAuth.deleteUser(createdUserUid);
      } catch (cleanupError) {
        logger.error("createAcademyUser cleanup failed", {
          uid: createdUserUid,
          error: cleanupError
        });
      }
    }

    if (error instanceof HttpsError) throw error;

    const authError = error as { code?: string; message?: string };
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Ese email ya existe en Firebase Authentication.");
    }
    if (authError.code === "auth/invalid-password" || authError.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "La password es demasiado debil.");
    }
    if (authError.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "El email ingresado no es valido.");
    }

    logger.error("createAcademyUser failed", {
      academyId: payload.academyId,
      callerUid: request.auth.uid,
      code: authError.code ?? "unknown",
      message: authError.message ?? "unknown"
    });
    throw new HttpsError("internal", "No se pudo crear el usuario.");
  }
});

export const syncMembershipByEmail = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const uid = request.auth.uid;
  const authEmail = String(request.auth.token.email ?? "").toLowerCase().trim();
  if (!authEmail) throw new HttpsError("failed-precondition", "La cuenta no tiene email.");

  const matches = await db.collectionGroup("users").where("email", "==", authEmail).limit(50).get();
  if (matches.empty) return { synced: 0 };

  const batch = db.batch();
  matches.docs.forEach((membershipDoc) => {
    const academyRef = membershipDoc.ref.parent.parent;
    if (!academyRef) return;
    const data = membershipDoc.data() as { role?: string; status?: string };
    batch.set(
      db.doc(`academies/${academyRef.id}/users/${uid}`),
      {
        userId: uid,
        email: authEmail,
        role: data.role ?? "owner",
        status: data.status ?? "active",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  batch.set(
    db.doc(`users/${uid}`),
    {
      email: authEmail,
      displayName: request.auth.token.name ?? "",
      platformRole: "user",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();
  return { synced: matches.size };
});

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").toLowerCase().trim();
  if (status === "activo") return "active";
  return status;
}

export const resolveMyMembership = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const uid = request.auth.uid;
  const email = String(request.auth.token.email ?? "").toLowerCase().trim();
  if (!email) throw new HttpsError("failed-precondition", "La cuenta no tiene email.");

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentRole = userSnap.data()?.platformRole ?? userSnap.data()?.role ?? "user";
  await userRef.set(
    {
      email,
      displayName: request.auth.token.name ?? "",
      platformRole: currentRole === "root" ? "root" : "user",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const membershipCandidates = new Map<string, { role: string; status: string }>();

  const [byUserId, byEmail, byMail, academyByOwnerEmail, academyByOwnerRoot] = await Promise.all([
    db.collectionGroup("users").where("userId", "==", uid).limit(50).get(),
    db.collectionGroup("users").where("email", "==", email).limit(50).get(),
    db.collectionGroup("users").where("mail", "==", email).limit(50).get(),
    db.collection("academies").where("ownerEmail", "==", email).limit(50).get(),
    db.collection("academies").where("owner.email", "==", email).limit(50).get()
  ]);

  const registerMembership = (academyId: string, role?: unknown, status?: unknown) => {
    membershipCandidates.set(academyId, {
      role: String(role ?? membershipCandidates.get(academyId)?.role ?? "owner"),
      status: normalizeStatus(status ?? membershipCandidates.get(academyId)?.status ?? "active")
    });
  };

  byUserId.docs.forEach((snap) => {
    const academyRef = snap.ref.parent.parent;
    if (!academyRef) return;
    registerMembership(academyRef.id, snap.data().role, snap.data().status);
  });
  byEmail.docs.forEach((snap) => {
    const academyRef = snap.ref.parent.parent;
    if (!academyRef) return;
    registerMembership(academyRef.id, snap.data().role, snap.data().status);
  });
  byMail.docs.forEach((snap) => {
    const academyRef = snap.ref.parent.parent;
    if (!academyRef) return;
    registerMembership(academyRef.id, snap.data().role, snap.data().status);
  });
  academyByOwnerEmail.docs.forEach((snap) => registerMembership(snap.id, "owner", "active"));
  academyByOwnerRoot.docs.forEach((snap) => registerMembership(snap.id, "owner", "active"));

  if (membershipCandidates.size === 0) {
    return { membership: null, repaired: 0 };
  }

  const batch = db.batch();
  let repaired = 0;
  for (const [academyId, data] of membershipCandidates.entries()) {
    const academySnap = await db.doc(`academies/${academyId}`).get();
    if (!academySnap.exists) continue;
    const academyStatus = String(academySnap.data()?.status ?? "active").toLowerCase();
    const status = academyStatus === "suspended" ? "suspended" : data.status || "active";
    batch.set(
      db.doc(`academies/${academyId}/users/${uid}`),
      {
        userId: uid,
        email,
        role: data.role || "owner",
        status,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    repaired += 1;
  }
  await batch.commit();

  const normalizedMembership = await db
    .collectionGroup("users")
    .where("userId", "==", uid)
    .limit(50)
    .get();

  const activeDoc = normalizedMembership.docs.find((snap) => {
    const academyRef = snap.ref.parent.parent;
    if (!academyRef) return false;
    const status = normalizeStatus(snap.data().status);
    return status === "active";
  });

  if (!activeDoc) return { membership: null, repaired };
  const academyRef = activeDoc.ref.parent.parent;
  if (!academyRef) return { membership: null, repaired };
  const academySnap = await academyRef.get();
  if (!academySnap.exists) return { membership: null, repaired };
  if (String(academySnap.data()?.status ?? "").toLowerCase() === "suspended") {
    return { membership: null, repaired };
  }

  return {
    repaired,
    membership: {
      academyId: academyRef.id,
      academyName: String(academySnap.data()?.name ?? academyRef.id),
      userId: uid,
      email,
      role: String(activeDoc.data().role ?? "owner"),
      status: "active"
    }
  };
});
