import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { formatAcademyRole, formatMembershipStatus } from "../../lib/display";
import { db, functions } from "../../lib/firebase";
import type { AcademyRole } from "../../lib/types";

interface AcademyUser {
  id: string;
  email: string;
  displayName?: string;
  role: AcademyRole;
  status: string;
}

interface CreateUserFormState {
  displayName: string;
  email: string;
  password: string;
  role: AcademyRole;
}

const initialForm: CreateUserFormState = {
  displayName: "",
  email: "",
  password: "",
  role: "viewer"
};

function generateTemporaryPassword() {
  return `PaySync-${Math.random().toString(36).slice(-10)}A1`;
}

function shortenId(value: string, visible = 8) {
  if (value.length <= visible * 2) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

function validateForm(form: CreateUserFormState) {
  const displayName = form.displayName.trim();
  const email = form.email.trim().toLowerCase();
  const password = form.password.trim();

  if (!displayName) {
    return { displayName, email, password, error: "Ingresa el nombre del usuario." };
  }
  if (!email) {
    return { displayName, email, password, error: "Ingresa un email valido." };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { displayName, email, password, error: "El email no tiene un formato valido." };
  }
  if (password && password.length < 6) {
    return { displayName, email, password, error: "La password debe tener al menos 6 caracteres." };
  }

  return { displayName, email, password, error: null };
}

function getUserCreationError(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "functions/already-exists":
      case "already-exists":
      case "auth/email-already-in-use":
        return "Ese email ya existe en Firebase Auth.";
      case "functions/invalid-argument":
      case "invalid-argument":
      case "auth/invalid-email":
        return "El email ingresado no es valido.";
      case "functions/failed-precondition":
      case "failed-precondition":
        return "La academia no esta habilitada para crear usuarios.";
      case "functions/permission-denied":
      case "permission-denied":
      case "firestore/permission-denied":
        return "No tienes permisos para guardar este usuario en Firestore.";
      case "functions/unauthenticated":
        return "Tu sesion ya no es valida. Vuelve a iniciar sesion.";
      case "functions/internal":
        return "No se pudo crear el usuario en el backend.";
      case "auth/weak-password":
        return "La password es demasiado debil.";
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : "No se pudo crear el usuario.";
}

export function UsersPage() {
  const { membership, isPreviewMode } = useAuth();
  const [users, setUsers] = useState<AcademyUser[]>([]);
  const [form, setForm] = useState<CreateUserFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createAcademyUser = httpsCallable<
    {
      academyId: string;
      displayName: string;
      email: string;
      role: AcademyRole;
      password?: string;
    },
    {
      uid: string;
      email: string;
      generatedPassword: string | null;
    }
  >(functions, "createAcademyUser");

  const canManageUsers = membership?.role === "owner";

  async function loadUsers() {
    if (isPreviewMode) {
      setUsers([
        {
          id: "preview-user",
          email: "explore@paysync.local",
          displayName: "Owner Demo",
          role: "owner",
          status: "active"
        },
        {
          id: "staff-demo",
          email: "staff@paysync.local",
          displayName: "Staff Demo",
          role: "staff",
          status: "active"
        },
        {
          id: "viewer-demo",
          email: "viewer@paysync.local",
          displayName: "Viewer Demo",
          role: "viewer",
          status: "active"
        }
      ]);
      setLoading(false);
      return;
    }

    if (!membership) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const snap = await getDocs(collection(db, `academies/${membership.academyId}/users`));
    setUsers(
      snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AcademyUser, "id">)
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, [isPreviewMode, membership?.academyId]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!membership) {
      setError("No se encontro un centro activo para crear usuarios.");
      return;
    }

    if (!canManageUsers) {
      setError("Solo el propietario puede crear usuarios desde este panel.");
      return;
    }

    const normalized = validateForm(form);
    if (normalized.error) {
      setError(normalized.error);
      setMessage(null);
      return;
    }

    const finalPassword = normalized.password || generateTemporaryPassword();

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createAcademyUser({
        academyId: membership.academyId,
        displayName: normalized.displayName,
        email: normalized.email,
        role: form.role,
        password: normalized.password || undefined
      });

      setForm(initialForm);
      setMessage(
        result.data.generatedPassword
          ? `Usuario creado correctamente. Password temporal: ${result.data.generatedPassword}`
          : normalized.password
          ? "Usuario creado correctamente."
          : `Usuario creado correctamente. Password temporal: ${finalPassword}`
      );
      await loadUsers();
    } catch (creationError) {
      setError(getUserCreationError(creationError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Panel title="Equipo del centro">
          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="rounded-brand border border-slate-800 bg-bg/60 px-4 py-5 text-sm text-muted">Cargando...</div>
            ) : users.length === 0 ? (
              <div className="rounded-brand border border-slate-800 bg-bg/60 px-4 py-5 text-sm text-muted">
                No hay usuarios cargados todavia.
              </div>
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-brand border border-slate-800 bg-bg/60 p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-text break-words">{user.displayName ?? "Sin nombre"}</p>
                      <p className="mt-1 text-sm text-muted break-all">{user.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {formatAcademyRole(user.role)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-brand border border-slate-800 bg-slate-950/30 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted">UID</dt>
                      <dd className="mt-1 font-mono text-xs text-text" title={user.id}>
                        {shortenId(user.id, 6)}
                      </dd>
                    </div>
                    <div className="rounded-brand border border-slate-800 bg-slate-950/30 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted">Estado</dt>
                      <dd className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        {formatMembershipStatus(user.status)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">UID</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={5}>
                      Cargando...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={5}>
                      No hay usuarios cargados todavia.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-slate-800">
                      <td className="px-3 py-3 font-mono text-xs text-muted">{shortenId(user.id)}</td>
                      <td className="px-3 py-3 break-words">{user.displayName ?? "-"}</td>
                      <td className="px-3 py-3 break-all">{user.email}</td>
                      <td className="px-3 py-3 uppercase text-primary">{formatAcademyRole(user.role)}</td>
                      <td className="px-3 py-3 uppercase text-muted">{formatMembershipStatus(user.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        <Panel title="Alta de usuarios">
          {canManageUsers ? (
            <form onSubmit={handleCreateUser} className="grid gap-3 text-sm">
              <Input
                label="Nombre"
                value={form.displayName}
                onChange={(value) => setForm((prev) => ({ ...prev, displayName: value }))}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
              />
              <Select
                label="Rol"
                value={form.role}
                onChange={(value) => setForm((prev) => ({ ...prev, role: value as AcademyRole }))}
                options={["owner", "staff", "viewer"]}
              />
              <Input
                label="Password temporal (opcional)"
                type="text"
                value={form.password}
                onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                required={false}
              />
              <p className="text-xs text-muted">
                Si dejas la password vacia, PaySync genera una temporal y mantiene tu sesion principal intacta.
              </p>
              {error && <p className="text-danger">{error}</p>}
              {message && <p className="text-secondary">{message}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
              >
                {submitting ? "Creando..." : "Crear usuario"}
              </button>
            </form>
          ) : (
            <div className="space-y-2 text-sm text-muted">
              <p>Solo el propietario puede dar de alta usuarios desde este panel.</p>
              <p>Tu rol actual es {formatAcademyRole(membership?.role ?? "viewer").toUpperCase()}.</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
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
    <label className="grid gap-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={required}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatAcademyRole(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
