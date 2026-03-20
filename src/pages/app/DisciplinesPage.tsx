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

type DisciplineBillingType = "monthly_fee" | "enrollment" | "exam" | "product" | "uniform" | "other";

interface Discipline {
  id: string;
  name: string;
  billingType: DisciplineBillingType;
  price: number;
  active: boolean;
  note?: string;
}

interface DisciplineFormState {
  name: string;
  billingType: DisciplineBillingType;
  price: string;
  active: boolean;
  note: string;
}

const billingTypeLabels: Record<DisciplineBillingType, string> = {
  monthly_fee: "Mensual",
  enrollment: "Matricula",
  exam: "Examen",
  product: "Producto",
  uniform: "Indumentaria",
  other: "Otro"
};

const emptyForm: DisciplineFormState = {
  name: "",
  billingType: "monthly_fee",
  price: "",
  active: true,
  note: ""
};

export function DisciplinesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [form, setForm] = useState<DisciplineFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadDisciplines() {
    if (isPreviewMode) {
      setDisciplines([
        { id: "disc-1", name: "Freestyle", billingType: "monthly_fee", price: 20000, active: true, note: "" },
        { id: "disc-2", name: "Indumentaria oficial", billingType: "uniform", price: 12000, active: true, note: "" }
      ]);
      return;
    }

    if (!academyPath) return;
    const snap = await getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc")));
    setDisciplines(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<Discipline, "id">) })));
  }

  useEffect(() => {
    void loadDisciplines();
  }, [academyPath, isPreviewMode]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyPath || !canWriteAcademyData || isPreviewMode) return;

    const payload = {
      name: form.name.trim(),
      billingType: form.billingType,
      price: Number(form.price),
      active: form.active,
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

    setForm(emptyForm);
    setEditingId(null);
    await loadDisciplines();
  }

  function handleEdit(discipline: Discipline) {
    setEditingId(discipline.id);
    setForm({
      name: discipline.name,
      billingType: discipline.billingType,
      price: String(discipline.price),
      active: discipline.active,
      note: discipline.note ?? ""
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Disciplinas y servicios">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Valor base</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {disciplines.map((discipline) => (
                  <tr key={discipline.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">{discipline.name}</td>
                    <td className="px-3 py-3 text-muted">{billingTypeLabels[discipline.billingType]}</td>
                    <td className="px-3 py-3 text-primary">${discipline.price}</td>
                    <td className="px-3 py-3 uppercase text-muted">{discipline.active ? "ACTIVA" : "INACTIVA"}</td>
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
                    <td className="px-3 py-3 text-muted" colSpan={5}>
                      Todavia no hay disciplinas cargadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title={editingId ? "Editar disciplina" : "Nueva disciplina"}>
          <form onSubmit={(event) => void handleSave(event)} className="grid gap-3 text-sm">
            <Field label="Nombre" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
            <label className="grid gap-1">
              Tipo de cobro
              <select
                value={form.billingType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, billingType: event.target.value as DisciplineBillingType }))
                }
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              >
                {Object.entries(billingTypeLabels).map(([value, label]) => (
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
            <Field
              label="Nota"
              value={form.note}
              onChange={(value) => setForm((prev) => ({ ...prev, note: value }))}
              required={false}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Disciplina activa
            </label>
            <button
              disabled={!canWriteAcademyData || isPreviewMode}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear disciplina"}
            </button>
          </form>
        </Panel>
      </div>
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
