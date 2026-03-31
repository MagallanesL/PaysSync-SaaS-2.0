import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import creatingCenterVideo from "../../asset/Gen-4 Turbo - Animate this exact image of many cute kittens building a giant mobile app like a const.mp4";
import { auth, db, functions } from "../../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanDescription,
  getPlanLabel,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../../lib/plans";
import type { AcademyPlan } from "../../lib/types";

type AuthMode = "login" | "register";

interface RegisterFormState {
  academyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  confirmPassword: string;
  plan: AcademyPlan;
}

const initialRegisterForm: RegisterFormState = {
  academyName: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  password: "",
  confirmPassword: "",
  plan: "basic"
};

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

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    const authMessageByCode: Record<string, string> = {
      "auth/invalid-credential": "Email o password incorrectos, o la cuenta no existe en Firebase Authentication.",
      "auth/invalid-email": "El email no tiene un formato valido.",
      "auth/user-disabled": "Esta cuenta esta deshabilitada en Firebase Authentication.",
      "auth/too-many-requests": "Demasiados intentos fallidos. Espera un momento y vuelve a intentar.",
      "auth/network-request-failed": "Fallo de red al intentar iniciar sesion."
    };
    return authMessageByCode[error.code] ?? `${error.code}: ${error.message}`;
  }

  return error instanceof Error ? error.message : "No se pudo iniciar sesion.";
}

export function AuthEntryPanel({
  initialMode,
  embedded = false,
  onRequestClose
}: {
  initialMode: AuthMode;
  embedded?: boolean;
  onRequestClose?: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [registerForm, setRegisterForm] = useState<RegisterFormState>(initialRegisterForm);
  const [registerError, setRegisterError] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

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

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setRegisterForm(initialRegisterForm);
    setRegisterError("");
    setRegisterMessage("");
  }, [mode]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginSubmitting(true);
    setLoginError("");

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      navigate("/", { replace: true });
      onRequestClose?.();
    } catch (error) {
      setLoginError(getLoginErrorMessage(error));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterSubmitting(true);
    setRegisterError("");
    setRegisterMessage("");

    const academyName = registerForm.academyName.trim();
    const ownerName = registerForm.ownerName.trim();
    const ownerEmail = registerForm.ownerEmail.trim().toLowerCase();
    const ownerPhone = registerForm.ownerPhone.trim();

    if (!academyName || !ownerName || !ownerEmail || !registerForm.password.trim()) {
      setRegisterSubmitting(false);
      setRegisterError("Completa todos los campos para crear tu academia.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      setRegisterSubmitting(false);
      setRegisterError("El email no tiene un formato valido.");
      return;
    }

    if (!ownerPhone) {
      setRegisterSubmitting(false);
      setRegisterError("Ingresa un numero de WhatsApp para el owner.");
      return;
    }

    if (!isValidPhoneNumber(ownerPhone)) {
      setRegisterSubmitting(false);
      setRegisterError("Ingresa un numero de WhatsApp valido.");
      return;
    }

    if (registerForm.password.length < 6) {
      setRegisterSubmitting(false);
      setRegisterError("La password debe tener al menos 6 caracteres.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterSubmitting(false);
      setRegisterError("Las passwords no coinciden.");
      return;
    }

    try {
      const result = await registerAcademy({
        academyName,
        ownerName,
        ownerEmail,
        ownerPhone,
        password: registerForm.password,
        plan: registerForm.plan
      });

      setRegisterMessage(`Academia creada en trial por ${result.data.trialDurationDays} dias. Iniciando tu panel...`);
      await signInWithEmailAndPassword(auth, ownerEmail, registerForm.password);
      navigate("/", { replace: true });
      onRequestClose?.();
    } catch (error) {
      setRegisterError(getRegisterErrorMessage(error));
    } finally {
      setRegisterSubmitting(false);
    }
  }

  return (
    <div className={`relative ${embedded ? "" : "w-full max-w-5xl"}`}>
      {registerSubmitting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-slate-950/88 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-slate-700/80 bg-surface p-4 shadow-soft">
            <video
              src={creatingCenterVideo}
              autoPlay
              loop
              muted
              playsInline
              className="h-56 w-full rounded-[20px] border border-slate-700 bg-bg object-cover"
            />
            <div className="mt-4 text-center">
              <p className="font-display text-2xl text-primary">Creando centro...</p>
              <p className="mt-2 text-sm text-muted">Estamos preparando tu academia, tu cuenta owner y tu periodo de prueba.</p>
            </div>
          </div>
        </div>
      )}

      <div className={`overflow-hidden rounded-[24px] border border-slate-700/80 bg-surface shadow-soft ${embedded ? "" : "lg:grid lg:grid-cols-[0.9fr_1.1fr]"}`}>
        <aside className="border-b border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(11,16,32,0.96))] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-primary">PaySync</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                Cobra cuotas, ordena alumnos y gestiona tu centro con una experiencia mas clara desde el primer dia.
              </p>
            </div>
            {embedded && onRequestClose && (
              <button
                type="button"
                onClick={onRequestClose}
                className="rounded-[14px] border border-slate-700 px-3 py-2 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                Cerrar
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[18px] border border-slate-800 bg-bg/80 p-3.5">
              <p className="text-xs uppercase tracking-[0.22em] text-primary">Ideal para</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">Academias, gimnasios, escuelas de danza, equipos y centros deportivos.</p>
            </div>
            <div className="rounded-[18px] border border-slate-800 bg-bg/80 p-3.5">
              <p className="text-xs uppercase tracking-[0.22em] text-secondary">Incluye</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">Prueba gratis por {platformConfig.trialDurationDays} dias, control de cuotas y visibilidad del mes.</p>
            </div>
          </div>

          {!embedded && (
            <div className="mt-6 rounded-[18px] border border-slate-800 bg-bg/70 p-3.5 text-sm text-muted">
              <p>Si ya tienes cuenta, entra y sigue donde lo dejaste.</p>
              <Link to="/" className="mt-3 inline-flex font-semibold text-primary transition hover:brightness-110">
                Volver a la landing
              </Link>
            </div>
          )}
        </aside>

        <section className="p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Acceso</p>
              <h1 className="mt-2 font-display text-[1.9rem] text-text">
                {mode === "register" ? "Crea tu academia" : "Ingresa a tu cuenta"}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-slate-700 bg-bg p-1">
              <ToggleButton label="Ingresar" active={mode === "login"} onClick={() => setMode("login")} />
              <ToggleButton label="Registro" active={mode === "register"} onClick={() => setMode("register")} />
            </div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} autoComplete="off" className="mt-6 grid gap-4">
              <div className="grid gap-4">
                <Field label="Email" type="email" value={loginEmail} onChange={setLoginEmail} autoComplete="username" />
                <Field
                  label="Password"
                  type="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  autoComplete="current-password"
                />
              </div>

              <div className="rounded-[18px] border border-slate-700 bg-bg/70 p-3.5 text-sm text-muted">
                Entra para seguir con tus alumnos, cuotas y pagos desde donde lo dejaste.
              </div>

              {loginError && <p className="text-sm text-danger">{loginError}</p>}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-left text-sm text-muted transition hover:text-primary"
                >
                  Aun no tienes cuenta?
                </button>
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="rounded-[14px] bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
                >
                  {loginSubmitting ? "Ingresando..." : "Ingresar"}
                </button>
              </div>

              {!embedded && (
                <Link to="/register" className="text-sm text-muted transition hover:text-primary">
                  Prefieres la pagina de registro completa?
                </Link>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} autoComplete="off" className="mt-6 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-4 rounded-[18px] border border-slate-700/80 bg-bg/70 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Centro</p>
                    <p className="mt-1 text-sm text-muted">Define el nombre y el plan con el que quieres empezar.</p>
                  </div>
                  <Field
                    label="Nombre del centro"
                    value={registerForm.academyName}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, academyName: value }))}
                    autoComplete="off"
                  />
                  <SelectField
                    label="Plan"
                    value={registerForm.plan}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, plan: value as AcademyPlan }))}
                    options={(["basic", "pro", "premium"] as AcademyPlan[]).map((plan) => ({
                      value: plan,
                      label: getPlanLabel(platformConfig, plan)
                    }))}
                  />
                </div>

                <div className="grid gap-4 rounded-[18px] border border-slate-700/80 bg-bg/70 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Responsable</p>
                    <p className="mt-1 text-sm text-muted">Estos datos se usarán para entrar y para el contacto principal.</p>
                  </div>
                  <Field
                    label="Tu nombre"
                    value={registerForm.ownerName}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerName: value }))}
                    autoComplete="off"
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={registerForm.ownerEmail}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerEmail: value }))}
                    autoComplete="off"
                  />
                  <PhoneField
                    label="WhatsApp"
                    value={registerForm.ownerPhone}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerPhone: value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 rounded-[18px] border border-slate-700/80 bg-bg/70 p-4 sm:grid-cols-2">
                <Field
                  label="Password"
                  type="password"
                  value={registerForm.password}
                  onChange={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
                  autoComplete="new-password"
                />
                <Field
                  label="Confirmar password"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(value) => setRegisterForm((prev) => ({ ...prev, confirmPassword: value }))}
                  autoComplete="new-password"
                />
              </div>

              <div className="rounded-[18px] border border-primary/30 bg-gradient-to-br from-primary/12 via-primary/5 to-bg p-4 text-sm text-muted shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Tu inicio en PaySync</p>
                <p className="mt-2 text-base font-semibold leading-7 text-text sm:text-lg">
                  Prueba gratis por {platformConfig.trialDurationDays} dias con plan {getPlanLabel(platformConfig, registerForm.plan)}
                </p>
                <p className="mt-2 leading-6">
                  Luego continua en ${getPlanPrice(platformConfig, registerForm.plan)}/mes. {getPlanDescription(platformConfig, registerForm.plan)}
                </p>
              </div>

              {registerError && <p className="text-sm text-danger">{registerError}</p>}
              {registerMessage && <p className="text-sm text-secondary">{registerMessage}</p>}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-left text-sm text-muted transition hover:text-primary"
                >
                  Ya tienes cuenta?
                </button>
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="rounded-[14px] bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
                >
                  {registerSubmitting ? "Creando academia..." : "Crear academia"}
                </button>
              </div>

              {!embedded && (
                <Link to="/login" className="text-sm text-muted transition hover:text-primary">
                  Prefieres la pagina de login completa?
                </Link>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[12px] px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-bg" : "text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="min-h-11 rounded-[14px] border border-slate-600 bg-slate-950/70 px-3.5 py-2.5 text-text outline-none focus:border-primary"
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
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-[14px] border border-slate-600 bg-slate-950/70 px-3.5 py-2.5 text-text outline-none focus:border-primary"
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

function PhoneField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <PhoneInput
        international
        defaultCountry="AR"
        countryCallingCodeEditable={false}
        placeholder="Ingresa tu WhatsApp"
        value={value || undefined}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        autoComplete="off"
        className="phone-input min-h-11 rounded-[14px] border border-slate-600 bg-slate-950/70 px-3.5 py-2.5 focus-within:border-primary"
      />
    </label>
  );
}
