import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import creatingCenterVideo from "../asset/Gen-4 Turbo - Animate this exact image of many cute kittens building a giant mobile app like a const.mp4";
import { auth, db, functions } from "../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanDescription,
  getPlanLabel,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../lib/plans";
import type { AcademyPlan } from "../lib/types";

interface RegisterFormState {
  academyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  confirmPassword: string;
  plan: AcademyPlan;
}

const DEFAULT_OWNER_PHONE = "+54 9 ";

const initialForm: RegisterFormState = {
  academyName: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: DEFAULT_OWNER_PHONE,
  password: "",
  confirmPassword: "",
  plan: "basic"
};

function normalizeOwnerPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  let localDigits = digits;

  if (localDigits.startsWith("549")) localDigits = localDigits.slice(3);
  else if (localDigits.startsWith("54")) localDigits = localDigits.slice(2);
  else if (localDigits.startsWith("9")) localDigits = localDigits.slice(1);

  const trimmedLocalDigits = localDigits.slice(0, 13);
  return `${DEFAULT_OWNER_PHONE}${trimmedLocalDigits}`.trimEnd();
}

function getRegisterErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "functions/already-exists":
      case "already-exists":
      case "auth/email-already-in-use":
        return "Ese email ya esta registrado. Inicia sesion con esa cuenta.";
      case "functions/invalid-argument":
      case "invalid-argument":
      case "auth/invalid-email":
        return "Revisa los datos ingresados y vuelve a intentar.";
      case "functions/internal":
        return "No se pudo crear la academia en este momento.";
      case "auth/network-request-failed":
        return "Fallo de red al intentar registrarte.";
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : "No se pudo completar el registro.";
}

export function RegisterAcademyPage() {
  const navigate = useNavigate();
  const { firebaseUser, isRoot, membership, loading, isPreviewMode } = useAuth();
  const [form, setForm] = useState<RegisterFormState>(initialForm);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registerAcademy = useMemo(
    () =>
      httpsCallable<
        {
          academyName: string;
          ownerName: string;
          ownerEmail: string;
          ownerPhone: string;
          password: string;
          plan: AcademyPlan;
        },
        {
          academyId: string;
          ownerUid: string;
          trialDurationDays: number;
        }
      >(functions, "registerAcademy"),
    []
  );

  useEffect(() => {
    async function loadPlatformConfig() {
      const configSnap = await getDoc(doc(db, "platform", "config"));
      setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }

    void loadPlatformConfig();
  }, []);

  if (isPreviewMode) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (!loading && firebaseUser) {
    if (isRoot) return <Navigate to="/root/dashboard" replace />;
    if (membership) return <Navigate to="/app/dashboard" replace />;
    return <Navigate to="/no-membership" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const academyName = form.academyName.trim();
    const ownerName = form.ownerName.trim();
    const ownerEmail = form.ownerEmail.trim().toLowerCase();
    const ownerPhone = normalizeOwnerPhone(form.ownerPhone);
    const ownerPhoneDigits = ownerPhone.replace(/\D/g, "");

    if (!academyName || !ownerName || !ownerEmail || !form.password.trim()) {
      setSubmitting(false);
      setError("Completa todos los campos para crear tu academia.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      setSubmitting(false);
      setError("El email no tiene un formato valido.");
      return;
    }

    if (ownerPhoneDigits.length <= 3) {
      setSubmitting(false);
      setError("Ingresa un numero de WhatsApp valido para el owner.");
      return;
    }

    if (form.password.length < 6) {
      setSubmitting(false);
      setError("La password debe tener al menos 6 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setSubmitting(false);
      setError("Las passwords no coinciden.");
      return;
    }

    try {
      const result = await registerAcademy({
        academyName,
        ownerName,
        ownerEmail,
        ownerPhone,
        password: form.password,
        plan: form.plan
      });

      setMessage(
        `Academia creada en trial por ${result.data.trialDurationDays} dias. Iniciando tu panel...`
      );
      await signInWithEmailAndPassword(auth, ownerEmail, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getRegisterErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-text">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(0,194,255,0.2),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(34,197,94,0.15),transparent_35%)]" />
      {submitting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft">
            <video
              src={creatingCenterVideo}
              autoPlay
              loop
              muted
              playsInline
              className="h-64 w-full rounded-brand border border-slate-700 bg-bg object-cover"
            />
            <div className="mt-4 text-center">
              <p className="font-display text-2xl text-primary">Creando centro...</p>
              <p className="mt-2 text-sm text-muted">
                Estamos preparando tu academia, tu cuenta owner y tu periodo de prueba.
              </p>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="z-10 w-full max-w-xl rounded-brand border border-slate-700/80 bg-surface p-6 shadow-soft">
        <h1 className="font-display text-3xl text-primary">Crea tu academia</h1>
        <p className="mt-2 text-sm text-muted">
          Empieza hoy mismo con PaySync. Tu cuenta owner y tu academia se crean automaticamente en modo prueba.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Field
            label="Nombre del centro"
            value={form.academyName}
            onChange={(value) => setForm((prev) => ({ ...prev, academyName: value }))}
          />
          <SelectField
            label="Plan"
            value={form.plan}
            onChange={(value) => setForm((prev) => ({ ...prev, plan: value as AcademyPlan }))}
            options={(["basic", "pro", "premium"] as AcademyPlan[]).map((plan) => ({
              value: plan,
              label: `${getPlanLabel(platformConfig, plan)} - $${getPlanPrice(platformConfig, plan)}/mes`
            }))}
          />
          <Field
            label="Tu nombre"
            value={form.ownerName}
            onChange={(value) => setForm((prev) => ({ ...prev, ownerName: value }))}
          />
          <Field
            label="Email"
            type="email"
            value={form.ownerEmail}
            onChange={(value) => setForm((prev) => ({ ...prev, ownerEmail: value }))}
          />
          <Field
            label="WhatsApp"
            type="tel"
            value={form.ownerPhone}
            onChange={(value) => setForm((prev) => ({ ...prev, ownerPhone: normalizeOwnerPhone(value) }))}
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
          />
          <Field
            label="Confirmar password"
            type="password"
            value={form.confirmPassword}
            onChange={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
          />
        </div>

        <div className="mt-4 rounded-brand border border-slate-700 bg-bg p-3 text-xs text-muted">
          El WhatsApp del owner queda listo con prefijo argentino para contactarlo sin corregir el numero.
        </div>
        <div className="mt-3 rounded-brand border border-slate-700 bg-bg p-3 text-xs text-muted">
          Se crea una sola cuenta por email. Si ya existe, solo tienes que iniciar sesion con ese mismo correo.
        </div>
        <div className="mt-3 rounded-brand border border-primary/20 bg-primary/5 p-3 text-sm text-muted">
          <p className="font-semibold text-text">{getPlanLabel(platformConfig, form.plan)} - ${getPlanPrice(platformConfig, form.plan)}/mes</p>
          <p className="mt-1">{getPlanDescription(platformConfig, form.plan)}</p>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {message && <p className="mt-4 text-sm text-secondary">{message}</p>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/login" className="text-sm text-muted transition hover:text-primary">
            Ya tengo cuenta
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-brand bg-primary px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
          >
            {submitting ? "Creando academia..." : "Crear academia"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
