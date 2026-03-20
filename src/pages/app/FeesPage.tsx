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

interface StudentOption {
  id: string;
  fullName: string;
}

interface Fee {
  id: string;
  studentId: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
}

interface FeeFormState {
  studentId: string;
  concept: string;
  amount: string;
  dueDate: string;
  status: Fee["status"];
}

const emptyForm: FeeFormState = {
  studentId: "",
  concept: "",
  amount: "",
  dueDate: "",
  status: "pending"
};

export function FeesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeeFormState>(emptyForm);
  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function loadData() {
    if (isPreviewMode) {
      setStudents([
        { id: "student-1", fullName: "Ana Perez" },
        { id: "student-2", fullName: "Bruno Diaz" }
      ]);
      setFees([
        { id: "fee-1", studentId: "student-1", concept: "Marzo", amount: 12000, dueDate: "2026-03-10", status: "paid" },
        { id: "fee-2", studentId: "student-2", concept: "Marzo", amount: 15000, dueDate: "2026-03-10", status: "pending" }
      ]);
      return;
    }

    if (!academyPath) return;
    const [studentsSnap, feesSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "desc")))
    ]);
    setStudents(studentsSnap.docs.map((docSnap) => ({ id: docSnap.id, fullName: docSnap.data().fullName as string })));
    setFees(
      feesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Fee, "id">)
      }))
    );
  }

  useEffect(() => {
    void loadData();
  }, [academyPath, isPreviewMode]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || isPreviewMode) return;
    const payload = {
      studentId: form.studentId,
      concept: form.concept,
      amount: Number(form.amount),
      dueDate: form.dueDate,
      status: form.status,
      updatedAt: serverTimestamp()
    };

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
      concept: fee.concept,
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
                    <td className="px-3 py-3">{fee.concept}</td>
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
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title={editingId ? "Editar cuota" : "Nueva cuota"}>
          <form onSubmit={(e) => void handleSave(e)} className="grid gap-3 text-sm">
            <label className="grid gap-1">
              Alumno
              <select
                value={form.studentId}
                onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
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
            <Field label="Concepto" value={form.concept} onChange={(value) => setForm((prev) => ({ ...prev, concept: value }))} />
            <Field label="Monto" type="number" value={form.amount} onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))} />
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
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Fee["status"] }))}
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
