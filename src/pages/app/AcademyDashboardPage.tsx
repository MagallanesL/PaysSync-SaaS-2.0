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
  const { membership, isPreviewMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usersCount, setUsersCount] = useState(0);

  useEffect(() => {
    async function load() {
      if (isPreviewMode) {
        setStudents([
          { id: "student-1", fullName: "Ana Perez" },
          { id: "student-2", fullName: "Bruno Diaz" },
          { id: "student-3", fullName: "Carla Ruiz" }
        ]);
        setFees([
          { studentId: "student-1", amount: 12000 },
          { studentId: "student-2", amount: 15000 },
          { studentId: "student-3", amount: 15000 }
        ]);
        setPayments([
          { studentId: "student-1", amount: 12000, paymentDate: "2026-03-01" },
          { studentId: "student-2", amount: 5000, paymentDate: "2026-03-10" }
        ]);
        setUsersCount(4);
        return;
      }
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
  }, [isPreviewMode, membership]);

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

  const dashboardTitle = membership?.academyName ? `Resumen de ${membership.academyName}` : "Resumen de la academia";
  const upcomingCount = fees.filter((fee) => Number(fee.amount || 0) > 0).length;
  const collectionRate =
    paymentRows.length > 0 ? Math.round((summary.paidStudents / paymentRows.length) * 100) : 0;
  const topDebtors = paymentRows.filter((row) => row.pending > 0).slice(0, 3);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <RouteJump to="/app/dashboard" label="Dashboard" />
        <RouteJump to="/app/students" label="Alumnos" />
        <RouteJump to="/app/fees" label="Cuotas" />
        <RouteJump to="/app/payments" label="Pagos" />
        <RouteJump to="/app/debt" label="Deuda" />
        <RouteJump to="/app/users" label="Usuarios" />
        <RouteJump to="/app/settings" label="Settings" />
        <RouteJump to="/root/dashboard" label="Root" />
      </div>

      <Panel
        title={dashboardTitle}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Cobrado del periodo" value={`$${summary.totalCollected}`} color="text-secondary" />
          <Stat title="Pendiente por cobrar" value={`$${summary.totalPending}`} color="text-warning" />
          <Stat title="Alumnos activos" value={summary.students} color="text-primary" />
          <Stat title="Equipo con acceso" value={summary.users} color="text-text" />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Alertas">
          <div className="grid gap-3 text-sm">
            <AlertRow
              label="Alumnos sin pago"
              value={`${summary.unpaidStudents}`}
              tone={summary.unpaidStudents > 0 ? "danger" : "ok"}
            />
            <AlertRow
              label="Pagos parciales"
              value={`${summary.partialStudents}`}
              tone={summary.partialStudents > 0 ? "warning" : "ok"}
            />
            <AlertRow
              label="Cuotas cargadas"
              value={`${upcomingCount}`}
              tone="neutral"
            />
          </div>
        </Panel>

        <Panel title="Salud de cobranza">
          <div className="grid gap-3 text-sm">
            <MetricLine label="Tasa al dia" value={`${collectionRate}%`} />
            <MetricLine label="Movimientos registrados" value={`${summary.payments}`} />
            <MetricLine label="Pendiente total" value={`$${summary.totalPending}`} />
            <MetricLine label="Cobrado total" value={`$${summary.totalCollected}`} />
          </div>
        </Panel>

        <Panel title="Accesos rapidos">
          <div className="grid gap-2">
            <QuickLink to="/app/students" label="Ver y editar alumnos" />
            <QuickLink to="/app/fees" label="Gestionar cuotas" />
            <QuickLink to="/app/payments" label="Registrar pagos" />
            <QuickLink to="/app/debt" label="Revisar morosidad" />
            <QuickLink to="/app/users" label="Administrar equipo" />
            <QuickLink to="/app/settings" label="Configurar academia" />
          </div>
        </Panel>
      </div>

      <Panel title="Seguimiento prioritario">
        {topDebtors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Pendiente</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Ir a</th>
                </tr>
              </thead>
              <tbody>
                {topDebtors.map((row) => (
                  <tr key={row.studentId} className="border-t border-slate-800">
                    <td className="px-3 py-3">{row.studentName}</td>
                    <td className="px-3 py-3 text-warning">${row.pending}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-brand bg-warning/15 px-2 py-1 text-xs text-warning">{row.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Link to="/app/debt" className="text-xs text-primary hover:underline">
                        Ver morosidad
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No hay deuda prioritaria para revisar ahora mismo.</p>
        )}
      </Panel>

      <Panel title="Estado general">
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

function AlertRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "danger" | "warning" | "ok" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "ok"
          ? "text-secondary"
          : "text-text";

  return (
    <div className="flex items-center justify-between rounded-brand border border-slate-700 bg-bg px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-brand border border-slate-700 bg-bg px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-text">{value}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-brand border border-slate-700 bg-bg px-3 py-2 text-sm text-muted transition hover:border-primary hover:text-primary"
    >
      {label}
    </Link>
  );
}

function RouteJump({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-brand border border-slate-700 bg-surface px-3 py-1.5 text-xs text-muted transition hover:border-primary hover:text-primary"
    >
      {label}
    </Link>
  );
}
