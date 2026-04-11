import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut as signOutSecondary
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Panel } from "../../components/ui/Panel";
import { formatAcademyRole, formatMembershipStatus } from "../../lib/display";
import { db, functions, getSecondaryAuth } from "../../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanLabel,
  getPlanLimit,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../../lib/plans";
import { addMonths, getCurrentPeriodFromDate, resolveSubscriptionDates } from "../../lib/subscription";
import { getTrialEndsAtMillis } from "../../lib/trial";
import type { Academy, AcademyPlan } from "../../lib/types";

interface AcademyFormState {
  academyName: string;
  plan: AcademyPlan;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRole: "owner" | "staff" | "viewer";
  tempPassword: string;
}

interface EditState {
  id: string;
  name: string;
  plan: AcademyPlan;
  status: Academy["status"];
}

type RootSection = "billing" | "settings" | "edit";
type ConfigPlanSection = AcademyPlan | null;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface ConfigFormState {
  trialDurationDays: string;
  plans: Record<
    AcademyPlan,
    {
      label: string;
      price: string;
      maxStudents: string;
      description: string;
      highlight: string;
    }
  >;
}

const initialForm: AcademyFormState = {
  academyName: "",
  plan: "basic",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerRole: "owner",
  tempPassword: ""
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function getAcademyCreationError(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "Ese email ya existe en Firebase Auth. Con este enfoque desde frontend no puedo reutilizar cuentas existentes.";
      case "auth/invalid-email":
        return "El email del responsable no es valido.";
      case "auth/weak-password":
        return "La password temporal debe tener al menos 6 caracteres.";
      case "firestore/permission-denied":
      case "permission-denied":
        return "La cuenta root no tiene permisos suficientes en Firestore para crear el centro.";
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : "No se pudo crear el centro.";
}

function createConfigForm(config: PlatformConfig): ConfigFormState {
  return {
    trialDurationDays: String(config.trialDurationDays),
    plans: {
      basic: {
        label: config.plans.basic.label,
        price: String(config.plans.basic.price),
        maxStudents: config.plans.basic.maxStudents === null ? "" : String(config.plans.basic.maxStudents),
        description: config.plans.basic.description,
        highlight: config.plans.basic.highlight
      },
      pro: {
        label: config.plans.pro.label,
        price: String(config.plans.pro.price),
        maxStudents: config.plans.pro.maxStudents === null ? "" : String(config.plans.pro.maxStudents),
        description: config.plans.pro.description,
        highlight: config.plans.pro.highlight
      },
      premium: {
        label: config.plans.premium.label,
        price: String(config.plans.premium.price),
        maxStudents: config.plans.premium.maxStudents === null ? "" : String(config.plans.premium.maxStudents),
        description: config.plans.premium.description,
        highlight: config.plans.premium.highlight
      }
    }
  };
}

function parseLimit(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : null;
}

function formatPlanLimitValue(limit: number | null) {
  return limit === null ? "Ilimitado" : String(limit);
}

function toMillis(value: unknown) {
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

function formatDate(value: unknown) {
  const millis = toMillis(value);
  if (!millis) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(millis));
}

function formatPeriod(period?: string) {
  if (!period) return "Periodo actual";
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Math.max(Number(month) - 1, 0), 1);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function resolveBillingStatus(academy: Academy) {
  if (academy.status === "trial") {
    return {
      status: "trial" as const,
      label: "En prueba",
      tone: "warning" as const,
      detail: "Todavia no abona plan"
    };
  }

  if (academy.status === "suspended") {
    return {
      status: "suspended" as const,
      label: "Suspendido",
      tone: "danger" as const,
      detail: "Sin acceso habilitado"
    };
  }

  const { startedAt, renewsAt } = resolveSubscriptionDates(academy);
  const currentPeriod =
    academy.subscription?.currentPeriod ??
    (startedAt ? getCurrentPeriodFromDate(startedAt) : getCurrentPeriod());
  const dueDate = renewsAt;
  const explicitStatus = academy.subscription?.billingStatus;
  const effectiveStatus =
    explicitStatus ?? (dueDate && Date.now() > dueDate.getTime() ? ("overdue" as const) : ("pending" as const));

  if (effectiveStatus === "paid") {
    return {
      status: "paid" as const,
      label: "Pagado",
      tone: "success" as const,
      detail: formatPeriod(currentPeriod)
    };
  }

  if (effectiveStatus === "overdue") {
    return {
      status: "overdue" as const,
      label: "Vencido",
      tone: "danger" as const,
      detail: `Vencio el ${formatDate(dueDate)}`
    };
  }

  return {
    status: "pending" as const,
    label: "Pendiente",
    tone: "warning" as const,
    detail: `Vence el ${formatDate(dueDate)}`
  };
}

function buildOwnerWhatsAppLink(academy: Academy, amount: number) {
  const rawPhone = academy.owner?.phone?.replace(/\D/g, "") ?? "";
  if (!rawPhone) return null;
  const status = resolveBillingStatus(academy);
  const text = encodeURIComponent(
    `Hola ${academy.owner?.name || ""}, te escribimos por el abono de ${academy.name}. Estado actual: ${status.label}. Importe de referencia: $${amount}.`
  );
  return `https://wa.me/${rawPhone}?text=${text}`;
}

function buildOwnerMailLink(academy: Academy, amount: number, planLabel: string) {
  const subject = encodeURIComponent(`Abono mensual ${academy.name}`);
  const body = encodeURIComponent(
    `Hola ${academy.owner?.name || ""},\n\nTe contactamos por el abono mensual del plan ${planLabel} de ${academy.name}.\nImporte de referencia: $${amount}.\n\nSaludos.`
  );
  return `mailto:${academy.owner?.email}?subject=${subject}&body=${body}`;
}

function buildActiveSubscriptionPayload(academy: Academy | null | undefined, amount: number) {
  const now = new Date();
  const { startedAt, renewsAt } = resolveSubscriptionDates({
    createdAt: academy?.createdAt,
    subscription: academy?.subscription
  });
  const effectiveStart = startedAt ?? now;
  const effectiveRenewal = renewsAt && renewsAt > now ? renewsAt : addMonths(effectiveStart, 1);

  return {
    ...(academy?.subscription ?? {}),
    active: true,
    amount,
    mrr: amount,
    startedAt: academy?.subscription?.startedAt ?? effectiveStart,
    renewsAt: effectiveRenewal,
    currentPeriod: academy?.subscription?.currentPeriod ?? getCurrentPeriodFromDate(effectiveStart),
    billingStatus:
      academy?.subscription?.billingStatus === "paid" && renewsAt && renewsAt > now
        ? "paid"
        : academy?.subscription?.billingStatus ?? "pending"
  };
}

function getTrialSummary(academy: Academy, trialDurationDays: number) {
  if (academy.status !== "trial") return null;

  const endsAtMillis = getTrialEndsAtMillis(academy, trialDurationDays);
  if (!endsAtMillis) {
    return {
      label: "Sin fecha valida",
      detail: "No se pudo calcular el cierre del trial",
      tone: "text-warning"
    };
  }

  const remainingMs = endsAtMillis - Date.now();
  if (remainingMs <= 0) {
    return {
      label: "Trial vencido",
      detail: `Finalizo el ${formatDate(academy.trial?.endsAt)}`,
      tone: "text-danger"
    };
  }

  const remainingDays = Math.ceil(remainingMs / DAY_IN_MS);
  const label = remainingDays === 1 ? "1 dia restante" : `${remainingDays} dias restantes`;

  return {
    label,
    detail: `Hasta el ${formatDate(academy.trial?.endsAt)}`,
    tone: remainingDays <= 3 ? "text-warning" : "text-secondary"
  };
}

export function RootDashboardPage() {
  const { profile, logout } = useAuth();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AcademyFormState>(initialForm);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [configForm, setConfigForm] = useState<ConfigFormState>(createConfigForm(DEFAULT_PLATFORM_CONFIG));
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<RootSection>("billing");
  const [activePlanSection, setActivePlanSection] = useState<ConfigPlanSection>("basic");
  const [deletingAcademyId, setDeletingAcademyId] = useState<string | null>(null);

  async function loadPlatformConfig() {
    const configSnap = await getDoc(doc(db, "platform", "config"));
    const normalized = normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined);
    setPlatformConfig(normalized);
    setConfigForm(createConfigForm(normalized));
  }

  async function loadAcademies() {
    const academySnap = await getDocs(collection(db, "academies"));
    const loadedAcademies = await Promise.all(
      academySnap.docs.map(async (docSnap) => {
        const data = docSnap.data() as Omit<Academy, "id"> & { plan?: string };
        const trialEndsAtMillis = getTrialEndsAtMillis(data, platformConfig.trialDurationDays);
        if (data.status === "trial" && trialEndsAtMillis !== null && trialEndsAtMillis <= Date.now()) {
          await updateDoc(doc(db, "academies", docSnap.id), {
            status: "suspended",
            trial: {
              ...(data.trial ?? {}),
              active: false
            },
            updatedAt: serverTimestamp()
          });
          data.status = "suspended";
        }
        const normalizedPlan = data.plan as AcademyPlan;
        return {
          id: docSnap.id,
          ...data,
          plan: normalizedPlan,
          planLimits: {
            maxStudents: data.planLimits?.maxStudents ?? getPlanLimit(platformConfig, normalizedPlan)
          }
        };
      })
    );
    setAcademies(loadedAcademies);
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await loadPlatformConfig();
      setLoading(false);
    }

    void loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadAcademies();
    }
  }, [loading, platformConfig]);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeCreateModal();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isCreateModalOpen]);

  const kpis = useMemo(() => {
    const total = academies.length;
    const trials = academies.filter((academy) => academy.status === "trial").length;
    const active = academies.filter((academy) => academy.status === "active").length;
    const suspended = academies.filter((academy) => academy.status === "suspended").length;
    const mrr = academies
      .filter((academy) => academy.status === "active")
      .reduce((sum, academy) => sum + getPlanPrice(platformConfig, academy.plan), 0);
    return { total, trials, active, suspended, mrr };
  }, [academies, platformConfig]);

  const billingSnapshot = useMemo(() => {
    const rows = academies.map((academy) => {
      const billing = resolveBillingStatus(academy);
      const amount = getPlanPrice(platformConfig, academy.plan);
      const subscriptionDates = resolveSubscriptionDates(academy);
      const dueMillis = subscriptionDates.renewsAt?.getTime() ?? null;
      const daysUntilDue =
        dueMillis === null ? null : Math.ceil((dueMillis - Date.now()) / DAY_IN_MS);

      return {
        academy,
        billing,
        amount,
        subscriptionDates,
        dueMillis,
        daysUntilDue
      };
    });

    const overdue = rows.filter((row) => row.billing.status === "overdue");
    const pending = rows.filter((row) => row.billing.status === "pending");
    const paid = rows.filter((row) => row.billing.status === "paid");
    const dueSoon = rows.filter(
      (row) => row.billing.status === "pending" && row.daysUntilDue !== null && row.daysUntilDue >= 0 && row.daysUntilDue <= 7
    );
    const riskAmount = rows
      .filter((row) => row.billing.status === "overdue" || row.billing.status === "pending")
      .reduce((sum, row) => sum + row.amount, 0);

    const sortedRows = [...rows].sort((left, right) => {
      const priority = { overdue: 0, pending: 1, paid: 2, trial: 3, suspended: 4 } as const;
      const byStatus = priority[left.billing.status] - priority[right.billing.status];
      if (byStatus !== 0) return byStatus;
      return (left.dueMillis ?? Number.MAX_SAFE_INTEGER) - (right.dueMillis ?? Number.MAX_SAFE_INTEGER);
    });

    return {
      rows: sortedRows,
      overdueCount: overdue.length,
      pendingCount: pending.length,
      paidCount: paid.length,
      dueSoonCount: dueSoon.length,
      riskAmount
    };
  }, [academies, platformConfig]);

  const planBreakdown = useMemo(() => {
    return (["basic", "pro", "premium"] as AcademyPlan[]).map((plan) => {
      const count = academies.filter((academy) => academy.plan === plan && academy.status === "active").length;
      return {
        plan,
        count,
        revenue: count * getPlanPrice(platformConfig, plan)
      };
    });
  }, [academies, platformConfig]);

  async function handleCreateAcademy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const academyName = form.academyName.trim();
    const ownerName = form.ownerName.trim();
    const ownerEmail = form.ownerEmail.trim().toLowerCase();
    const password = form.tempPassword.trim() || randomPassword();

    if (!academyName || !ownerName || !ownerEmail) {
      setSubmitting(false);
      setError("Completa nombre del centro, nombre del responsable y email del responsable.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      setSubmitting(false);
      setError("El email del responsable no tiene un formato valido.");
      return;
    }

    try {
      const secondaryAuth = getSecondaryAuth();
      const credential = await createUserWithEmailAndPassword(secondaryAuth, ownerEmail, password);
      const ownerUid = credential.user.uid;
      const academyRef = doc(collection(db, "academies"));
      const slug = `${slugify(academyName)}-${academyRef.id.slice(0, 6)}`;
      const batch = writeBatch(db);

      batch.set(doc(db, "users", ownerUid), {
        email: ownerEmail,
        displayName: ownerName,
        platformRole: "user",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(academyRef, {
        name: academyName,
        slug,
        plan: form.plan,
        status: "trial",
        owner: {
          uid: ownerUid,
          name: ownerName,
          email: ownerEmail,
          phone: form.ownerPhone.trim()
        },
        planLimits: {
          maxStudents: getPlanLimit(platformConfig, form.plan)
        },
        counters: {
          students: 0,
          fees: 0,
          payments: 0
        },
        trial: {
          active: true,
          startedAt: serverTimestamp(),
          endsAt: Timestamp.fromMillis(Date.now() + platformConfig.trialDurationDays * DAY_IN_MS)
        },
        subscription: {
          active: false,
          mrr: 0,
          billingStatus: "pending",
          currentPeriod: getCurrentPeriod(),
          startedAt: null,
          renewsAt: null,
          amount: getPlanPrice(platformConfig, form.plan)
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(doc(db, `academies/${academyRef.id}/users/${ownerUid}`), {
        userId: ownerUid,
        email: ownerEmail,
        displayName: ownerName,
        role: form.ownerRole,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      try {
        await batch.commit();
      } catch (firestoreError) {
        try {
          if (secondaryAuth.currentUser) {
            await deleteUser(secondaryAuth.currentUser);
          }
        } catch {
          setError(
            "Se creo el responsable en Auth pero fallo Firestore. Revisa Firebase Authentication antes de reintentar."
          );
          return;
        }
        throw firestoreError;
      } finally {
        try {
          await signOutSecondary(secondaryAuth);
        } catch {
          // No-op
        }
      }

      setMessage(
        form.tempPassword.trim()
          ? `Centro creado en modo prueba por ${platformConfig.trialDurationDays} dias.`
          : `Centro creado en modo prueba. Password temporal generado: ${password}`
      );
      closeCreateModal();
      await loadAcademies();
    } catch (err) {
      setError(getAcademyCreationError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAcademyStatus(academy: Academy) {
    const trialEndsAtMillis = getTrialEndsAtMillis(academy, platformConfig.trialDurationDays);
    const canResumeTrial =
      Boolean(academy.trial?.active) && trialEndsAtMillis !== null && trialEndsAtMillis > Date.now();
    const nextStatus: Academy["status"] =
      academy.status === "suspended" ? (canResumeTrial ? "trial" : "active") : "suspended";
    const planAmount = getPlanPrice(platformConfig, academy.plan);
    await updateDoc(doc(db, "academies", academy.id), {
      status: nextStatus,
      ...(academy.status === "suspended" && canResumeTrial
        ? {
            trial: {
              ...(academy.trial ?? {}),
              active: true
            }
          }
        : {}),
      ...(academy.status === "suspended" && !canResumeTrial
        ? {
            subscription: buildActiveSubscriptionPayload(academy, planAmount)
          }
        : {}),
      updatedAt: serverTimestamp()
    });
    await loadAcademies();
  }

  async function handleDeleteAcademy(academy: Academy) {
    const confirmation = window.prompt(
      `Vas a eliminar el centro "${academy.name}". Esta accion borra el centro y sus datos asociados.\n\nPara confirmar, escribe ELIMINAR`
    );

    if (confirmation !== "ELIMINAR") {
      return;
    }

    setDeletingAcademyId(academy.id);
    setError(null);
    setMessage(null);

    try {
      const deleteAcademyCallable = httpsCallable<{ academyId: string }, { academyId: string }>(functions, "deleteAcademy");
      await deleteAcademyCallable({ academyId: academy.id });
      if (editState?.id === academy.id) {
        setEditState(null);
        setActiveSection("billing");
      }
      setMessage(`Centro "${academy.name}" eliminado correctamente.`);
      await loadAcademies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el centro.");
    } finally {
      setDeletingAcademyId(null);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editState) return;

    const currentAcademy = academies.find((academy) => academy.id === editState.id);
    const trialEndsAt = Timestamp.fromMillis(Date.now() + platformConfig.trialDurationDays * DAY_IN_MS);
    const planAmount = getPlanPrice(platformConfig, editState.plan);
    const trialPayload =
      editState.status === "trial"
        ? {
            active: true,
            startedAt: currentAcademy?.status === "trial" ? currentAcademy.trial?.startedAt ?? serverTimestamp() : serverTimestamp(),
            endsAt: currentAcademy?.status === "trial" ? currentAcademy.trial?.endsAt ?? trialEndsAt : trialEndsAt
          }
        : currentAcademy?.trial
          ? {
              ...currentAcademy.trial,
              active: false
            }
          : undefined;

    await updateDoc(doc(db, "academies", editState.id), {
      name: editState.name,
      plan: editState.plan,
      status: editState.status,
      planLimits: {
        maxStudents: getPlanLimit(platformConfig, editState.plan)
      },
      subscription:
        editState.status === "active"
          ? buildActiveSubscriptionPayload(currentAcademy, planAmount)
          : {
              ...(currentAcademy?.subscription ?? {}),
              active: false,
              amount: planAmount,
              mrr: planAmount
            },
      ...(trialPayload ? { trial: trialPayload } : {}),
      updatedAt: serverTimestamp()
    });
    setEditState(null);
    setActiveSection("billing");
    await loadAcademies();
  }

  async function handleSavePlatformConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingConfig(true);
    setConfigError(null);
    setConfigMessage(null);

    const trialDurationDays = Number(configForm.trialDurationDays);
    if (!Number.isFinite(trialDurationDays) || trialDurationDays < 1) {
      setSavingConfig(false);
      setConfigError("La duracion del trial debe ser un numero mayor a 0.");
      return;
    }

    const nextConfig = normalizePlatformConfig({
      trialDurationDays,
      plans: {
        basic: {
          label: configForm.plans.basic.label,
          price: Number(configForm.plans.basic.price),
          maxStudents: parseLimit(configForm.plans.basic.maxStudents),
          description: configForm.plans.basic.description,
          highlight: configForm.plans.basic.highlight
        },
        pro: {
          label: configForm.plans.pro.label,
          price: Number(configForm.plans.pro.price),
          maxStudents: parseLimit(configForm.plans.pro.maxStudents),
          description: configForm.plans.pro.description,
          highlight: configForm.plans.pro.highlight
        },
        premium: {
          label: configForm.plans.premium.label,
          price: Number(configForm.plans.premium.price),
          maxStudents: parseLimit(configForm.plans.premium.maxStudents),
          description: configForm.plans.premium.description,
          highlight: configForm.plans.premium.highlight
        }
      }
    });

    await setDoc(
      doc(db, "platform", "config"),
      {
        trialDurationDays: nextConfig.trialDurationDays,
        plans: nextConfig.plans,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    setPlatformConfig(nextConfig);
    setConfigForm(createConfigForm(nextConfig));
    setConfigMessage("Configuracion global actualizada.");
    setSavingConfig(false);
  }

  async function handleUpdateBillingStatus(
    academy: Academy,
    status: "paid" | "pending" | "overdue"
  ) {
    const amount = getPlanPrice(platformConfig, academy.plan);
    const now = new Date();
    const dates = resolveSubscriptionDates(academy);
    const baseDate =
      dates.renewsAt && dates.renewsAt > now ? dates.renewsAt : now;
    const nextRenewal = status === "paid" ? addMonths(baseDate, 1) : dates.renewsAt ?? addMonths(now, 1);
    const startedAt = dates.startedAt ?? now;

    await updateDoc(doc(db, "academies", academy.id), {
      subscription: {
        ...(academy.subscription ?? {}),
        active: academy.status === "active",
        amount,
        mrr: amount,
        billingStatus: status,
        startedAt: academy.subscription?.startedAt ?? startedAt,
        renewsAt: nextRenewal,
        currentPeriod:
          status === "paid"
            ? getCurrentPeriodFromDate(nextRenewal)
            : academy.subscription?.currentPeriod ?? getCurrentPeriodFromDate(startedAt),
        ...(status === "paid" ? { lastPaidAt: serverTimestamp() } : {})
      },
      updatedAt: serverTimestamp()
    });
    await loadAcademies();
  }

  function openCreateModal() {
    setForm(initialForm);
    setError(null);
    setMessage(null);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setForm(initialForm);
    setIsCreateModalOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] px-4 py-4 text-text md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-brand border border-[#262626] bg-[#1A1A1A] px-5 py-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-primary">Panel de control PaySync</p>
              <p className="mt-1 text-sm text-[#B3B3B3]">Estado general de tu negocio en tiempo real</p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#00D1FF]">
                {profile?.displayName} | ROOT
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-2 rounded-brand border border-[#262626] bg-[#0B0B0B] p-2">
                <SectionTab
                  label="Facturacion"
                  active={activeSection === "billing"}
                  onClick={() => setActiveSection("billing")}
                />
                <SectionTab
                  label="Configuracion"
                  active={activeSection === "settings"}
                  onClick={() => setActiveSection("settings")}
                />
                <SectionTab
                  label="Edicion"
                  active={activeSection === "edit"}
                  onClick={() => setActiveSection("edit")}
                  disabled={!editState}
                />
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-brand border border-[#00D1FF]/40 bg-[#00D1FF]/10 px-4 py-2 text-xs font-semibold text-[#00D1FF] shadow-[0_0_24px_rgba(0,209,255,0.16)] transition hover:border-[#00D1FF] hover:bg-[#00D1FF]/15"
              >
                Crear centro
              </button>
              <button
                onClick={() => void logout()}
                className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Ingresos mensuales"
            value={formatCurrency(kpis.mrr)}
            color="text-white"
            helper="(+0% este mes)"
            accent="border-[#00D1FF]/30 shadow-[0_0_24px_rgba(0,209,255,0.08)]"
          />
          <KpiCard label="Centros activos" value={kpis.active} color="text-[#00C896]" helper="Facturando este ciclo" />
          <KpiCard label="En prueba" value={kpis.trials} color="text-[#F5A524]" helper="Todavia no abonan plan" />
          <KpiCard label="Suspendidos" value={kpis.suspended} color="text-[#FF4D4F]" helper="Requieren revision" />
          <KpiCard
            label="Ingresos en riesgo"
            value={formatCurrency(billingSnapshot.riskAmount)}
            color="text-[#FF4D4F]"
            helper="Pendientes o vencidos"
          />
        </section>

        <Panel title="Centro de control">
          {activeSection === "billing" && (
            <div className="grid gap-5">
              <div className="rounded-brand border border-[#262626] bg-[#121212] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D1FF]">Atencion requerida</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Resumen de accion inmediata</h2>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      billingSnapshot.overdueCount || billingSnapshot.dueSoonCount || billingSnapshot.riskAmount
                        ? "border-[#F5A524]/30 bg-[#F5A524]/10 text-[#F5A524]"
                        : "border-[#00C896]/30 bg-[#00C896]/10 text-[#00C896]"
                    }`}
                  >
                    {billingSnapshot.overdueCount || billingSnapshot.dueSoonCount || billingSnapshot.riskAmount ? "Revisar hoy" : "Todo en orden"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <AlertCard
                    tone={billingSnapshot.overdueCount > 0 ? "danger" : "success"}
                    title={billingSnapshot.overdueCount > 0 ? `${billingSnapshot.overdueCount} centro${billingSnapshot.overdueCount === 1 ? "" : "s"} vencido${billingSnapshot.overdueCount === 1 ? "" : "s"}` : "Sin centros vencidos"}
                    detail={billingSnapshot.overdueCount > 0 ? "Cobro atrasado que requiere seguimiento." : "No hay deuda vencida en este momento."}
                  />
                  <AlertCard
                    tone={billingSnapshot.dueSoonCount > 0 ? "warning" : "success"}
                    title={billingSnapshot.dueSoonCount > 0 ? `${billingSnapshot.dueSoonCount} centro${billingSnapshot.dueSoonCount === 1 ? "" : "s"} por vencer esta semana` : "Sin vencimientos inmediatos"}
                    detail={billingSnapshot.dueSoonCount > 0 ? "Proximo vencimiento dentro de 7 dias." : "No hay alertas cercanas para esta semana."}
                  />
                  <AlertCard
                    tone={billingSnapshot.riskAmount > 0 ? "danger" : "success"}
                    title={billingSnapshot.riskAmount > 0 ? `${formatCurrency(billingSnapshot.riskAmount)} en riesgo de cobro` : "Todo en orden"}
                    detail={billingSnapshot.riskAmount > 0 ? "Suma de centros pendientes y vencidos." : "No hay ingresos comprometidos ahora mismo."}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <MetricInline
                  label="Vencidos"
                  value={billingSnapshot.overdueCount}
                  tone="danger"
                  helper="Centros con cobro vencido"
                />
                <MetricInline
                  label="Pendientes"
                  value={billingSnapshot.pendingCount}
                  tone="warning"
                  helper="Proximo vencimiento"
                />
                <MetricInline
                  label="Pagados"
                  value={billingSnapshot.paidCount}
                  tone="success"
                  helper="Pagado este ciclo"
                />
              </div>

              <div className="rounded-brand border border-[#262626] bg-[#121212] p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D1FF]">Centros</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Vista operativa de cobro</h3>
                    <p className="mt-1 text-sm text-[#B3B3B3]">Prioriza vencidos, revisa proximos vencimientos y actua rapido.</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-brand border border-[#262626] bg-[#0B0B0B]">
                  <table className="root-centers-table min-w-full text-sm">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="px-4 py-3">Centro</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3">Monto mensual</th>
                        <th className="px-4 py-3">Responsable</th>
                        <th className="px-4 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="px-4 py-6 text-muted" colSpan={6}>
                            Cargando...
                          </td>
                        </tr>
                      ) : billingSnapshot.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-muted" colSpan={6}>
                            No hay centros todavia.
                          </td>
                        </tr>
                      ) : (
                        billingSnapshot.rows.map(({ academy, billing, amount, subscriptionDates, daysUntilDue }) => {
                          const planLabel = getPlanLabel(platformConfig, academy.plan);
                          const whatsappUrl = buildOwnerWhatsAppLink(academy, amount);
                          const mailUrl = buildOwnerMailLink(academy, amount, planLabel);
                          const dueTone =
                            billing.status === "overdue"
                              ? "text-[#FF4D4F]"
                              : billing.status === "pending" && daysUntilDue !== null && daysUntilDue <= 3
                                ? "text-[#F5A524]"
                                : billing.status === "paid"
                                  ? "text-[#00C896]"
                                  : "text-white";

                          return (
                            <tr key={`billing-${academy.id}`} className="border-t border-slate-800 align-top">
                              <td className="px-4 py-4">
                                <div className="grid gap-1">
                                  <p className="font-semibold text-text">{academy.name}</p>
                                  <p className="text-xs text-muted">{planLabel} | {academy.slug}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="grid gap-1">
                                  <Badge
                                    tone={
                                      billing.tone === "success"
                                        ? "success"
                                        : billing.tone === "danger"
                                          ? "danger"
                                          : "warning"
                                    }
                                  >
                                    {billing.label}
                                  </Badge>
                                  <p className="text-xs text-muted">{billing.detail}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="grid gap-1">
                                  <p className={`text-sm font-semibold ${dueTone}`}>
                                    {academy.status === "active" ? formatDate(subscriptionDates.renewsAt) : "-"}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {academy.status === "active"
                                      ? `Ciclo: ${formatPeriod(
                                          academy.subscription?.currentPeriod ??
                                            (subscriptionDates.startedAt
                                              ? getCurrentPeriodFromDate(subscriptionDates.startedAt)
                                              : getCurrentPeriod())
                                        )}`
                                      : "Sin abono activo"}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="grid gap-1">
                                  <p className="text-base font-semibold text-[#00C896]">{formatCurrency(amount)}</p>
                                  <p className="text-xs text-muted">Ingreso mensual del centro</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="grid gap-1">
                                  <p className="text-sm text-text">{academy.owner?.name || "Sin nombre"}</p>
                                  <p className="text-[11px] uppercase tracking-wide text-muted">Responsable del centro</p>
                                  <p className="text-xs text-muted">{academy.owner?.email}</p>
                                  <p className="text-xs text-muted">{academy.owner?.phone || "Sin WhatsApp"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <select
                                    value={billing.status === "trial" || billing.status === "suspended" ? "" : billing.status}
                                    onChange={(event) =>
                                      void handleUpdateBillingStatus(
                                        academy,
                                        event.target.value as "paid" | "pending" | "overdue"
                                      )
                                    }
                                    disabled={billing.status === "trial" || billing.status === "suspended"}
                                    className="rounded-brand border border-slate-600 bg-surface px-3 py-2 text-xs font-semibold text-text outline-none focus:border-primary disabled:opacity-40"
                                  >
                                    <option value="" disabled>
                                      Estado de cobro
                                    </option>
                                    <option value="paid">Pagado</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="overdue">Vencido</option>
                                  </select>
                                  <a
                                    href={mailUrl}
                                    className="rounded-brand border border-slate-600 px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
                                  >
                                    Enviar recordatorio
                                  </a>
                                  {whatsappUrl && (
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-brand border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10"
                                    >
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {planBreakdown.map((item) => (
                  <div key={item.plan} className="rounded-brand border border-[#262626] bg-[#121212] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">{getPlanLabel(platformConfig, item.plan)}</p>
                        <p className="mt-1 text-xs text-muted">
                          {item.count} academias activas | ${getPlanPrice(platformConfig, item.plan)}/mes
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-secondary">${item.revenue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "settings" && (
            <form onSubmit={(event) => void handleSavePlatformConfig(event)} className="grid gap-4 text-sm">
              <div className="rounded-brand border border-slate-700 bg-bg p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Duracion del trial</p>
                <div className="mt-3 grid gap-2">
                  <Input
                    label="Dias de prueba"
                    type="number"
                    value={configForm.trialDurationDays}
                    onChange={(value) => setConfigForm((prev) => ({ ...prev, trialDurationDays: value }))}
                  />
                  <p className="text-xs text-muted">
                    Se usa cuando una academia entra en modo prueba y todavia no tiene fecha de cierre definida.
                  </p>
                </div>
              </div>

              {(["basic", "pro", "premium"] as AcademyPlan[]).map((plan) => {
                const isOpen = activePlanSection === plan;

                return (
                  <div
                    key={plan}
                    className={`plan-config-item rounded-brand border bg-bg p-4 transition ${
                      isOpen ? "border-primary/50" : "border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActivePlanSection((current) => (current === plan ? null : plan))}
                      className="plan-config-summary text-xs uppercase tracking-wide text-muted"
                    >
                      <span className="plan-config-summary-row">
                        <span>{getPlanLabel(platformConfig, plan)}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-secondary">${configForm.plans[plan].price || 0}/mes</span>
                          <span className={`text-[10px] transition ${isOpen ? "text-primary" : "text-muted"}`}>
                            {isOpen ? "Ocultar" : "Editar"}
                          </span>
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="plan-config-content mt-4">
                        <Input
                          label="Nombre visible"
                          value={configForm.plans[plan].label}
                          onChange={(value) =>
                            setConfigForm((prev) => ({
                              ...prev,
                              plans: { ...prev.plans, [plan]: { ...prev.plans[plan], label: value } }
                            }))
                          }
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Costo mensual"
                            type="number"
                            value={configForm.plans[plan].price}
                            onChange={(value) =>
                              setConfigForm((prev) => ({
                                ...prev,
                                plans: { ...prev.plans, [plan]: { ...prev.plans[plan], price: value } }
                              }))
                            }
                          />
                          <Input
                            label="Limite de alumnos"
                            type="number"
                            value={configForm.plans[plan].maxStudents}
                            onChange={(value) =>
                              setConfigForm((prev) => ({
                                ...prev,
                                plans: { ...prev.plans, [plan]: { ...prev.plans[plan], maxStudents: value } }
                              }))
                            }
                            required={false}
                          />
                        </div>
                        <Input
                          label="Descripcion"
                          value={configForm.plans[plan].description}
                          onChange={(value) =>
                            setConfigForm((prev) => ({
                              ...prev,
                              plans: { ...prev.plans, [plan]: { ...prev.plans[plan], description: value } }
                            }))
                          }
                        />
                        <Input
                          label="Texto destacado"
                          value={configForm.plans[plan].highlight}
                          onChange={(value) =>
                            setConfigForm((prev) => ({
                              ...prev,
                              plans: { ...prev.plans, [plan]: { ...prev.plans[plan], highlight: value } }
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {configError && <p className="text-danger">{configError}</p>}
              {configMessage && <p className="text-secondary">{configMessage}</p>}

              <button
                disabled={savingConfig}
                className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
              >
                {savingConfig ? "Guardando..." : "Guardar configuracion"}
              </button>
            </form>
          )}

          {activeSection === "edit" &&
            (editState ? (
              <form onSubmit={(event) => void handleSaveEdit(event)} className="grid gap-3 text-sm">
                <div className="rounded-brand border border-warning/30 bg-warning/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-warning">Centro seleccionado</p>
                  <p className="mt-2 text-lg font-semibold text-text">{editState.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    Ajusta plan, estado o nombre sin perder de vista la tabla principal.
                  </p>
                </div>
                <Input
                  label="Nombre"
                  value={editState.name}
                  onChange={(value) => setEditState((prev) => (prev ? { ...prev, name: value } : prev))}
                />
                <Select
                  label="Plan"
                  value={editState.plan}
                  onChange={(value) => setEditState((prev) => (prev ? { ...prev, plan: value as AcademyPlan } : prev))}
                  options={["basic", "pro", "premium"]}
                  formatter={(value) => getPlanLabel(platformConfig, value as AcademyPlan)}
                />
                <Select
                  label="Estado"
                  value={editState.status}
                  onChange={(value) =>
                    setEditState((prev) => (prev ? { ...prev, status: value as Academy["status"] } : prev))
                  }
                  options={["trial", "active", "suspended"]}
                  formatter={formatMembershipStatus}
                />
                <div className="rounded-brand border border-slate-700 bg-bg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Abono estimado</p>
                  <p className="mt-1 text-lg font-semibold text-secondary">${getPlanPrice(platformConfig, editState.plan)}/mes</p>
                  <p className="mt-1 text-xs text-muted">
                    Limite alumnos: {formatPlanLimitValue(getPlanLimit(platformConfig, editState.plan))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg">Guardar</button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditState(null);
                      setActiveSection("billing");
                    }}
                    className="rounded-brand border border-slate-600 px-3 py-2 text-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-brand border border-dashed border-slate-700 bg-bg p-6 text-sm text-muted">
                Elegi un centro desde la tabla y toca `Editar` para trabajar aca.
              </div>
            ))}
        </Panel>

        <div className="grid gap-4">
          <Panel title="Centros">
            <div className="mb-4 grid gap-3 rounded-brand border border-slate-700 bg-bg p-4 sm:grid-cols-3">
              <MetricInline label="Total" value={academies.length} tone="success" helper="Base total de centros" />
              <MetricInline
                label="En prueba"
                value={academies.filter((academy) => academy.status === "trial").length}
                tone="warning"
                helper="Todavia no facturan"
              />
              <MetricInline
                label="Suspendidos"
                value={academies.filter((academy) => academy.status === "suspended").length}
                tone="danger"
                helper="Sin acceso habilitado"
              />
            </div>

            <div className="overflow-x-auto rounded-brand border border-slate-700 bg-bg">
              <table className="root-centers-table min-w-full text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="px-4 py-3">Centro</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Abono</th>
                    <th className="px-4 py-3">Limite</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Trial</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={8}>
                        Cargando...
                      </td>
                    </tr>
                  ) : academies.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={8}>
                        No hay centros todavia.
                      </td>
                    </tr>
                  ) : (
                    academies.map((academy) => {
                      const trialSummary = getTrialSummary(academy, platformConfig.trialDurationDays);

                      return (
                        <tr key={academy.id} className="border-t border-slate-800 align-top">
                          <td className="px-4 py-4">
                            <div className="grid gap-1">
                              <p className="font-semibold text-text">{academy.name}</p>
                              <p className="text-xs text-muted">{academy.slug}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone="primary">{getPlanLabel(platformConfig, academy.plan)}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid gap-1">
                              <p className="text-base font-semibold text-secondary">${getPlanPrice(platformConfig, academy.plan)}</p>
                              <p className="text-xs text-muted">por mes</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone="neutral">{formatPlanLimitValue(getPlanLimit(platformConfig, academy.plan))}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone={academy.status === "active" ? "success" : academy.status === "suspended" ? "danger" : "warning"}>
                              {formatMembershipStatus(academy.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            {trialSummary ? (
                              <div className="grid gap-1">
                                <p className={`text-sm font-semibold ${trialSummary.tone}`}>{trialSummary.label}</p>
                                <p className="text-xs text-muted">{trialSummary.detail}</p>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid gap-1">
                              <p className="text-sm text-text">{academy.owner?.name || "Sin nombre"}</p>
                              <p className="text-xs text-muted">{academy.owner?.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  {
                                    setEditState({
                                      id: academy.id,
                                      name: academy.name,
                                      plan: academy.plan,
                                      status: academy.status
                                    });
                                    setActiveSection("edit");
                                  }
                                }
                                className="rounded-brand border border-slate-600 px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => void handleToggleAcademyStatus(academy)}
                                className="rounded-brand border border-slate-600 px-3 py-2 text-xs font-semibold text-muted hover:border-warning hover:text-warning"
                              >
                                {academy.status === "suspended" ? "Habilitar" : "Suspender"}
                              </button>
                              <button
                                onClick={() => void handleDeleteAcademy(academy)}
                                disabled={deletingAcademyId === academy.id}
                                className="rounded-brand border border-danger/50 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                              >
                                {deletingAcademyId === academy.id ? "Eliminando..." : "Eliminar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-academy-modal-title"
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 id="create-academy-modal-title" className="font-display text-lg text-text">
                    Crear centro
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Crea una nueva academia sin tapar el dashboard principal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={handleCreateAcademy} className="grid gap-3 text-sm">
                <Input
                  label="Nombre del centro"
                  value={form.academyName}
                  onChange={(value) => setForm((prev) => ({ ...prev, academyName: value }))}
                />
                <Select
                  label="Plan"
                  value={form.plan}
                  onChange={(value) => setForm((prev) => ({ ...prev, plan: value as AcademyPlan }))}
                  options={["basic", "pro", "premium"]}
                  formatter={(value) => getPlanLabel(platformConfig, value as AcademyPlan)}
                />
                <div className="rounded-brand border border-slate-700 bg-bg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Abono del plan</p>
                  <p className="mt-1 text-lg font-semibold text-secondary">${getPlanPrice(platformConfig, form.plan)}/mes</p>
                  <p className="mt-1 text-xs text-muted">
                    Limite alumnos: {formatPlanLimitValue(getPlanLimit(platformConfig, form.plan))}
                  </p>
                </div>
                <Input
                  label="Nombre del responsable"
                  value={form.ownerName}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerName: value }))}
                />
                <Input
                  label="Email del responsable"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerEmail: value }))}
                />
                <Input
                  label="WhatsApp del responsable"
                  value={form.ownerPhone}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerPhone: value }))}
                  required={false}
                />
                <Select
                  label="Rol del responsable"
                  value={form.ownerRole}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerRole: value as AcademyFormState["ownerRole"] }))}
                  options={["owner", "staff", "viewer"]}
                  formatter={formatAcademyRole}
                />
                <Input
                  label="Password temporal (opcional)"
                  type="text"
                  value={form.tempPassword}
                  onChange={(value) => setForm((prev) => ({ ...prev, tempPassword: value }))}
                />
                {error && <p className="text-danger">{error}</p>}
                {message && <p className="text-secondary">{message}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="rounded-brand border border-slate-600 px-3 py-2 text-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={submitting}
                    className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
                  >
                    {submitting ? "Creando..." : "Crear centro"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  helper,
  accent = ""
}: {
  label: string;
  value: string | number;
  color: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-brand border border-[#262626] bg-[#1A1A1A] p-5 shadow-soft ${accent}`}>
      <p className="text-xs uppercase tracking-wide text-[#B3B3B3]">{label}</p>
      <p className={`mt-3 font-display text-3xl ${color}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#B3B3B3]">{helper}</p> : null}
    </div>
  );
}

function MetricInline({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone: "success" | "warning" | "danger";
}) {
  const toneStyles = {
    success: "text-[#00C896]",
    warning: "text-[#F5A524]",
    danger: "text-[#FF4D4F]"
  } satisfies Record<typeof tone, string>;

  return (
    <div className="rounded-brand border border-[#262626] bg-[#1A1A1A] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-[#B3B3B3]">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneStyles[tone]}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#B3B3B3]">{helper}</p> : null}
    </div>
  );
}

function AlertCard({
  title,
  detail,
  tone
}: {
  title: string;
  detail: string;
  tone: "success" | "warning" | "danger";
}) {
  const toneStyles = {
    success: "border-[#00C896]/25 bg-[#00C896]/8 text-[#00C896]",
    warning: "border-[#F5A524]/25 bg-[#F5A524]/8 text-[#F5A524]",
    danger: "border-[#FF4D4F]/25 bg-[#FF4D4F]/8 text-[#FF4D4F]"
  } satisfies Record<typeof tone, string>;

  return (
    <div className={`rounded-brand border p-4 ${toneStyles[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-xs text-[#B3B3B3]">{detail}</p>
    </div>
  );
}

function Badge({
  children,
  tone
}: {
  children: string;
  tone: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  const styles = {
    primary: "border-primary/30 bg-primary/10 text-primary",
    success: "border-secondary/30 bg-secondary/10 text-secondary",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/30 bg-danger/10 text-danger",
    neutral: "border-slate-600 bg-slate-800/60 text-slate-200"
  } satisfies Record<typeof tone, string>;

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function SectionTab({
  label,
  active,
  onClick,
  disabled = false
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-brand px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-primary text-bg"
          : "border border-slate-600 text-muted hover:border-[#00D1FF] hover:text-[#00D1FF]"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid w-full gap-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={required && label !== "Password temporal (opcional)"}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  formatter
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatter: (value: string) => string;
}) {
  return (
    <label className="grid w-full gap-1">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatter(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
