import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { loadAcademyBillingSnapshot, type DisciplineRecord } from "../../lib/academyBilling";
import { formatBillingType } from "../../lib/display";
import { db } from "../../lib/firebase";
import type { FeeCategory } from "../../lib/fees";

interface DisciplineFormState {
  name: string;
  category: FeeCategory;
  modality: string;
  baseAmount: string;
  allowPartial: boolean;
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

const emptyForm: DisciplineFormState = {
  name: "",
  category: "monthly_fee",
  modality: "",
  baseAmount: "",
  allowPartial: true,
  note: ""
};

function sortDisciplines(items: DisciplineRecord[]) {
  return [...items].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export function DisciplinesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [disciplines, setDisciplines] = useState<DisciplineRecord[]>([]);
  const [studentCountByDiscipline, setStudentCountByDiscipline] = useState<Map<string, number>>(new Map());
  const [potentialByDiscipline, setPotentialByDiscipline] = useState<Map<string, number>>(new Map());
  const [form, setForm] = useState<DisciplineFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadData() {
    if (isPreviewMode) {
      const preview = sortDisciplines([
        {
          id: "disc-1",
          centerId: "demo",
          name: "Voley",
          category: "monthly_fee",
          modality: "Adultos",
          baseAmount: 20000,
          billingType: "monthly",
          active: true,
          allowPartial: true,
          note: ""
        },
        {
          id: "disc-2",
          centerId: "demo",
          name: "Danza",
          category: "monthly_fee",
          modality: "Kids",
          baseAmount: 18000,
          billingType: "monthly",
          active: false,
          allowPartial: true,
          note: ""
        }
      ]);
      setDisciplines(preview);
      setStudentCountByDiscipline(new Map([["disc-1", 14], ["disc-2", 8]]));
      setPotentialByDiscipline(new Map([["disc-1", 280000], ["disc-2", 144000]]));
      return;
    }

    if (!membership) return;
    const snapshot = await loadAcademyBillingSnapshot(membership.academyId);
    const activeEnrollments = snapshot.enrollments.filter((enrollment) => enrollment.active);

    setDisciplines(sortDisciplines(snapshot.disciplines));
    setStudentCountByDiscipline(
      new Map(
        snapshot.disciplines.map((discipline) => [
          discipline.id,
          activeEnrollments.filter((enrollment) => enrollment.disciplineId === discipline.id).length
        ])
      )
    );
    setPotentialByDiscipline(
      new Map(
        snapshot.disciplines.map((discipline) => [
          discipline.id,
          activeEnrollments
            .filter((enrollment) => enrollment.disciplineId === discipline.id)
            .reduce((sum, enrollment) => sum + (enrollment.customAmount ?? discipline.baseAmount), 0)
        ])
      )
    );
  }

  useEffect(() => {
    void loadData();
  }, [isPreviewMode, membership?.academyId]);

  useEffect(() => {
    if (!isModalOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  const activeCount = disciplines.filter((discipline) => discipline.active).length;
  const averageBaseAmount = Math.round(
    disciplines.reduce((sum, discipline) => sum + discipline.baseAmount, 0) / Math.max(disciplines.length, 1)
  );
  const potentialRevenue = [...potentialByDiscipline.values()].reduce((sum, value) => sum + value, 0);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !canWriteAcademyData || isPreviewMode) return;

    const academyId = membership.academyId;
    const academyPath = `academies/${academyId}`;
    const disciplineRef = editingId
      ? doc(db, `${academyPath}/disciplines`, editingId)
      : doc(collection(db, `${academyPath}/disciplines`));

    await setDoc(
      disciplineRef,
      {
        centerId: academyId,
        name: form.name.trim(),
        category: form.category,
        modality: form.modality.trim(),
        baseAmount: Number(form.baseAmount || 0),
        feeBillingType: "monthly",
        billingType: form.category,
        paymentMode: "monthly",
        price: Number(form.baseAmount || 0),
        allowPartial: form.allowPartial,
        active: editingId ? disciplines.find((discipline) => discipline.id === editingId)?.active ?? true : true,
        note: form.note.trim(),
        updatedAt: serverTimestamp(),
        ...(editingId ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );

    closeModal();
    await loadData();
  }

  async function handleToggleStatus(discipline: DisciplineRecord) {
    if (!membership || !canWriteAcademyData || isPreviewMode) return;
    await updateDoc(doc(db, `academies/${membership.academyId}/disciplines`, discipline.id), {
      active: !discipline.active,
      updatedAt: serverTimestamp()
    });
    await loadData();
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function handleEdit(discipline: DisciplineRecord) {
    setEditingId(discipline.id);
    setForm({
      name: discipline.name,
      category: discipline.category,
      modality: discipline.modality,
      baseAmount: String(discipline.baseAmount),
      allowPartial: discipline.allowPartial,
      note: discipline.note
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
            Crear disciplina
          </button>
        }
      >
        <div className="mb-4 grid gap-3 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] p-4 lg:grid-cols-4">
          <InfoCard label="Activas" value={String(activeCount)} accent="text-[#22C55E]" />
          <InfoCard label="Valor base promedio" value={`$${averageBaseAmount}`} accent="text-[#00D1FF]" />
          <InfoCard label="Ingreso potencial" value={`$${potentialRevenue}`} accent="text-[#F5F7FB]" />
          <InfoCard label="Modelo" value="Mensual" accent="text-[#9FB0D0]" />
        </div>

        <div className="space-y-3 md:hidden">
          {disciplines.map((discipline) => (
            <article key={discipline.id} className={`rounded-brand border border-slate-800 bg-bg p-4 ${discipline.active ? "" : "opacity-80"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{discipline.name}</p>
                  <p className="text-sm text-muted">{discipline.modality || formatBillingType(discipline.category)}</p>
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
                <MobileInfo label="Categoria" value={categoryLabels[discipline.category]} />
                <MobileInfo label="Valor base" value={`$${discipline.baseAmount}`} />
                <MobileInfo label="Alumnos asociados" value={String(studentCountByDiscipline.get(discipline.id) ?? 0)} />
                <MobileInfo label="Ingreso estimado" value={`$${potentialByDiscipline.get(discipline.id) ?? 0}`} />
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
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Valor base</th>
                <th className="px-3 py-2">Alumnos</th>
                <th className="px-3 py-2">Ingreso potencial</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {disciplines.map((discipline) => (
                <tr key={discipline.id} className={`border-t border-slate-800 ${discipline.active ? "" : "opacity-80"}`}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-text">{discipline.name}</p>
                    <p className="text-xs text-muted">{categoryLabels[discipline.category]}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{discipline.modality || "Mensual"}</td>
                  <td className="px-3 py-3 font-semibold text-primary">${discipline.baseAmount}</td>
                  <td className="px-3 py-3 text-muted">{studentCountByDiscipline.get(discipline.id) ?? 0}</td>
                  <td className="px-3 py-3 text-muted">${potentialByDiscipline.get(discipline.id) ?? 0}</td>
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
                  <td className="px-3 py-3 text-muted" colSpan={7}>
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
                  El cambio de valor base se aplicara a nuevas cuotas. No modifica periodos ya generados.
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
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as FeeCategory }))}
                  className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Modalidad" required={false} value={form.modality} onChange={(value) => setForm((prev) => ({ ...prev, modality: value }))} />
              <Field label="Valor base" type="number" value={form.baseAmount} onChange={(value) => setForm((prev) => ({ ...prev, baseAmount: value }))} />
              <label className="flex items-center justify-between gap-3 rounded-brand border border-slate-700 bg-bg px-3 py-3 text-sm text-muted">
                <span>Permitir pagos parciales</span>
                <input
                  type="checkbox"
                  checked={form.allowPartial}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowPartial: event.target.checked }))}
                />
              </label>
              <Field label="Nota interna" required={false} value={form.note} onChange={(value) => setForm((prev) => ({ ...prev, note: value }))} />

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-brand border border-slate-600 px-3 py-2 text-muted">
                  Cancelar
                </button>
<<<<<<< HEAD
                <button
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
                >
                  {editingId ? "Guardar cambios" : "Crear disciplina"}
=======
                <button disabled={!canWriteAcademyData || isPreviewMode} className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40">
                  {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear disciplina"}
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
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

function InfoCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-brand border border-[rgba(0,209,255,0.12)] bg-[#121A2B] p-3">
      <p className="text-[11px] uppercase tracking-wide text-[#9FB0D0]">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${accent}`}>{value}</p>
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
