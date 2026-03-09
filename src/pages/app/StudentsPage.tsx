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
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import { PLAN_LIMITS } from "../../lib/plans";
import { Panel } from "../../components/ui/Panel";
import type { AcademyPlan } from "../../lib/types";

interface Student {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
}

const emptyForm = { fullName: "", email: "", phone: "", status: "active" as const };

export function StudentsPage() {
  const { membership, canWriteAcademyData } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [plan, setPlan] = useState<AcademyPlan>("basic");
  const [error, setError] = useState<string | null>(null);

  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function loadStudents() {
    if (!academyPath || !membership) return;
    const [studentsSnap, academySnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDoc(doc(db, "academies", membership.academyId))
    ]);
    setStudents(studentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, "id">) })));
    if (academySnap.exists()) {
      const rawPlan = academySnap.data().plan as string;
      setPlan(rawPlan === "studio" ? "premium" : (rawPlan as AcademyPlan));
    }
  }

  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyPath]);

  const maxStudents = useMemo(() => PLAN_LIMITS[plan], [plan]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath) return;

    setError(null);
    if (!editingId && maxStudents !== null && students.length >= maxStudents) {
      setError(`Límite alcanzado para plan ${plan}: ${maxStudents} alumnos.`);
      return;
    }

    if (editingId) {
      await updateDoc(doc(db, `${academyPath}/students`, editingId), {
        ...form,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, `${academyPath}/students`), {
        ...form,
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
      status: student.status
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Students">
          <p className="mb-3 text-xs text-muted">
            Plan actual: <span className="uppercase text-primary">{plan}</span> · Límite: {maxStudents ?? "Ilimitado"} ·
            Usados: {students.length}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">{student.fullName}</td>
                    <td className="px-3 py-3 text-muted">{student.email}</td>
                    <td className="px-3 py-3 text-muted">{student.phone}</td>
                    <td className="px-3 py-3 uppercase">{student.status}</td>
                    <td className="px-3 py-3">
                      <button
                        disabled={!canWriteAcademyData}
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
              label="Teléfono"
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />
            <label className="grid gap-1">
              Estado
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Student["status"] }))}
                className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              disabled={!canWriteAcademyData}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {editingId ? "Guardar cambios" : "Crear alumno"}
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
