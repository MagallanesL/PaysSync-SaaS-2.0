import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
}

interface Payment {
  studentId: string;
  amount: number;
  paymentDate?: string;
}

export function AcademyDashboardPage() {
  const { membership } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usersCount, setUsersCount] = useState(0);

  useEffect(() => {
    async function load() {
      if (!membership) return;
      const academyPath = `academies/${membership.academyId}`;
      const [studentsSnap, feesSnap, paymentsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, `${academyPath}/students`)),
        getDocs(collection(db, `${academyPath}/fees`)),
        getDocs(collection(db, `${academyPath}/payments`)),
        getDocs(collection(db, `${academyPath}/users`))
      ]);
      setStudents(studentsSnap.docs.map((docSnap) => ({ id: docSnap.id, fullName: String(docSnap.data().fullName ?? "Alumno") })));
      setFees(feesSnap.docs.map((docSnap) => docSnap.data() as Fee));
      setPayments(paymentsSnap.docs.map((docSnap) => docSnap.data() as Payment));
      setUsersCount(usersSnap.size);
    }
    void load();
  }, [membership]);

  const paymentRows = useMemo(() => {
    return students
      .map((student) => {
        const totalFees = fees
          .filter((fee) => fee.studentId === student.id)
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const totalPaid = payments
          .filter((payment) => payment.studentId === student.id)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const pending = Math.max(0, totalFees - totalPaid);
        const status = pending === 0 && totalFees > 0 ? "AL DIA" : totalPaid > 0 ? "PARCIAL" : "SIN PAGO";
        return {
          studentId: student.id,
          studentName: student.fullName,
          totalFees,
          totalPaid,
          pending,
          status
        };
      })
      .sort((a, b) => b.pending - a.pending);
  }, [students, fees, payments]);

  const summary = useMemo(() => {
    const paidStudents = paymentRows.filter((row) => row.status === "AL DIA").length;
    const unpaidStudents = paymentRows.filter((row) => row.status === "SIN PAGO").length;
    const partialStudents = paymentRows.filter((row) => row.status === "PARCIAL").length;
    const totalPending = paymentRows.reduce((sum, row) => sum + row.pending, 0);
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      students: students.length,
      paidStudents,
      unpaidStudents,
      partialStudents,
      totalPending,
      totalCollected,
      payments: payments.length,
      users: usersCount
    };
  }, [paymentRows, payments, students.length, usersCount]);

  return (
    <div className="grid gap-4">
      <Panel
        title="Perfil Owner"
        action={
          <div className="flex gap-2">
            <Link
              to="/app/students"
              className="rounded-brand border border-primary/60 px-3 py-2 text-xs text-primary hover:bg-primary/10"
            >
              Gestionar alumnos
            </Link>
            <Link
              to="/app/payments"
              className="rounded-brand border border-secondary/60 px-3 py-2 text-xs text-secondary hover:bg-secondary/10"
            >
              Registrar pago
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Alumnos" value={summary.students} color="text-primary" />
          <Stat title="Al dia" value={summary.paidStudents} color="text-secondary" />
          <Stat title="Sin pago" value={summary.unpaidStudents} color="text-danger" />
          <Stat title="Parcial" value={summary.partialStudents} color="text-warning" />
          <Stat title="Cobrado total" value={`$${summary.totalCollected}`} color="text-secondary" />
          <Stat title="Pendiente total" value={`$${summary.totalPending}`} color="text-warning" />
          <Stat title="Movimientos" value={summary.payments} color="text-text" />
          <Stat title="Usuarios" value={summary.users} color="text-text" />
        </div>
      </Panel>

      <Panel title="Quien pago y quien no">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-3 py-2">Alumno</th>
                <th className="px-3 py-2">Facturado</th>
                <th className="px-3 py-2">Pagado</th>
                <th className="px-3 py-2">Pendiente</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => (
                <tr key={row.studentId} className="border-t border-slate-800">
                  <td className="px-3 py-3">{row.studentName}</td>
                  <td className="px-3 py-3 text-muted">${row.totalFees}</td>
                  <td className="px-3 py-3 text-secondary">${row.totalPaid}</td>
                  <td className="px-3 py-3 text-warning">${row.pending}</td>
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
    </div>
  );
}

function Stat({ title, value, color }: { title: string; value: number | string; color: string }) {
  return (
    <div className="rounded-brand border border-slate-700 bg-bg p-4">
      <p className="text-xs uppercase text-muted">{title}</p>
      <p className={`mt-2 font-display text-3xl ${color}`}>{value}</p>
    </div>
  );
}
