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
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";

type FeeCategory = "monthly_fee" | "enrollment" | "uniform" | "product" | "exam" | "other";

interface AssignedDiscipline {
  disciplineId: string;
  name: string;
  billingType: FeeCategory;
  price: number;
  active?: boolean;
}

interface StudentOption {
  id: string;
  fullName: string;
  disciplines?: AssignedDiscipline[];
}

interface Fee {
  id: string;
  studentId: string;
  concept: string;
  category: FeeCategory;
  disciplineId?: string;
  disciplineName?: string;
  period?: string;
  observation?: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
}

interface FeeFormState {
  studentId: string;
  disciplineId: string;
  assignDisciplineToStudent: boolean;
  category: FeeCategory;
  period: string;
  observation: string;
  amount: string;
  dueDate: string;
  status: Fee["status"];
}

const emptyForm: FeeFormState = {
  studentId: "",
  disciplineId: "",
  assignDisciplineToStudent: false,
  category: "monthly_fee",
  period: "",
  observation: "",
  amount: "",
  dueDate: "",
  status: "pending"
};

const categoryLabels: Record<FeeCategory, string> = {
  monthly_fee: "Cuota mensual",
  enrollment: "Matricula",
  uniform: "Indumentaria",
  product: "Producto",
  exam: "Examen",
  other: "Otro"
};

const categoriesWithPeriod: FeeCategory[] = ["monthly_fee", "enrollment", "exam"];

function formatPeriodLabel(period?: string) {
  if (!period) return "";
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  return `${month}/${year}`;
}

function buildFeeConcept(fee: Pick<Fee, "concept" | "category" | "period" | "observation">) {
  if (categoriesWithPeriod.includes(fee.category)) {
    const periodLabel = formatPeriodLabel(fee.period);
    if (periodLabel && fee.observation?.trim()) return `${categoryLabels[fee.category]} ${periodLabel} - ${fee.observation.trim()}`;
    if (periodLabel) return `${categoryLabels[fee.category]} ${periodLabel}`;
  }

  if (fee.category && fee.observation?.trim()) {
    return `${categoryLabels[fee.category]} - ${fee.observation.trim()}`;
  }

  if (fee.category) return categoryLabels[fee.category];
  return fee.concept;
}

function getAssignedDisciplines(students: StudentOption[], studentId: string) {
  return students.find((student) => student.id === studentId)?.disciplines ?? [];
}

export function FeesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [disciplines, setDisciplines] = useState<AssignedDiscipline[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeeFormState>(emptyForm);
  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function loadData() {
    if (isPreviewMode) {
      setStudents([
        {
          id: "student-1",
          fullName: "Ana Perez",
          disciplines: [{ disciplineId: "disc-1", name: "Freestyle", billingType: "monthly_fee", price: 20000 }]
        },
        {
          id: "student-2",
          fullName: "Bruno Diaz",
          disciplines: [{ disciplineId: "disc-2", name: "Examen federado", billingType: "exam", price: 15000 }]
        }
      ]);
      setDisciplines([
        { disciplineId: "disc-1", name: "Freestyle", billingType: "monthly_fee", price: 20000, active: true },
        { disciplineId: "disc-2", name: "Examen federado", billingType: "exam", price: 15000, active: true }
      ]);
      setFees([
        {
          id: "fee-1",
          studentId: "student-1",
          concept: "Cuota mensual 03/2026 - Freestyle",
          category: "monthly_fee",
          disciplineId: "disc-1",
          disciplineName: "Freestyle",
          period: "2026-03",
          observation: "Freestyle",
          amount: 20000,
          dueDate: "2026-03-10",
          status: "paid"
        },
        {
          id: "fee-2",
          studentId: "student-2",
          concept: "Examen 03/2026 - Examen federado",
          category: "exam",
          disciplineId: "disc-2",
          disciplineName: "Examen federado",
          period: "2026-03",
          observation: "Examen federado",
          amount: 15000,
          dueDate: "2026-03-20",
          status: "pending"
        }
      ]);
      return;
    }

    if (!academyPath) return;
    const [studentsSnap, feesSnap, disciplinesSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "desc"))),
      getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc")))
    ]);

    setStudents(
      studentsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        fullName: String(docSnap.data().fullName ?? "Alumno"),
        disciplines: (docSnap.data().disciplines as AssignedDiscipline[] | undefined) ?? []
      }))
    );
    setFees(
      feesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Fee, "id">)
      }))
    );
    setDisciplines(
      disciplinesSnap.docs.map((docSnap) => ({
        disciplineId: docSnap.id,
        name: String(docSnap.data().name ?? ""),
        billingType: docSnap.data().billingType as FeeCategory,
        price: Number(docSnap.data().price ?? 0),
        active: Boolean(docSnap.data().active ?? true)
      }))
    );
  }

  useEffect(() => {
    void loadData();
  }, [academyPath, isPreviewMode]);

  const studentDisciplines = useMemo(() => getAssignedDisciplines(students, form.studentId), [students, form.studentId]);
  const availableDisciplines = useMemo(() => {
    const assignedById = new Map(studentDisciplines.map((discipline) => [discipline.disciplineId, discipline]));

    disciplines
      .filter((discipline) => discipline.active !== false)
      .forEach((discipline) => {
        if (!assignedById.has(discipline.disciplineId)) {
          assignedById.set(discipline.disciplineId, discipline);
        }
      });

    return Array.from(assignedById.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [disciplines, studentDisciplines]);

  function applyDisciplineToForm(studentId: string, disciplineId: string) {
    const discipline = availableDisciplines.find((item) => item.disciplineId === disciplineId);
    if (!discipline) {
      setForm((prev) => ({ ...prev, disciplineId: "", assignDisciplineToStudent: false, observation: "", amount: "" }));
      return;
    }

    const alreadyAssigned = getAssignedDisciplines(students, studentId).some(
      (item) => item.disciplineId === discipline.disciplineId
    );

    setForm((prev) => ({
      ...prev,
      studentId,
      disciplineId,
      assignDisciplineToStudent: !alreadyAssigned,
      category: discipline.billingType,
      observation: discipline.name,
      amount: String(discipline.price),
      period: categoriesWithPeriod.includes(discipline.billingType) ? prev.period : ""
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || isPreviewMode) return;

    const usesPeriod = categoriesWithPeriod.includes(form.category);
    if (usesPeriod && !form.period) return;

    const selectedDiscipline = availableDisciplines.find((discipline) => discipline.disciplineId === form.disciplineId);
    const observation = form.observation.trim();

    const payload = {
      studentId: form.studentId,
      disciplineId: selectedDiscipline?.disciplineId ?? "",
      disciplineName: selectedDiscipline?.name ?? "",
      category: form.category,
      period: usesPeriod ? form.period : "",
      observation,
      concept: buildFeeConcept({
        concept: "",
        category: form.category,
        period: usesPeriod ? form.period : "",
        observation
      }),
      amount: Number(form.amount),
      dueDate: form.dueDate,
      status: form.status,
      updatedAt: serverTimestamp()
    };

    if (selectedDiscipline && form.assignDisciplineToStudent && form.studentId) {
      const currentStudent = students.find((student) => student.id === form.studentId);
      const currentDisciplines = currentStudent?.disciplines ?? [];
      const alreadyAssigned = currentDisciplines.some(
        (discipline) => discipline.disciplineId === selectedDiscipline.disciplineId
      );

      if (!alreadyAssigned) {
        await updateDoc(doc(db, `${academyPath}/students`, form.studentId), {
          disciplines: [
            ...currentDisciplines,
            {
              disciplineId: selectedDiscipline.disciplineId,
              name: selectedDiscipline.name,
              billingType: selectedDiscipline.billingType,
              price: selectedDiscipline.price
            }
          ],
          updatedAt: serverTimestamp()
        });
      }
    }

    if (editingId) {
      await updateDoc(doc(db, `${academyPath}/fees`, editingId), payload);
    } else {
      await addDoc(collection(db, `${academyPath}/fees`), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    setForm(emptyForm);
    setEditingId(null);
    await loadData();
  }

  function editFee(fee: Fee) {
    setEditingId(fee.id);
    setForm({
      studentId: fee.studentId,
      disciplineId: fee.disciplineId ?? "",
      assignDisciplineToStudent: false,
      category: fee.category ?? "other",
      period: fee.period ?? "",
      observation: fee.observation ?? fee.disciplineName ?? "",
      amount: String(fee.amount),
      dueDate: fee.dueDate,
      status: fee.status
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Cuotas">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Vencimiento</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id} className="border-t border-slate-800">
                    <td className="px-3 py-3 text-muted">
                      {students.find((student) => student.id === fee.studentId)?.fullName ?? fee.studentId}
                    </td>
                    <td className="px-3 py-3">{buildFeeConcept(fee)}</td>
                    <td className="px-3 py-3">${fee.amount}</td>
                    <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                    <td className="px-3 py-3 uppercase">{fee.status}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => editFee(fee)}
                        disabled={!canWriteAcademyData || isPreviewMode}
                        className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {fees.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={6}>
                      Todavia no hay cuotas cargadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title={editingId ? "Editar cuota" : "Nueva cuota"}>
          <form onSubmit={(event) => void handleSave(event)} className="grid gap-3 text-sm">
            <label className="grid gap-1">
              Alumno
              <select
                value={form.studentId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    studentId: event.target.value,
                    disciplineId: "",
                    assignDisciplineToStudent: false,
                    category: "monthly_fee",
                    observation: "",
                    amount: ""
                  }))
                }
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                required
              >
                <option value="">Seleccionar</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              Disciplina asignada
              <select
                value={form.disciplineId}
                onChange={(event) => applyDisciplineToForm(form.studentId, event.target.value)}
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                disabled={!form.studentId}
              >
                <option value="">Carga manual</option>
                {availableDisciplines.map((discipline) => (
                  <option key={discipline.disciplineId} value={discipline.disciplineId}>
                    {discipline.name} - ${discipline.price}
                  </option>
                ))}
              </select>
            </label>
            {form.disciplineId && (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.assignDisciplineToStudent}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, assignDisciplineToStudent: event.target.checked }))
                  }
                />
                Asignar esta disciplina al alumno para futuras cuotas
              </label>
            )}
            {form.studentId && availableDisciplines.length === 0 && (
              <p className="text-xs text-muted">
                No hay disciplinas activas disponibles. Crea una en el modulo Disciplinas o asignala al alumno.
              </p>
            )}

            <label className="grid gap-1">
              Tipo
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as FeeCategory }))}
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                required
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {categoriesWithPeriod.includes(form.category) && (
              <Field
                label="Mes"
                type="month"
                value={form.period}
                onChange={(value) => setForm((prev) => ({ ...prev, period: value }))}
              />
            )}

            <Field
              label="Observacion"
              value={form.observation}
              onChange={(value) => setForm((prev) => ({ ...prev, observation: value }))}
              required={false}
            />
            <Field
              label="Monto"
              type="number"
              value={form.amount}
              onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
            />
            <Field
              label="Vencimiento"
              type="date"
              value={form.dueDate}
              onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
            />

            <label className="grid gap-1">
              Estado
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Fee["status"] }))}
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagada</option>
                <option value="overdue">Vencida</option>
              </select>
            </label>

            <button
              disabled={!canWriteAcademyData || isPreviewMode}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear cuota"}
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
