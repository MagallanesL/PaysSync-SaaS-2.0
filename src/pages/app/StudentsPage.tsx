import {
  addDoc,
  collection,
  doc,
  getDoc,
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
import { PLAN_LIMITS } from "../../lib/plans";
import type { AcademyPlan } from "../../lib/types";

interface Student {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  disciplines?: AssignedDiscipline[];
}

interface AssignedDiscipline {
  disciplineId: string;
  name: string;
  billingType: "monthly_fee" | "enrollment" | "exam" | "product" | "uniform" | "other";
  price: number;
}

interface DisciplineOption extends AssignedDiscipline {
  id: string;
  active: boolean;
}

interface StudentFormState {
  fullName: string;
  email: string;
  phone: string;
  status: Student["status"];
  disciplineIds: string[];
}

const emptyForm: StudentFormState = {
  fullName: "",
  email: "",
  phone: "",
  status: "active",
  disciplineIds: []
};

export function StudentsPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(emptyForm);
  const [plan, setPlan] = useState<AcademyPlan>("basic");
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);

  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function loadStudents() {
    if (isPreviewMode) {
      setStudents([
        {
          id: "student-1",
          fullName: "Ana Perez",
          email: "ana@demo.com",
          phone: "1111-1111",
          status: "active",
          disciplines: [{ disciplineId: "disc-1", name: "Freestyle", billingType: "monthly_fee", price: 20000 }]
        },
        { id: "student-2", fullName: "Bruno Diaz", email: "bruno@demo.com", phone: "2222-2222", status: "inactive", disciplines: [] }
      ]);
      setDisciplines([
        { id: "disc-1", disciplineId: "disc-1", name: "Freestyle", billingType: "monthly_fee", price: 20000, active: true },
        { id: "disc-2", disciplineId: "disc-2", name: "Indumentaria", billingType: "uniform", price: 12000, active: true }
      ]);
      setPlan("pro");
      return;
    }

    if (!academyPath || !membership) return;
    const [studentsSnap, academySnap, disciplinesSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDoc(doc(db, "academies", membership.academyId)),
      getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc")))
    ]);
    setStudents(studentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, "id">) })));
    setDisciplines(
      disciplinesSnap.docs.map((d) => ({
        id: d.id,
        disciplineId: d.id,
        name: String(d.data().name ?? ""),
        billingType: d.data().billingType as DisciplineOption["billingType"],
        price: Number(d.data().price ?? 0),
        active: Boolean(d.data().active ?? true)
      }))
    );
    if (academySnap.exists()) {
      setPlan(academySnap.data().plan as AcademyPlan);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, [academyPath, isPreviewMode]);

  const maxStudents = useMemo(() => PLAN_LIMITS[plan], [plan]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || isPreviewMode) return;

    setError(null);
    if (!editingId && maxStudents !== null && students.length >= maxStudents) {
      setError(`Limite alcanzado para plan ${plan}: ${maxStudents} alumnos.`);
      return;
    }

    const assignedDisciplines = disciplines
      .filter((discipline) => form.disciplineIds.includes(discipline.id))
      .map((discipline) => ({
        disciplineId: discipline.id,
        name: discipline.name,
        billingType: discipline.billingType,
        price: discipline.price
      }));

    if (editingId) {
      await updateDoc(doc(db, `${academyPath}/students`, editingId), {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        status: form.status,
        disciplines: assignedDisciplines,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, `${academyPath}/students`), {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        status: form.status,
        disciplines: assignedDisciplines,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    setForm(emptyForm);
    setEditingId(null);
    await loadStudents();
  }

  function onEdit(student: Student) {
    setEditingId(student.id);
    setForm({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      status: student.status,
      disciplineIds: (student.disciplines ?? []).map((discipline) => discipline.disciplineId)
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Alumnos">
          <p className="mb-3 text-xs text-muted">
            Plan actual: <span className="uppercase text-primary">{plan}</span> · Limite: {maxStudents ?? "Ilimitado"} ·
            Usados: {students.length}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Telefono</th>
                  <th className="px-3 py-2">Disciplinas</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">{student.fullName}</td>
                    <td className="px-3 py-3 text-muted">{student.email}</td>
                    <td className="px-3 py-3 text-muted">{student.phone}</td>
                    <td className="px-3 py-3 text-muted">
                      {(student.disciplines ?? []).length > 0
                        ? (student.disciplines ?? []).map((discipline) => discipline.name).join(", ")
                        : "-"}
                    </td>
                    <td className="px-3 py-3 uppercase">{student.status}</td>
                    <td className="px-3 py-3">
                      <button
                        disabled={!canWriteAcademyData || isPreviewMode}
                        onClick={() => onEdit(student)}
                        className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-1">
        <Panel title={editingId ? "Editar alumno" : "Nuevo alumno"}>
          <form onSubmit={(e) => void handleSave(e)} className="grid gap-3 text-sm">
            <Field
              label="Nombre completo"
              value={form.fullName}
              onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
            />
            <Field
              label="Telefono"
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />
            <div className="grid gap-2">
              <p className="text-sm">Disciplinas asignadas</p>
              <div className="grid gap-2 rounded-brand border border-slate-700 bg-bg p-3">
                {disciplines.filter((discipline) => discipline.active).length > 0 ? (
                  disciplines
                    .filter((discipline) => discipline.active)
                    .map((discipline) => (
                      <label key={discipline.id} className="flex items-center justify-between gap-3 text-sm text-muted">
                        <span>
                          {discipline.name} <span className="text-xs uppercase">({discipline.billingType})</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-primary">${discipline.price}</span>
                          <input
                            type="checkbox"
                            checked={form.disciplineIds.includes(discipline.id)}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                disciplineIds: event.target.checked
                                  ? [...prev.disciplineIds, discipline.id]
                                  : prev.disciplineIds.filter((id) => id !== discipline.id)
                              }))
                            }
                          />
                        </span>
                      </label>
                    ))
                ) : (
                  <p className="text-xs text-muted">Primero crea disciplinas en el modulo Disciplinas.</p>
                )}
              </div>
            </div>
            <label className="grid gap-1">
              Estado
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Student["status"] }))}
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              disabled={!canWriteAcademyData || isPreviewMode}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear alumno"}
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
        onChange={(e) => onChange(e.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required
      />
    </label>
  );
}
