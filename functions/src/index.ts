import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { timingSafeEqual } from "node:crypto";

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

type Plan = "basic" | "pro" | "premium";
type AcademyRole = "owner" | "staff" | "viewer";
type PlanSettings = {
  label: string;
  price: number;
  maxStudents: number | null;
  description: string;
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

interface DeleteAcademyPayload {
  academyId: string;
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

interface CreateMercadoPagoCheckoutPayload {
  academyId: string;
  plan: Plan;
  origin: string;
}

interface MercadoPagoPreferenceResponse {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MercadoPagoPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  date_created?: string | null;
  external_reference?: string;
  metadata?: {
    academyId?: string;
    plan?: Plan;
    checkoutSessionId?: string;
  };
}

interface MercadoPagoPaymentSearchResponse {
  results?: MercadoPagoPaymentResponse[];
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
      basic: {
        label: "Basico",
        price: 49,
        maxStudents: 50,
        description: "Ideal para centros que estan empezando y necesitan una base simple."
      },
      pro: {
        label: "Pro",
        price: 99,
        maxStudents: 100,
        description: "Pensado para organizaciones en crecimiento con mas alumnos y operacion diaria."
      },
      premium: {
        label: "Premium",
        price: 199,
        maxStudents: null,
        description: "Para academias con mayor volumen, equipo ampliado y necesidad de escalar."
      }
    }
  };
}

async function loadPlatformSettings(): Promise<PlatformSettings> {
  const defaults = defaultPlatformSettings();
  const configSnap = await db.doc("platform/config").get();
  if (!configSnap.exists) return defaults;

  const data = configSnap.data() as {
    trialDurationDays?: unknown;
    plans?: Partial<Record<Plan, { label?: unknown; price?: unknown; maxStudents?: unknown; description?: unknown }>>;
  };

  return {
    trialDurationDays:
      typeof data.trialDurationDays === "number" && Number.isFinite(data.trialDurationDays)
        ? Math.max(1, Math.round(data.trialDurationDays))
        : defaults.trialDurationDays,
    plans: {
      basic: {
        label: String(data.plans?.basic?.label ?? defaults.plans.basic.label).trim() || defaults.plans.basic.label,
        price:
          typeof data.plans?.basic?.price === "number" && Number.isFinite(data.plans.basic.price)
            ? Math.max(0, Math.round(data.plans.basic.price))
            : defaults.plans.basic.price,
        maxStudents:
          data.plans?.basic?.maxStudents === null
            ? null
            : typeof data.plans?.basic?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.basic.maxStudents))
              : defaults.plans.basic.maxStudents,
        description:
          String(data.plans?.basic?.description ?? defaults.plans.basic.description).trim() ||
          defaults.plans.basic.description
      },
      pro: {
        label: String(data.plans?.pro?.label ?? defaults.plans.pro.label).trim() || defaults.plans.pro.label,
        price:
          typeof data.plans?.pro?.price === "number" && Number.isFinite(data.plans.pro.price)
            ? Math.max(0, Math.round(data.plans.pro.price))
            : defaults.plans.pro.price,
        maxStudents:
          data.plans?.pro?.maxStudents === null
            ? null
            : typeof data.plans?.pro?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.pro.maxStudents))
              : defaults.plans.pro.maxStudents,
        description:
          String(data.plans?.pro?.description ?? defaults.plans.pro.description).trim() ||
          defaults.plans.pro.description
      },
      premium: {
        label: String(data.plans?.premium?.label ?? defaults.plans.premium.label).trim() || defaults.plans.premium.label,
        price:
          typeof data.plans?.premium?.price === "number" && Number.isFinite(data.plans.premium.price)
            ? Math.max(0, Math.round(data.plans.premium.price))
            : defaults.plans.premium.price,
        maxStudents:
          data.plans?.premium?.maxStudents === null
            ? null
            : typeof data.plans?.premium?.maxStudents === "number"
              ? Math.max(1, Math.round(data.plans.premium.maxStudents))
              : defaults.plans.premium.maxStudents,
        description:
          String(data.plans?.premium?.description ?? defaults.plans.premium.description).trim() ||
          defaults.plans.premium.description
      }
    }
  };
}

function validateCreateMercadoPagoCheckoutPayload(data: unknown): CreateMercadoPagoCheckoutPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Payload invalido.");
  }

  const payload = data as Partial<CreateMercadoPagoCheckoutPayload>;
  const planValues: Plan[] = ["basic", "pro", "premium"];
  const academyId = payload.academyId?.trim() ?? "";
  const origin = payload.origin?.trim() ?? "";

  if (!academyId) throw new HttpsError("invalid-argument", "academyId es requerido.");
  if (!payload.plan || !planValues.includes(payload.plan)) {
    throw new HttpsError("invalid-argument", "plan invalido.");
  }
  if (!/^https?:\/\/[^/]+/i.test(origin)) {
    throw new HttpsError("invalid-argument", "origin invalido.");
  }

  return {
    academyId,
    plan: payload.plan,
    origin: origin.replace(/\/+$/, "")
  };
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new HttpsError("failed-precondition", `Falta configurar ${name}.`);
  }
  return value;
}

function safeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function getCurrentPeriodFromDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function shouldEnableMercadoPagoAutoReturn(origin: string) {
  try {
    const parsedOrigin = new URL(origin);
    return !["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

function buildMercadoPagoWebhookUrl(baseUrl: string, checkoutSessionId: string) {
  const webhookToken = getRequiredEnv("MERCADO_PAGO_WEBHOOK_TOKEN");
  const webhookUrl = new URL(baseUrl);
  webhookUrl.searchParams.set("source", "mercado_pago");
  webhookUrl.searchParams.set("checkout_session_id", checkoutSessionId);
  webhookUrl.searchParams.set("token", webhookToken);
  return webhookUrl.toString();
}

function normalizeMercadoPagoCheckoutStatus(payment: MercadoPagoPaymentResponse, amountMatches: boolean, currencyMatches: boolean) {
  if (payment.status !== "approved") {
    if (payment.status === "rejected" || payment.status === "cancelled") return "failed";
    return "pending";
  }
  if (!amountMatches || !currencyMatches) {
    return "validation_failed";
  }
  return "approved";
}

function shouldClearPendingPlan(checkoutStatus: string, paymentStatus: string | undefined) {
  return checkoutStatus === "validation_failed" || paymentStatus === "rejected" || paymentStatus === "cancelled";
}

async function mercadoPagoRequest<T>(path: string, init: RequestInit) {
  const accessToken = getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error("Mercado Pago request failed", {
      path,
      status: response.status,
      responseText
    });
    throw new HttpsError("internal", "No se pudo completar la operacion con Mercado Pago.");
  }

  return (await response.json()) as T;
}

async function findMercadoPagoPaymentByExternalReference(externalReference: string) {
  const response = await mercadoPagoRequest<MercadoPagoPaymentSearchResponse>(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=1`,
    { method: "GET" }
  );
  return response.results?.[0] ?? null;
}

function parseCheckoutReference(externalReference: string | undefined, payment: MercadoPagoPaymentResponse) {
  const metadata = payment.metadata ?? {};
  const [academyIdFromReference = "", planFromReference = "", checkoutSessionIdFromReference = ""] =
    String(externalReference ?? "").split(":");

  return {
    academyId: String(metadata.academyId ?? academyIdFromReference).trim(),
    plan: String(metadata.plan ?? planFromReference).trim() as Plan,
    checkoutSessionId: String(metadata.checkoutSessionId ?? checkoutSessionIdFromReference).trim()
  };
}

async function applyApprovedMercadoPagoPayment(paymentId: string) {
  const payment = await mercadoPagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`, {
    method: "GET"
  });

  const { academyId, plan, checkoutSessionId } = parseCheckoutReference(payment.external_reference, payment);
  if (!academyId || !checkoutSessionId || !["basic", "pro", "premium"].includes(plan)) {
    logger.warn("Mercado Pago payment without valid reference", {
      paymentId,
      externalReference: payment.external_reference,
      metadata: payment.metadata ?? null
    });
    return;
  }

  const academyRef = db.doc(`academies/${academyId}`);
  const checkoutRef = academyRef.collection("billingCheckoutSessions").doc(checkoutSessionId);
  const billingPaymentRef = academyRef.collection("billingPayments").doc(String(payment.id ?? paymentId));
  const [academySnap, platformSettings] = await Promise.all([
    academyRef.get(),
    loadPlatformSettings()
  ]);

  if (!academySnap.exists) {
    logger.warn("Mercado Pago payment for missing academy", { paymentId, academyId });
    return;
  }

  const planSettings = platformSettings.plans[plan];
  const approvedAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
  const renewsAt = addMonths(approvedAt, 1);
  const paidAmount = Number(payment.transaction_amount ?? NaN);
  const paidCurrency = String(payment.currency_id ?? "").trim().toUpperCase();
  const amountMatches = Number.isFinite(paidAmount) && Math.abs(paidAmount - planSettings.price) < 0.01;
  const currencyMatches = paidCurrency === "ARS";
  const checkoutStatus = normalizeMercadoPagoCheckoutStatus(payment, amountMatches, currencyMatches);

  await db.runTransaction(async (transaction) => {
    const freshAcademy = await transaction.get(academyRef);
    const freshCheckout = await transaction.get(checkoutRef);
    if (!freshAcademy.exists) {
      logger.warn("Mercado Pago payment for missing academy during transaction", { paymentId, academyId });
      return;
    }

    const freshAcademyData = freshAcademy.data() as {
      subscription?: { startedAt?: FirebaseFirestore.Timestamp | Date | null; billingStatus?: string };
      trial?: Record<string, unknown>;
    };
    const startedAt =
      freshAcademyData.subscription?.startedAt instanceof Timestamp
        ? freshAcademyData.subscription.startedAt.toDate()
        : freshAcademyData.subscription?.startedAt instanceof Date
          ? freshAcademyData.subscription.startedAt
          : approvedAt;
    const currentCheckoutData = freshCheckout.data() as { paymentId?: string; status?: string } | undefined;

    if (currentCheckoutData?.status === "approved" && currentCheckoutData.paymentId === String(payment.id ?? paymentId)) {
      return;
    }

    transaction.set(
      checkoutRef,
      {
        academyId,
        targetPlan: plan,
        amount: planSettings.price,
        status: checkoutStatus,
        paymentId: String(payment.id ?? paymentId),
        paymentStatus: payment.status ?? "unknown",
        paymentStatusDetail: payment.status_detail ?? null,
        paidAmount: Number.isFinite(paidAmount) ? paidAmount : null,
        paidCurrency: paidCurrency || null,
        amountMatches,
        currencyMatches,
        approvedAt: payment.status === "approved" ? Timestamp.fromDate(approvedAt) : null,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      billingPaymentRef,
      {
        academyId,
        paymentId: String(payment.id ?? paymentId),
        checkoutSessionId,
        plan,
        amount: Number(payment.transaction_amount ?? planSettings.price),
        currency: paidCurrency || null,
        amountMatches,
        currencyMatches,
        status: payment.status ?? "unknown",
        statusDetail: payment.status_detail ?? null,
        externalReference: payment.external_reference ?? null,
        approvedAt: payment.status === "approved" ? Timestamp.fromDate(approvedAt) : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (payment.status !== "approved" || checkoutStatus === "validation_failed") {
      if (checkoutStatus === "validation_failed") {
        logger.error("Mercado Pago payment validation mismatch", {
          paymentId,
          academyId,
          plan,
          expectedAmount: planSettings.price,
          paidAmount,
          expectedCurrency: "ARS",
          paidCurrency
        });
      }

      if (shouldClearPendingPlan(checkoutStatus, payment.status)) {
        transaction.set(
          academyRef,
          {
            subscription: {
              ...(freshAcademyData.subscription ?? {}),
              billingStatus: freshAcademyData.subscription?.billingStatus === "paid" ? "paid" : "overdue",
              pendingPlan: FieldValue.delete()
            },
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
      return;
    }

    transaction.set(
      academyRef,
      {
        plan,
        status: "active",
        planLimits: {
          maxStudents: planSettings.maxStudents ?? maxStudentsByPlan(plan)
        },
        trial: {
          active: false,
          ...(freshAcademyData.trial ?? {})
        },
        subscription: {
          ...(freshAcademyData.subscription ?? {}),
          active: true,
          amount: planSettings.price,
          mrr: planSettings.price,
          billingStatus: "paid",
          currentPeriod: getCurrentPeriodFromDate(approvedAt),
          dueDay: renewsAt.getDate(),
          startedAt: Timestamp.fromDate(startedAt),
          renewsAt: Timestamp.fromDate(renewsAt),
          lastPaidAt: Timestamp.fromDate(approvedAt),
          paymentProvider: "mercado_pago",
          paymentProviderPaymentId: String(payment.id ?? paymentId),
          pendingPlan: FieldValue.delete()
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
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

function validateDeleteAcademyPayload(data: unknown): DeleteAcademyPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Payload invalido.");
  }

  const payload = data as Partial<DeleteAcademyPayload>;
  const academyId = payload.academyId?.trim() ?? "";
  if (!academyId) {
    throw new HttpsError("invalid-argument", "academyId es requerido.");
  }

  return { academyId };
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

type BillingCheckoutSessionData = {
  academyId?: string;
  targetPlan?: Plan;
  externalReference?: string;
  initPoint?: string | null;
  paymentId?: string;
  paymentStatus?: string;
  provider?: string;
  status?: string;
  createdAt?: FirebaseFirestore.Timestamp | Date | null;
  updatedAt?: FirebaseFirestore.Timestamp | Date | null;
};

function validateMercadoPagoWebhookToken(request: { query: Record<string, unknown> }) {
  const expectedToken = getRequiredEnv("MERCADO_PAGO_WEBHOOK_TOKEN");
  const receivedToken = String(request.query.token ?? "").trim();
  return Boolean(receivedToken) && safeEqualText(receivedToken, expectedToken);
}

async function reconcileAcademyMercadoPagoPayments(academyId: string) {
  const checkoutSnaps = await db
    .collection(`academies/${academyId}/billingCheckoutSessions`)
    .orderBy("updatedAt", "desc")
    .limit(15)
    .get();

  let reviewed = 0;
  let processed = 0;

  for (const checkoutSnap of checkoutSnaps.docs) {
    const checkout = checkoutSnap.data() as BillingCheckoutSessionData;
    if (checkout.provider !== "mercado_pago") continue;
    if (!["created", "pending", "validation_failed"].includes(String(checkout.status ?? ""))) continue;

    reviewed += 1;
    const paymentId = checkout.paymentId?.trim();

    if (paymentId) {
      await applyApprovedMercadoPagoPayment(paymentId);
      processed += 1;
      continue;
    }

    const externalReference = checkout.externalReference?.trim();
    if (!externalReference) continue;

    const payment = await findMercadoPagoPaymentByExternalReference(externalReference);
    if (!payment?.id) continue;

    await applyApprovedMercadoPagoPayment(String(payment.id));
    processed += 1;
  }

  return { reviewed, processed };
}

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

export const deleteAcademy = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const callerRole = String(callerSnap.data()?.platformRole ?? callerSnap.data()?.role ?? "").trim();
  if (!callerSnap.exists || callerRole !== "root") {
    throw new HttpsError("permission-denied", "Solo root puede eliminar centros.");
  }

  const payload = validateDeleteAcademyPayload(request.data);
  const academyRef = db.doc(`academies/${payload.academyId}`);
  const academySnap = await academyRef.get();
  if (!academySnap.exists) {
    throw new HttpsError("not-found", "La academia indicada no existe.");
  }

  const academyUsersSnap = await academyRef.collection("users").get();
  const academyUsers = academyUsersSnap.docs.map((docSnap) => {
    const data = docSnap.data() as { userId?: string; email?: string };
    return {
      uid: String(data.userId ?? docSnap.id).trim(),
      email: String(data.email ?? "").trim().toLowerCase()
    };
  });

  await db.recursiveDelete(academyRef);

  let deletedAuthUsers = 0;
  let deletedUserProfiles = 0;

  for (const academyUser of academyUsers) {
    if (!academyUser.uid) continue;

    const [userProfileSnap, remainingMembershipsSnap] = await Promise.all([
      db.doc(`users/${academyUser.uid}`).get(),
      db.collectionGroup("users").where("userId", "==", academyUser.uid).limit(2).get()
    ]);

    const hasOtherMemberships = remainingMembershipsSnap.docs.some((docSnap) => {
      const parentAcademyId = docSnap.ref.parent.parent?.id;
      return parentAcademyId && parentAcademyId !== payload.academyId;
    });

    if (hasOtherMemberships) continue;

    const platformRole = String(userProfileSnap.data()?.platformRole ?? userProfileSnap.data()?.role ?? "user").trim();
    if (platformRole === "root") continue;

    if (userProfileSnap.exists) {
      await userProfileSnap.ref.delete();
      deletedUserProfiles += 1;
    }

    try {
      await adminAuth.deleteUser(academyUser.uid);
      deletedAuthUsers += 1;
    } catch (error) {
      const authError = error as { code?: string };
      if (authError.code !== "auth/user-not-found") {
        logger.error("deleteAcademy auth cleanup failed", {
          academyId: payload.academyId,
          uid: academyUser.uid,
          error
        });
      }
    }
  }

  logger.info("academy deleted by root", {
    academyId: payload.academyId,
    deletedAuthUsers,
    deletedUserProfiles
  });

  return {
    academyId: payload.academyId,
    deletedAuthUsers,
    deletedUserProfiles
  };
});

export const createMercadoPagoCheckout = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const payload = validateCreateMercadoPagoCheckoutPayload(request.data);
  const [academySnap, membershipSnap, platformSettings] = await Promise.all([
    db.doc(`academies/${payload.academyId}`).get(),
    db.doc(`academies/${payload.academyId}/users/${request.auth.uid}`).get(),
    loadPlatformSettings()
  ]);

  if (!academySnap.exists) {
    throw new HttpsError("not-found", "La academia indicada no existe.");
  }
  if (!membershipSnap.exists) {
    throw new HttpsError("permission-denied", "No tienes membresia en esta academia.");
  }

  const membershipData = membershipSnap.data() as { role?: string; status?: string };
  if (membershipData.role !== "owner" || membershipData.status !== "active") {
    throw new HttpsError("permission-denied", "Solo el owner activo puede gestionar pagos.");
  }

  const academyData = academySnap.data() as {
    name?: string;
    plan?: Plan;
    owner?: { email?: string; name?: string };
    subscription?: { billingStatus?: string };
  };
  if (academyData.plan === payload.plan && academyData.subscription?.billingStatus === "paid") {
    throw new HttpsError("already-exists", "Ese plan ya esta activo.");
  }

  const recentCheckoutSnaps = await academySnap.ref.collection("billingCheckoutSessions").orderBy("createdAt", "desc").limit(10).get();
  const recentActiveCheckout = recentCheckoutSnaps.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as BillingCheckoutSessionData) }))
    .find((checkout) => {
      if (checkout.provider !== "mercado_pago") return false;
      if (!["created", "pending"].includes(String(checkout.status ?? ""))) return false;
      const createdAt =
        checkout.createdAt instanceof Timestamp
          ? checkout.createdAt.toDate()
          : checkout.createdAt instanceof Date
            ? checkout.createdAt
            : null;
      if (!createdAt) return false;
      return Date.now() - createdAt.getTime() <= 15 * 60 * 1000;
    });

  if (recentActiveCheckout?.targetPlan === payload.plan && recentActiveCheckout.initPoint) {
    return {
      checkoutSessionId: recentActiveCheckout.id,
      preferenceId: null,
      initPoint: recentActiveCheckout.initPoint,
      plan: payload.plan,
      amount: platformSettings.plans[payload.plan].price,
      reused: true
    };
  }

  if (recentActiveCheckout) {
    throw new HttpsError(
      "failed-precondition",
      "Ya hay un checkout pendiente para esta academia. Espera unos minutos o finaliza ese intento antes de crear otro."
    );
  }

  const selectedPlan = platformSettings.plans[payload.plan];
  const checkoutRef = db.doc(`academies/${payload.academyId}/billingCheckoutSessions/${db.collection("_").doc().id}`);
  const checkoutSessionId = checkoutRef.id;
  const externalReference = `${payload.academyId}:${payload.plan}:${checkoutSessionId}`;
  const webhookUrl = getRequiredEnv("MERCADO_PAGO_WEBHOOK_URL");
  const notificationUrl = buildMercadoPagoWebhookUrl(webhookUrl, checkoutSessionId);
  const backUrls = {
    success: `${payload.origin}/app/settings?checkout_status=success&plan=${payload.plan}`,
    pending: `${payload.origin}/app/settings?checkout_status=pending&plan=${payload.plan}`,
    failure: `${payload.origin}/app/settings?checkout_status=failure&plan=${payload.plan}`
  };

  const preference = await mercadoPagoRequest<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: payload.plan,
          title: `PaySync - ${selectedPlan.label}`,
          description: `${selectedPlan.description} (${academyData.name ?? "Academia"})`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: selectedPlan.price
        }
      ],
      payer: {
        email: academyData.owner?.email ?? String(request.auth.token.email ?? "")
      },
      metadata: {
        academyId: payload.academyId,
        plan: payload.plan,
        checkoutSessionId
      },
      external_reference: externalReference,
      notification_url: notificationUrl,
      back_urls: backUrls,
      ...(shouldEnableMercadoPagoAutoReturn(payload.origin) ? { auto_return: "approved" } : {})
    })
  });

  if (!preference.id || (!preference.init_point && !preference.sandbox_init_point)) {
    throw new HttpsError("internal", "Mercado Pago no devolvio una URL de checkout valida.");
  }

  await checkoutRef.set({
    academyId: payload.academyId,
    createdBy: request.auth.uid,
    currentPlan: academyData.plan ?? null,
    targetPlan: payload.plan,
    amount: selectedPlan.price,
    externalReference,
    preferenceId: preference.id,
    initPoint: preference.init_point ?? preference.sandbox_init_point ?? null,
    status: "created",
    paymentStatus: "pending",
    origin: payload.origin,
    provider: "mercado_pago",
    providerMode: preference.sandbox_init_point ? "sandbox" : "production",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await academySnap.ref.set(
    {
      subscription: {
        ...(academyData.subscription ?? {}),
        pendingPlan: payload.plan,
        billingStatus:
          academyData.subscription?.billingStatus === "paid" ? academyData.subscription.billingStatus : "pending"
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    checkoutSessionId,
    preferenceId: preference.id,
    initPoint: preference.init_point ?? preference.sandbox_init_point,
    plan: payload.plan,
    amount: selectedPlan.price
  };
});

export const mercadoPagoWebhook = onRequest({ region: "us-central1", cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(200).send("ok");
    return;
  }

  if (!validateMercadoPagoWebhookToken(request)) {
    logger.warn("Mercado Pago webhook rejected due to invalid token", {
      query: request.query
    });
    response.status(401).json({ received: false, reason: "invalid_token" });
    return;
  }

  const topic = String(request.query.type ?? request.query.topic ?? request.body?.type ?? request.body?.topic ?? "").trim();
  const paymentId = String(request.query["data.id"] ?? request.body?.data?.id ?? request.body?.id ?? "").trim();

  if (topic && topic !== "payment") {
    logger.info("Mercado Pago webhook ignored", { topic });
    response.status(200).json({ received: true, ignored: true });
    return;
  }

  if (!paymentId) {
    logger.warn("Mercado Pago webhook without payment id", {
      query: request.query,
      body: request.body ?? null
    });
    response.status(200).json({ received: true, ignored: true });
    return;
  }

  try {
    await applyApprovedMercadoPagoPayment(paymentId);
    response.status(200).json({ received: true, paymentId });
  } catch (error) {
    logger.error("Mercado Pago webhook processing failed", {
      paymentId,
      error
    });
    response.status(500).json({ received: false, paymentId });
  }
});

export const reconcileMercadoPagoPayments = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const academyId = String((request.data as { academyId?: string } | undefined)?.academyId ?? "").trim();
  if (!academyId) {
    throw new HttpsError("invalid-argument", "academyId es requerido.");
  }

  const [academySnap, membershipSnap, callerUserSnap] = await Promise.all([
    db.doc(`academies/${academyId}`).get(),
    db.doc(`academies/${academyId}/users/${request.auth.uid}`).get(),
    db.doc(`users/${request.auth.uid}`).get()
  ]);

  if (!academySnap.exists) {
    throw new HttpsError("not-found", "La academia indicada no existe.");
  }

  const callerRole = String(callerUserSnap.data()?.platformRole ?? callerUserSnap.data()?.role ?? "").trim();
  const membershipData = membershipSnap.data() as { role?: string; status?: string } | undefined;
  const canManagePayments =
    callerRole === "root" || (membershipData?.role === "owner" && membershipData.status === "active");

  if (!canManagePayments) {
    throw new HttpsError("permission-denied", "Solo root o el owner activo pueden reconciliar pagos.");
  }

  return reconcileAcademyMercadoPagoPayments(academyId);
});

export const reconcilePendingMercadoPagoPayments = onSchedule(
  { schedule: "every 15 minutes", region: "us-central1", timeZone: "America/Argentina/Buenos_Aires" },
  async () => {
    const checkoutSnaps = await db
      .collectionGroup("billingCheckoutSessions")
      .where("provider", "==", "mercado_pago")
      .where("status", "in", ["created", "pending", "validation_failed"])
      .limit(25)
      .get();

    let processed = 0;
    for (const checkoutSnap of checkoutSnaps.docs) {
      const checkout = checkoutSnap.data() as BillingCheckoutSessionData;
      const academyId = String(checkout.academyId ?? "").trim();
      if (!academyId) continue;
      const result = await reconcileAcademyMercadoPagoPayments(academyId);
      processed += result.processed;
    }

    logger.info("Mercado Pago pending payments reconciled", {
      academiesReviewed: checkoutSnaps.docs.length,
      processed
    });
  }
);

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
