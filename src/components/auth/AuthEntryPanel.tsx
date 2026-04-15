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
  getPlanHighlight,
  getPlanLabel,
  getPlanLimit,
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
        return "Email invalido.";
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
      "auth/invalid-email": "Email invalido.",
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
      setRegisterError("Email invalido.");
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
      setRegisterError("Las contrasenas no coinciden.");
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

  const registerRouteCta = "Todavia no usas PaySync? Crea tu cuenta";
  const compactEmbeddedRegister = embedded && mode === "register";
  const contentWidthClass = mode === "register" ? "max-w-2xl" : "max-w-md";
  const selectedPlanLimit = getPlanLimit(platformConfig, registerForm.plan);

  return (
    <div className={`relative ${embedded ? "w-full" : "w-full max-w-6xl"}`}>
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

      <div
        className={`overflow-hidden rounded-[28px] border border-white/10 bg-[#161616] shadow-soft ${
          embedded
            ? "max-h-[calc(100vh-1.5rem)] overflow-y-auto overscroll-contain"
            : "lg:grid lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]"
        }`}
      >
        <aside
          className={`border-b border-white/10 bg-[linear-gradient(180deg,#111111_0%,#0B0B0B_100%)] p-6 sm:p-7 lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:border-b-0 lg:border-r lg:p-8 ${
            compactEmbeddedRegister ? "hidden lg:block" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-primary">PaySync</p>
              {/* <p className="mt-2 max-w-sm text-sm leading-6 text-[#B3B3B3]">Ingresa a tu cuenta.</p> */}
            </div>
            {embedded && onRequestClose && (
              <button
                type="button"
                onClick={onRequestClose}
                aria-label="Cerrar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#B3B3B3] transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>

          {!embedded && (
            <div className="mt-6 rounded-[18px] border border-white/10 bg-[#1A1A1A] p-3.5 text-sm text-[#B3B3B3]">
              <p>Si ya tienes cuenta, entra y sigue donde lo dejaste.</p>
              <Link to="/" className="mt-3 inline-flex font-semibold text-primary transition hover:brightness-110">
                Volver a la landing
              </Link>
            </div>
          )}
        </aside>

        <section className={`bg-[#161616] p-5 sm:p-6 lg:p-8 ${embedded ? "overflow-y-auto" : ""}`}>
          <div className={`mx-auto flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${embedded ? "" : contentWidthClass}`}>
            <div>
              {/* <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B3B3B3]">Acceo</p> */}
              <h1 className={`mt-2 font-display leading-tight text-white ${compactEmbeddedRegister ? "text-[1.55rem] sm:text-[1.75rem]" : "text-[1.9rem]"}`}>
                {mode === "register" ? "Crea tu cuenta y empieza a usar PaySync" : "Inicia sesion"}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-white/10 bg-[#0B0B0B] p-1 sm:min-w-[220px]">
              <ToggleButton label="Ingresar" active={mode === "login"} onClick={() => setMode("login")} />
              <ToggleButton label="Registro" active={mode === "register"} onClick={() => setMode("register")} />
            </div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} autoComplete="off" className="mx-auto mt-6 grid w-full max-w-md gap-5">
              <div className="grid gap-4 rounded-[20px] border border-white/10 bg-[#0F0F0F] p-4 sm:p-5">
                <Field
                  label="Email"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  autoComplete="username"
                  placeholder="tu@email.com"
                />
                <Field
                  label="Contrasena"
                  type="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              {loginError && (
                <p className="rounded-[16px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{loginError}</p>
              )}

              <div className="grid gap-3">
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full rounded-[16px] bg-primary px-4 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-70"
                >
                  {loginSubmitting ? "Ingresando..." : "Ingresar"}
                </button>
                {embedded ? (
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="text-center text-sm font-medium text-primary transition hover:brightness-110"
                  >
                    Todavia no usas PaySync? Crea tu cuenta
                  </button>
                ) : (
                  <Link to="/register" className="text-center text-sm font-medium text-primary transition hover:brightness-110">
                    {registerRouteCta}
                  </Link>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} autoComplete="off" className={`mx-auto mt-6 grid w-full max-w-2xl ${compactEmbeddedRegister ? "gap-4" : "gap-5"}`}>
              <div className={`rounded-[20px] border border-primary/30 bg-gradient-to-br from-primary/12 via-primary/5 to-[#0B0B0B] text-sm text-[#B3B3B3] shadow-soft ${compactEmbeddedRegister ? "p-3.5" : "p-4"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Prueba gratis</p>
                <p className={`mt-2 font-semibold text-white ${compactEmbeddedRegister ? "text-[0.98rem] leading-6 sm:text-base" : "text-base leading-7 sm:text-lg"}`}>
                  Prueba PaySync gratis por {platformConfig.trialDurationDays} dias
                </p>
                <p className={`mt-2 ${compactEmbeddedRegister ? "leading-5" : "leading-6"}`}>Sin compromiso. Crea tu cuenta y empieza hoy.</p>
              </div>

              <div className={`grid ${compactEmbeddedRegister ? "gap-4" : "gap-5"}`}>
                <div className={`grid gap-4 rounded-[20px] border border-white/10 bg-[#0F0F0F] ${compactEmbeddedRegister ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}`}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Tu academia</p>
                    <p className="mt-1 text-sm text-[#B3B3B3]">Configuracion inicial en menos de 1 minuto</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <Field
                      label="Nombre del centro"
                      value={registerForm.academyName}
                      onChange={(value) => setRegisterForm((prev) => ({ ...prev, academyName: value }))}
                      autoComplete="off"
                      placeholder="Ej: Academia Central"
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
                  <div className="rounded-[16px] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-[#B3B3B3]">
                    <p className="font-medium text-white">
                      {selectedPlanLimit === null
                        ? "Este plan permite alumnos ilimitados."
                        : `Este plan permite hasta ${selectedPlanLimit} alumnos activos.`}
                    </p>
                    <p className="mt-1">{getPlanHighlight(platformConfig, registerForm.plan)}</p>
                  </div>
                </div>

                <div className={`grid gap-4 rounded-[20px] border border-white/10 bg-[#0F0F0F] ${compactEmbeddedRegister ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}`}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Tus datos</p>
                    <p className="mt-1 text-sm text-[#B3B3B3]">Completa tus datos para entrar y administrar tu academia.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Nombre"
                      value={registerForm.ownerName}
                      onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerName: value }))}
                      autoComplete="off"
                      placeholder="Tu nombre"
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={registerForm.ownerEmail}
                      onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerEmail: value }))}
                      autoComplete="off"
                      placeholder="tu@email.com"
                    />
                  </div>
                  <PhoneField
                    label="WhatsApp"
                    value={registerForm.ownerPhone}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, ownerPhone: value }))}
                    helperText="Para recordatorios y contacto (opcional)"
                  />
                </div>
              </div>

              <div className={`grid gap-4 rounded-[20px] border border-white/10 bg-[#0F0F0F] ${compactEmbeddedRegister ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}`}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Acceso</p>
                  <p className="mt-1 text-sm text-[#B3B3B3]">Usa una contrasena segura</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Contrasena"
                    type="password"
                    value={registerForm.password}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  <Field
                    label="Confirmar contrasena"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(value) => setRegisterForm((prev) => ({ ...prev, confirmPassword: value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-[#121212] px-4 py-3 text-sm text-[#B3B3B3]">
                <p>
                  Plan seleccionado: <span className="font-semibold text-white">{getPlanLabel(platformConfig, registerForm.plan)}</span>
                </p>
                <p className="mt-1">{getPlanDescription(platformConfig, registerForm.plan)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">
                  {selectedPlanLimit === null ? "Alumnos ilimitados" : `Hasta ${selectedPlanLimit} alumnos activos`}
                </p>
              </div>

              {registerError && (
                <p className="rounded-[16px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{registerError}</p>
              )}
              {registerMessage && (
                <p className="rounded-[16px] border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary">
                  {registerMessage}
                </p>
              )}

              <div className="grid gap-3">
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="w-full rounded-[16px] bg-primary px-4 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-70"
                >
                  {registerSubmitting ? "Creando cuenta..." : "Crear cuenta"}
                </button>
                <p className="text-center text-xs text-[#B3B3B3]">
                  Luego continua en ${getPlanPrice(platformConfig, registerForm.plan)}/mes. Cancelas cuando quieras.
                </p>
                {embedded ? (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[#B3B3B3] transition hover:border-white/20 hover:text-white"
                  >
                    Ingresar
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-[#B3B3B3] transition hover:border-white/20 hover:text-white"
                  >
                    Ingresar
                  </Link>
                )}
              </div>
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
        active ? "bg-primary text-[#0B0B0B]" : "text-[#B3B3B3] hover:text-white"
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
  autoComplete,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="min-h-11 rounded-[14px] border border-white/10 bg-[#111111] px-3.5 py-2.5 text-white outline-none ring-0 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,200,150,0.18)]"
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
        className="min-h-11 rounded-[14px] border border-white/10 bg-[#111111] px-3.5 py-2.5 text-white outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,200,150,0.18)]"
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
  onChange,
  helperText
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
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
        className="phone-input min-h-11 rounded-[14px] border border-white/10 bg-[#111111] px-3.5 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(0,200,150,0.18)]"
      />
      {helperText ? <span className="text-xs text-[#B3B3B3]">{helperText}</span> : null}
    </label>
  );
}
