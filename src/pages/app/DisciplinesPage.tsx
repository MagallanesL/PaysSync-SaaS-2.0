import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import type { FeeCategory, FeePaymentMode } from "../../lib/fees";

interface Discipline {
  id: string;
  name: string;
  billingType: FeeCategory;
  paymentMode?: FeePaymentMode;
  allowPartial?: boolean;
  price: number;
  active: boolean;
  note?: string;
}

interface DisciplineFormState {
  name: string;
  billingType: FeeCategory;
  paymentMode: FeePaymentMode;
  allowPartial: boolean;
  price: string;
  note: string;
}

const categoryLabels: Record<FeeCategory, string> = {
  monthly_fee: "Disciplina mensual",
  enrollment: "Matricula",
  exam: "Examen",
  product: "Producto",
  uniform: "Indumentaria",
  other: "Otro"
};

const paymentModeLabels: Record<FeePaymentMode, string> = {
  monthly: "Mensual automatica",
  one_time: "Cargo unico"
};

const emptyForm: DisciplineFormState = {
  name: "",
  billingType: "monthly_fee",
  paymentMode: "monthly",
  allowPartial: false,
  price: "",
  note: ""
};

function sortDisciplines(items: Discipline[]) {
  return [...items].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export function DisciplinesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [form, setForm] = useState<DisciplineFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadDisciplines() {
    if (isPreviewMode) {
      setDisciplines(
        sortDisciplines([
          {
            id: "disc-1",
            name: "Freestyle",
            billingType: "monthly_fee",
            paymentMode: "monthly",
            allowPartial: false,
            price: 20000,
            active: true,
            note: ""
          },
          {
            id: "disc-2",
            name: "Indumentaria oficial",
            billingType: "uniform",
            paymentMode: "one_time",
            allowPartial: true,
            price: 12000,
            active: false,
            note: ""
          }
        ])
      );
      return;
    }

    if (!academyPath) return;
    const snap = await getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc")));
    setDisciplines(sortDisciplines(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<Discipline, "id">) }))));
  }

  useEffect(() => {
    void loadDisciplines();
  }, [academyPath, isPreviewMode]);

  useEffect(() => {
    if (!isModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyPath || !canWriteAcademyData || isPreviewMode) return;

    const payload = {
      name: form.name.trim(),
      billingType: form.billingType,
      paymentMode: form.paymentMode,
      allowPartial: form.allowPartial,
      price: Number(form.price),
      active: editingId ? disciplines.find((discipline) => discipline.id === editingId)?.active ?? true : true,
      note: form.note.trim(),
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      await updateDoc(doc(db, `${academyPath}/disciplines`, editingId), payload);
    } else {
      await addDoc(collection(db, `${academyPath}/disciplines`), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeModal();
    await loadDisciplines();
  }

  async function handleToggleStatus(discipline: Discipline) {
    if (!canWriteAcademyData || isPreviewMode) return;

    const nextActive = !discipline.active;
    if (academyPath) {
      await updateDoc(doc(db, `${academyPath}/disciplines`, discipline.id), {
        active: nextActive,
        updatedAt: serverTimestamp()
      });
      await loadDisciplines();
      return;
    }

    setDisciplines((prev) =>
      sortDisciplines(prev.map((item) => (item.id === discipline.id ? { ...item, active: nextActive } : item)))
    );
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function handleEdit(discipline: Discipline) {
    setEditingId(discipline.id);
    setForm({
      name: discipline.name,
      billingType: discipline.billingType,
      paymentMode: discipline.paymentMode ?? (discipline.billingType === "monthly_fee" ? "monthly" : "one_time"),
      allowPartial: Boolean(discipline.allowPartial),
      price: String(discipline.price),
      note: discipline.note ?? ""
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(false);
  }

  return (
    <>
      <Panel
        title="Disciplinas y servicios"
        action={
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canWriteAcademyData || isPreviewMode}
            className="rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
          >
            {isPreviewMode ? "Modo demo" : "Crear disciplina"}
          </button>
        }
      >
        <div className="space-y-3 md:hidden">
          {disciplines.map((discipline) => (
            <article
              key={discipline.id}
              className={`rounded-brand border border-slate-800 bg-bg p-4 ${discipline.active ? "" : "opacity-80"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{discipline.name}</p>
                  <p className="text-sm text-muted">{categoryLabels[discipline.billingType]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(discipline)}
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className={`shrink-0 rounded-brand px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                    discipline.active
                      ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                      : "bg-danger/15 text-danger hover:bg-danger/25"
                  }`}
                >
                  {discipline.active ? "Activa" : "Inactiva"}
                </button>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted">
                <MobileInfo
                  label="Modalidad"
                  value={paymentModeLabels[discipline.paymentMode ?? (discipline.billingType === "monthly_fee" ? "monthly" : "one_time")]}
                />
                <MobileInfo label="Valor base" value={`$${discipline.price}`} />
                <MobileInfo label="Pagos" value={discipline.allowPartial ? "Permite entregas" : "Pago completo"} />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleEdit(discipline)}
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="w-full rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
          {disciplines.length === 0 && <p className="text-sm text-muted">Todavia no hay disciplinas cargadas.</p>}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Valor base</th>
                <th className="px-3 py-2">Pagos</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {disciplines.map((discipline) => (
                <tr key={discipline.id} className={`border-t border-slate-800 ${discipline.active ? "" : "opacity-80"}`}>
                  <td className="px-3 py-3">{discipline.name}</td>
                  <td className="px-3 py-3 text-muted">{categoryLabels[discipline.billingType]}</td>
                  <td className="px-3 py-3 text-muted">
                    {paymentModeLabels[discipline.paymentMode ?? (discipline.billingType === "monthly_fee" ? "monthly" : "one_time")]}
                  </td>
                  <td className="px-3 py-3 text-primary">${discipline.price}</td>
                  <td className="px-3 py-3 text-muted">{discipline.allowPartial ? "Permite entregas" : "Pago completo"}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(discipline)}
                      disabled={!canWriteAcademyData || isPreviewMode}
                      className={`rounded-brand px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                        discipline.active
                          ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                          : "bg-danger/15 text-danger hover:bg-danger/25"
                      }`}
                    >
                      {discipline.active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(discipline)}
                      disabled={!canWriteAcademyData || isPreviewMode}
                      className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {disciplines.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted" colSpan={6}>
                    Todavia no hay disciplinas cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discipline-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="discipline-modal-title" className="font-display text-lg text-text">
                  {editingId ? "Editar disciplina" : "Nueva disciplina"}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Completa los datos sin perder de vista el listado principal.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleSave(event)} className="grid gap-3 text-sm">
              <Field label="Nombre" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
              <label className="grid gap-1">
                Categoria
                <select
                  value={form.billingType}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billingType: event.target.value as FeeCategory }))
                  }
                  className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                Modalidad
                <select
                  value={form.paymentMode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, paymentMode: event.target.value as FeePaymentMode }))
                  }
                  className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                >
                  {Object.entries(paymentModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Valor base"
                type="number"
                value={form.price}
                onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
              />
              <label className="flex items-center justify-between gap-3 rounded-brand border border-slate-700 bg-bg px-3 py-3 text-sm text-muted">
                <span>Permitir pagos parciales o entregas</span>
                <input
                  type="checkbox"
                  checked={form.allowPartial}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowPartial: event.target.checked }))}
                />
              </label>
              <Field
                label="Nota"
                value={form.note}
                onChange={(value) => setForm((prev) => ({ ...prev, note: value }))}
                required={false}
              />
              {editingId && (
                <div className="rounded-brand border border-slate-700 bg-bg px-3 py-2">
                  <p className="text-xs uppercase text-muted">Estado actual</p>
                  <p className={`mt-1 text-sm font-semibold ${disciplines.find((discipline) => discipline.id === editingId)?.active ? "text-secondary" : "text-danger"}`}>
                    {disciplines.find((discipline) => discipline.id === editingId)?.active ? "Activa" : "Inactiva"}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-brand border border-slate-600 px-3 py-2 text-muted"
                >
                  Cancelar
                </button>
                <button
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
                >
                  {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear disciplina"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="break-words text-text">{value}</p>
    </div>
  );
}

function Field({
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
