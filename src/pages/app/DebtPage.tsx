import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";

interface Student {
  id: string;
  fullName: string;
}

interface Fee {
  studentId: string;
  amount: number;
  status: string;
}

interface Payment {
  studentId: string;
  amount: number;
}

export function DebtPage() {
  const { membership } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function load() {
      if (!academyPath) return;
      const [studentsSnap, feesSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, `${academyPath}/students`)),
        getDocs(collection(db, `${academyPath}/fees`)),
        getDocs(collection(db, `${academyPath}/payments`))
      ]);
      setStudents(studentsSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName as string })));
      setFees(feesSnap.docs.map((d) => d.data() as Fee));
      setPayments(paymentsSnap.docs.map((d) => d.data() as Payment));
    }
    void load();
  }, [academyPath]);

  const debtRows = useMemo(() => {
    return students
      .map((student) => {
        const totalFees = fees
          .filter((fee) => fee.studentId === student.id)
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const totalPayments = payments
          .filter((payment) => payment.studentId === student.id)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const debt = Math.max(0, totalFees - totalPayments);
        const status = debt === 0 && totalFees > 0 ? "AL DIA" : totalPayments > 0 ? "PARCIAL" : "SIN PAGO";
        return {
          student: student.fullName,
          totalFees,
          totalPayments,
          debt,
          status
        };
      })
      .sort((a, b) => b.debt - a.debt);
  }, [students, fees, payments]);

  const totals = useMemo(() => {
    const alDia = debtRows.filter((row) => row.status === "AL DIA").length;
    const parcial = debtRows.filter((row) => row.status === "PARCIAL").length;
    const sinPago = debtRows.filter((row) => row.status === "SIN PAGO").length;
    const deudaTotal = debtRows.reduce((sum, row) => sum + row.debt, 0);
    return { alDia, parcial, sinPago, deudaTotal };
  }, [debtRows]);

  return (
    <Panel title="Debt por alumno">
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
              <th className="px-3 py-2">Facturado</th>
              <th className="px-3 py-2">Pagado</th>
              <th className="px-3 py-2">Deuda</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {debtRows.map((row) => (
              <tr key={row.student} className="border-t border-slate-800">
                <td className="px-3 py-3">{row.student}</td>
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
              </tr>
            ))}
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
