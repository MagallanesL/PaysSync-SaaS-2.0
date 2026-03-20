import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";

interface Student {
  id: string;
  fullName: string;
  phone: string;
}

interface Fee {
  id?: string;
  studentId: string;
  concept?: string;
  period?: string;
  amount: number;
  status: string;
  dueDate?: string;
}

interface Payment {
  studentId: string;
  amount: number;
}

function formatPeriodLabel(period?: string, fallbackConcept?: string, dueDate?: string) {
  if (period) {
    const [year, month] = period.split("-");
    if (year && month) return `${month}/${year}`;
    return period;
  }
  if (fallbackConcept) return fallbackConcept;
  if (dueDate) return dueDate;
  return "periodo pendiente";
}

function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildWhatsAppLink(studentName: string, phone: string, pendingPeriods: string[]) {
  const normalizedPhone = sanitizePhone(phone);
  if (!normalizedPhone) return null;

  const periodsText = pendingPeriods.join(", ");
  const message = `Hola ${studentName}, te escribimos desde el centro para recordarte que aun no registramos el pago del periodo ${periodsText}.`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function DebtPage() {
  const { membership, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function load() {
      if (isPreviewMode) {
        setStudents([
          { id: "student-1", fullName: "Ana Perez", phone: "5491111111111" },
          { id: "student-2", fullName: "Bruno Diaz", phone: "5492222222222" }
        ]);
        setFees([
          { id: "fee-1", studentId: "student-1", concept: "Cuota mensual 03/2026", period: "2026-03", amount: 12000, status: "paid" },
          { id: "fee-2", studentId: "student-2", concept: "Cuota mensual 03/2026", period: "2026-03", amount: 15000, status: "pending" }
        ]);
        setPayments([
          { studentId: "student-1", amount: 12000 },
          { studentId: "student-2", amount: 5000 }
        ]);
        return;
      }
      if (!academyPath) return;
      const [studentsSnap, feesSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, `${academyPath}/students`)),
        getDocs(collection(db, `${academyPath}/fees`)),
        getDocs(collection(db, `${academyPath}/payments`))
      ]);
      setStudents(
        studentsSnap.docs.map((d) => ({
          id: d.id,
          fullName: String(d.data().fullName ?? "Alumno"),
          phone: String(d.data().phone ?? "")
        }))
      );
      setFees(feesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Fee, "id">) })));
      setPayments(paymentsSnap.docs.map((d) => d.data() as Payment));
    }
    void load();
  }, [academyPath, isPreviewMode]);

  const allDebtRows = useMemo(() => {
    return students
      .map((student) => {
        const studentFees = fees.filter((fee) => fee.studentId === student.id);
        const totalFees = fees
          .filter((fee) => fee.studentId === student.id)
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const totalPayments = payments
          .filter((payment) => payment.studentId === student.id)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const debt = Math.max(0, totalFees - totalPayments);
        const status = debt === 0 && totalFees > 0 ? "AL DIA" : totalPayments > 0 ? "PARCIAL" : "SIN PAGO";
        const pendingPeriods = studentFees
          .filter((fee) => String(fee.status ?? "").toLowerCase() !== "paid")
          .map((fee) => formatPeriodLabel(fee.period, fee.concept, fee.dueDate));
        const whatsappUrl = buildWhatsAppLink(student.fullName, student.phone, pendingPeriods);

        return {
          id: student.id,
          student: student.fullName,
          phone: student.phone,
          totalFees,
          totalPayments,
          debt,
          status,
          pendingPeriods,
          whatsappUrl
        };
      })
      .sort((a, b) => b.debt - a.debt);
  }, [students, fees, payments]);

  const debtRows = useMemo(() => allDebtRows.filter((row) => row.status === "SIN PAGO"), [allDebtRows]);

  const totals = useMemo(() => {
    const alDia = allDebtRows.filter((row) => row.status === "AL DIA").length;
    const parcial = allDebtRows.filter((row) => row.status === "PARCIAL").length;
    const sinPago = allDebtRows.filter((row) => row.status === "SIN PAGO").length;
    const deudaTotal = allDebtRows.reduce((sum, row) => sum + row.debt, 0);
    return { alDia, parcial, sinPago, deudaTotal };
  }, [allDebtRows]);

  return (
    <Panel title="Morosidad por alumno">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Summary label="Al dia" value={totals.alDia} color="text-secondary" />
        <Summary label="Parcial" value={totals.parcial} color="text-warning" />
        <Summary label="Sin pago" value={totals.sinPago} color="text-danger" />
        <Summary label="Deuda total" value={`$${totals.deudaTotal}`} color="text-danger" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-3 py-2">Alumno</th>
              <th className="px-3 py-2">Periodos pendientes</th>
              <th className="px-3 py-2">Facturado</th>
              <th className="px-3 py-2">Pagado</th>
              <th className="px-3 py-2">Deuda</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {debtRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-3 py-3">{row.student}</td>
                <td className="px-3 py-3 text-muted">{row.pendingPeriods.join(", ") || "-"}</td>
                <td className="px-3 py-3 text-warning">${row.totalFees}</td>
                <td className="px-3 py-3 text-secondary">${row.totalPayments}</td>
                <td className="px-3 py-3 font-semibold text-danger">${row.debt}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-brand px-2 py-1 text-xs ${
                      row.status === "AL DIA"
                        ? "bg-secondary/15 text-secondary"
                        : row.status === "PARCIAL"
                          ? "bg-warning/15 text-warning"
                          : "bg-danger/15 text-danger"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {row.whatsappUrl ? (
                    <a
                      href={row.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Enviar WhatsApp a ${row.student}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-secondary transition hover:bg-secondary/25"
                    >
                      <WhatsAppIcon />
                    </a>
                  ) : (
                    <span className="text-xs text-muted">Sin telefono</span>
                  )}
                </td>
              </tr>
            ))}
            {debtRows.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={7}>
                  No hay alumnos en estado SIN PAGO.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Summary({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-brand border border-slate-700 bg-bg p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${color}`}>{value}</p>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M19.05 4.94A9.9 9.9 0 0 0 12.03 2C6.56 2 2.1 6.46 2.1 11.93c0 1.75.46 3.47 1.34 4.98L2 22l5.24-1.37a9.92 9.92 0 0 0 4.78 1.22h.01c5.47 0 9.93-4.46 9.93-9.93a9.86 9.86 0 0 0-2.91-6.98Zm-7.02 15.23h-.01a8.3 8.3 0 0 1-4.22-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.23 8.23 0 0 1-1.27-4.39c0-4.56 3.71-8.27 8.28-8.27 2.2 0 4.27.85 5.83 2.42a8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.25 8.25Zm4.54-6.19c-.25-.13-1.47-.72-1.7-.8-.23-.09-.39-.13-.56.12-.16.25-.64.79-.78.95-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.36-1.71-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.42h-.48c-.17 0-.43.06-.65.31-.23.25-.87.85-.87 2.07 0 1.22.9 2.39 1.02 2.56.12.17 1.76 2.68 4.25 3.76.59.26 1.06.42 1.42.54.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.17.21-.58.21-1.07.15-1.17-.06-.1-.22-.16-.46-.29Z" />
    </svg>
  );
}
