import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Panel } from "../../components/ui/Panel";
import { db, functions } from "../../lib/firebase";
import { PLAN_LIMITS, PLAN_PRICES, formatPlanLimit } from "../../lib/plans";
import type { Academy, AcademyPlan } from "../../lib/types";

interface AcademyFormState {
  academyName: string;
  plan: AcademyPlan;
  ownerName: string;
  ownerEmail: string;
  ownerRole: "owner" | "staff" | "viewer";
  tempPassword: string;
}

interface CreateAcademyResult {
  academyId: string;
  ownerUid: string;
  generatedPassword: string | null;
  isExistingUser: boolean;
}

interface EditState {
  id: string;
  name: string;
  plan: AcademyPlan;
  status: Academy["status"];
}

const initialForm: AcademyFormState = {
  academyName: "",
  plan: "basic",
  ownerName: "",
  ownerEmail: "",
  ownerRole: "owner",
  tempPassword: ""
};

export function RootDashboardPage() {
  const { profile, logout } = useAuth();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AcademyFormState>(initialForm);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAcademies() {
    setLoading(true);
    const academySnap = await getDocs(collection(db, "academies"));
    setAcademies(
      academySnap.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<Academy, "id"> & { plan?: string };
        const normalizedPlan = data.plan as AcademyPlan;
        return {
          id: docSnap.id,
          ...data,
          plan: normalizedPlan,
          planLimits: {
            maxStudents: data.planLimits?.maxStudents ?? PLAN_LIMITS[normalizedPlan]
          }
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadAcademies();
  }, []);

  const kpis = useMemo(() => {
    const total = academies.length;
    const trials = academies.filter((academy) => academy.status === "trial").length;
    const active = academies.filter((academy) => academy.status === "active").length;
    const suspended = academies.filter((academy) => academy.status === "suspended").length;
    const mrr = academies
      .filter((academy) => academy.status === "active")
      .reduce((sum, academy) => sum + PLAN_PRICES[academy.plan], 0);
    return { total, trials, active, suspended, mrr };
  }, [academies]);

  async function handleCreateAcademy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    console.log("[PaySync] createAcademyWithOwner:start", {
      academyName: form.academyName,
      ownerEmail: form.ownerEmail,
      plan: form.plan,
      ownerRole: form.ownerRole
    });

    try {
      const callable = httpsCallable(functions, "createAcademyWithOwner");
      const response = await callable({
        academyName: form.academyName,
        plan: form.plan,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerRole: form.ownerRole,
        password: form.tempPassword || undefined
      });
      const data = response.data as CreateAcademyResult;

      console.log("[PaySync] createAcademyWithOwner:success", data);
      setMessage(
        data.generatedPassword
          ? `Academia creada. Password temporal generado: ${data.generatedPassword}`
          : "Academia creada correctamente."
      );
      setForm(initialForm);
      await loadAcademies();
    } catch (err) {
      const errorObject = err as {
        code?: string;
        message?: string;
        details?: unknown;
        customData?: unknown;
      };

      console.error("[PaySync] createAcademyWithOwner:error", {
        code: errorObject?.code ?? null,
        message: errorObject?.message ?? null,
        details: errorObject?.details ?? null,
        customData: errorObject?.customData ?? null
      });

      if (err instanceof FirebaseError) {
        if (err.code === "functions/unavailable") {
          setError("La Cloud Function createAcademyWithOwner no responde. Compila y despliega functions en este proyecto Firebase.");
        } else if (err.code === "functions/permission-denied") {
          setError("La cuenta autenticada no tiene rol root en users/{uid}.");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "No se pudo crear la academia.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAcademyStatus(academy: Academy) {
    const nextStatus: Academy["status"] = academy.status === "suspended" ? "active" : "suspended";
    await updateDoc(doc(db, "academies", academy.id), {
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
    await loadAcademies();
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editState) return;

    await updateDoc(doc(db, "academies", editState.id), {
      name: editState.name,
      plan: editState.plan,
      status: editState.status,
      planLimits: {
        maxStudents: PLAN_LIMITS[editState.plan]
      },
      updatedAt: serverTimestamp()
    });
    setEditState(null);
    await loadAcademies();
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-4 text-text md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-brand border border-slate-700/80 bg-surface px-5 py-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-primary">PaySync Root Panel</p>
              <p className="text-sm text-muted">
                {profile?.displayName} · <span className="uppercase text-primary">ROOT</span>
              </p>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary"
            >
              Cerrar sesion
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Academias" value={kpis.total} color="text-primary" />
          <KpiCard label="Trials" value={kpis.trials} color="text-warning" />
          <KpiCard label="Activas" value={kpis.active} color="text-secondary" />
          <KpiCard label="Suspendidas" value={kpis.suspended} color="text-danger" />
          <KpiCard label="MRR estimado" value={`$${kpis.mrr}`} color="text-text" />
        </section>

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Panel title="Academias">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Limite</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={6}>
                          Cargando...
                        </td>
                      </tr>
                    ) : academies.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={6}>
                          No hay academias todavia.
                        </td>
                      </tr>
                    ) : (
                      academies.map((academy) => (
                        <tr key={academy.id} className="border-t border-slate-800">
                          <td className="px-3 py-3">{academy.name}</td>
                          <td className="px-3 py-3 uppercase text-primary">{academy.plan}</td>
                          <td className="px-3 py-3 text-muted">{formatPlanLimit(academy.plan)}</td>
                          <td className="px-3 py-3 uppercase text-muted">{academy.status}</td>
                          <td className="px-3 py-3 text-muted">{academy.owner?.email}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  setEditState({
                                    id: academy.id,
                                    name: academy.name,
                                    plan: academy.plan,
                                    status: academy.status
                                  })
                                }
                                className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => void handleToggleAcademyStatus(academy)}
                                className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-warning hover:text-warning"
                              >
                                {academy.status === "suspended" ? "Habilitar" : "Suspender"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Panel title="Crear academia">
              <form onSubmit={handleCreateAcademy} className="grid gap-3 text-sm">
                <Input
                  label="Nombre academia"
                  value={form.academyName}
                  onChange={(value) => setForm((prev) => ({ ...prev, academyName: value }))}
                />
                <Select
                  label="Plan"
                  value={form.plan}
                  onChange={(value) => setForm((prev) => ({ ...prev, plan: value as AcademyPlan }))}
                  options={["basic", "pro", "premium"]}
                />
                <Input
                  label="Owner name"
                  value={form.ownerName}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerName: value }))}
                />
                <Input
                  label="Owner email"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerEmail: value }))}
                />
                <Select
                  label="Owner role"
                  value={form.ownerRole}
                  onChange={(value) => setForm((prev) => ({ ...prev, ownerRole: value as AcademyFormState["ownerRole"] }))}
                  options={["owner", "staff", "viewer"]}
                />
                <Input
                  label="Password temporal (opcional)"
                  type="text"
                  value={form.tempPassword}
                  onChange={(value) => setForm((prev) => ({ ...prev, tempPassword: value }))}
                />
                {error && <p className="text-danger">{error}</p>}
                {message && <p className="text-secondary">{message}</p>}
                <button
                  disabled={submitting}
                  className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-70"
                >
                  {submitting ? "Creando..." : "Crear academia"}
                </button>
              </form>
            </Panel>

            {editState && (
              <Panel title="Editar academia">
                <form onSubmit={(event) => void handleSaveEdit(event)} className="grid gap-3 text-sm">
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
                  />
                  <Select
                    label="Estado"
                    value={editState.status}
                    onChange={(value) =>
                      setEditState((prev) => (prev ? { ...prev, status: value as Academy["status"] } : prev))
                    }
                    options={["trial", "active", "suspended"]}
                  />
                  <p className="text-xs text-muted">Limite alumnos: {formatPlanLimit(editState.plan)}</p>
                  <div className="flex gap-2">
                    <button className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg">Guardar</button>
                    <button
                      type="button"
                      onClick={() => setEditState(null)}
                      className="rounded-brand border border-slate-600 px-3 py-2 text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function Input({
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
    <label className="grid gap-1">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={label !== "Password temporal (opcional)"}
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
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
