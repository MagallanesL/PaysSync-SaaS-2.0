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
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import { Panel } from "../../components/ui/Panel";

interface StudentOption {
  id: string;
  fullName: string;
}

interface FeeOption {
  id: string;
  concept: string;
}

interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  paymentDate: string;
  method: string;
}

const emptyForm = {
  studentId: "",
  feeId: "",
  amount: "",
  paymentDate: "",
  method: "cash"
};

export function PaymentsPage() {
  const { membership, canWriteAcademyData } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fees, setFees] = useState<FeeOption[]>([]);
  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    if (!academyPath) return;
    const [studentsSnap, feesSnap, paymentsSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "desc"))),
      getDocs(query(collection(db, `${academyPath}/payments`), orderBy("paymentDate", "desc")))
    ]);
    setStudents(studentsSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName as string })));
    setFees(feesSnap.docs.map((d) => ({ id: d.id, concept: d.data().concept as string })));
    setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, "id">) })));
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath) return;

    const payload = {
      studentId: form.studentId,
      feeId: form.feeId || "",
      amount: Number(form.amount),
      paymentDate: form.paymentDate,
      method: form.method,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, `${academyPath}/payments`), payload);
    if (form.feeId) {
      await updateDoc(doc(db, `${academyPath}/fees`, form.feeId), {
        status: "paid",
        updatedAt: serverTimestamp()
      });
    }
    setForm(emptyForm);
    await loadData();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Payments">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Método</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-800">
                    <td className="px-3 py-3 text-muted">
                      {students.find((student) => student.id === payment.studentId)?.fullName ?? payment.studentId}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {payment.feeId ? fees.find((fee) => fee.id === payment.feeId)?.concept ?? payment.feeId : "-"}
                    </td>
                    <td className="px-3 py-3">${payment.amount}</td>
                    <td className="px-3 py-3">{payment.paymentDate}</td>
                    <td className="px-3 py-3 uppercase">{payment.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div>
        <Panel title="Registrar pago">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 text-sm">
            <Select
              label="Alumno"
              value={form.studentId}
              onChange={(value) => setForm((prev) => ({ ...prev, studentId: value }))}
              options={students.map((s) => ({ value: s.id, label: s.fullName }))}
              required
            />
            <Select
              label="Fee (opcional)"
              value={form.feeId}
              onChange={(value) => setForm((prev) => ({ ...prev, feeId: value }))}
              options={[{ value: "", label: "Sin fee vinculada" }, ...fees.map((f) => ({ value: f.id, label: f.concept }))]}
            />
            <Field label="Monto" type="number" value={form.amount} onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))} />
            <Field
              label="Fecha de pago"
              type="date"
              value={form.paymentDate}
              onChange={(value) => setForm((prev) => ({ ...prev, paymentDate: value }))}
            />
            <Select
              label="Método"
              value={form.method}
              onChange={(value) => setForm((prev) => ({ ...prev, method: value }))}
              options={[
                { value: "cash", label: "cash" },
                { value: "transfer", label: "transfer" },
                { value: "card", label: "card" }
              ]}
              required
            />
            <button
              disabled={!canWriteAcademyData}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              Registrar pago
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

function Select({
  label,
  value,
  onChange,
  options,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={required}
      >
        {options.map((option) => (
          <option key={option.value || "blank"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
