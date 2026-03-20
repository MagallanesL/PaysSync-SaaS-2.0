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

function formatFeeLabel(data: Record<string, unknown>) {
  const concept = String(data.concept ?? "").trim();
  if (concept) return concept;

  const category = String(data.category ?? "").trim();
  const period = String(data.period ?? "").trim();
  const observation = String(data.observation ?? "").trim();

  if (category === "monthly_fee" && period) {
    const [year, month] = period.split("-");
    const periodLabel = year && month ? `${month}/${year}` : period;
    return observation ? `Cuota mensual ${periodLabel} - ${observation}` : `Cuota mensual ${periodLabel}`;
  }

  if (observation) return observation;
  if (category) return category;
  return "Cuota";
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
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fees, setFees] = useState<FeeOption[]>([]);
  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    if (isPreviewMode) {
      setStudents([
        { id: "student-1", fullName: "Ana Perez" },
        { id: "student-2", fullName: "Bruno Diaz" }
      ]);
      setFees([
        { id: "fee-1", concept: "Cuota mensual 03/2026" },
        { id: "fee-2", concept: "Indumentaria - Zapatillas" }
      ]);
      setPayments([
        {
          id: "payment-1",
          studentId: "student-1",
          feeId: "fee-1",
          amount: 12000,
          paymentDate: "2026-03-01",
          method: "transfer"
        }
      ]);
      return;
    }
    if (!academyPath) return;
    const [studentsSnap, feesSnap, paymentsSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "desc"))),
      getDocs(query(collection(db, `${academyPath}/payments`), orderBy("paymentDate", "desc")))
    ]);
    setStudents(studentsSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName as string })));
    setFees(feesSnap.docs.map((d) => ({ id: d.id, concept: formatFeeLabel(d.data() as Record<string, unknown>) })));
    setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, "id">) })));
  }

  useEffect(() => {
    void loadData();
  }, [academyPath, isPreviewMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || isPreviewMode) return;

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
        <Panel title="Pagos">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Cuota</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Metodo</th>
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
                    <td className="px-3 py-3 uppercase">
                      {payment.method === "cash" ? "EFECTIVO" : payment.method === "transfer" ? "TRANSFERENCIA" : "TARJETA"}
                    </td>
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
              label="Cuota (opcional)"
              value={form.feeId}
              onChange={(value) => setForm((prev) => ({ ...prev, feeId: value }))}
              options={[
                { value: "", label: "Sin cuota vinculada" },
                ...fees.map((f) => ({ value: f.id, label: f.concept }))
              ]}
            />
            <Field label="Monto" type="number" value={form.amount} onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))} />
            <Field
              label="Fecha de pago"
              type="date"
              value={form.paymentDate}
              onChange={(value) => setForm((prev) => ({ ...prev, paymentDate: value }))}
            />
            <Select
              label="Metodo"
              value={form.method}
              onChange={(value) => setForm((prev) => ({ ...prev, method: value }))}
              options={[
                { value: "cash", label: "Efectivo" },
                { value: "transfer", label: "Transferencia" },
                { value: "card", label: "Tarjeta" }
              ]}
              required
            />
            <button
              disabled={!canWriteAcademyData || isPreviewMode}
              className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
            >
              {isPreviewMode ? "Modo demo" : "Registrar pago"}
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
