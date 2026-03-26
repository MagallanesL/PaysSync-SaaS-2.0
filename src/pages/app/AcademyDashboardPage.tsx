import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import { diffDays, getFeeBalance, normalizePaidAmount, resolveFeeStatus, type FeeStatus } from "../../lib/fees";

interface Student {
  id: string;
  fullName: string;
  status: "active" | "inactive";
}

interface Fee {
  id: string;
  studentId: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: FeeStatus;
  disciplineName?: string;
  concept?: string;
}

function normalizeFee(data: Omit<Fee, "id" | "paidAmount" | "balance" | "status"> & { paidAmount?: number; status?: string }) {
  const amount = Number(data.amount || 0);
  const paidAmount = normalizePaidAmount(amount, data.paidAmount ?? (data.status === "paid" ? amount : 0));
  return {
    ...data,
    amount,
    paidAmount,
    balance: getFeeBalance(amount, paidAmount),
    status: resolveFeeStatus({
      amount,
      paidAmount,
      dueDate: data.dueDate
    })
  };
}

export function AcademyDashboardPage() {
  const { membership, isPreviewMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);

  useEffect(() => {
    async function load() {
      if (isPreviewMode) {
        setStudents([
          { id: "student-1", fullName: "Ana Perez", status: "active" },
          { id: "student-2", fullName: "Bruno Diaz", status: "active" },
          { id: "student-3", fullName: "Carla Ruiz", status: "inactive" }
        ]);
        setFees([
          {
            id: "fee-1",
            ...normalizeFee({
              studentId: "student-1",
              amount: 20000,
              paidAmount: 10000,
              dueDate: "2026-03-10",
              disciplineName: "Freestyle"
            })
          },
          {
            id: "fee-2",
            ...normalizeFee({
              studentId: "student-2",
              amount: 18000,
              paidAmount: 0,
              dueDate: "2026-03-04",
              disciplineName: "Breaking"
            })
          },
          {
            id: "fee-3",
            ...normalizeFee({
              studentId: "student-1",
              amount: 20000,
              paidAmount: 20000,
              dueDate: "2026-03-01",
              disciplineName: "Freestyle"
            })
          }
        ]);
        return;
      }
      if (!membership) return;
      const academyPath = `academies/${membership.academyId}`;
      const [studentsSnap, feesSnap] = await Promise.all([
        getDocs(collection(db, `${academyPath}/students`)),
        getDocs(collection(db, `${academyPath}/fees`))
      ]);
      setStudents(
        studentsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          fullName: String(docSnap.data().fullName ?? "Alumno"),
          status: (docSnap.data().status as Student["status"]) ?? "active"
        }))
      );
      setFees(
        feesSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...normalizeFee(docSnap.data() as Omit<Fee, "id">)
        }))
      );
    }
    void load();
  }, [isPreviewMode, membership]);

  const activeStudents = useMemo(() => students.filter((student) => student.status === "active"), [students]);
  const activeStudentIds = useMemo(() => new Set(activeStudents.map((student) => student.id)), [activeStudents]);

  const summary = useMemo(() => {
    const activeFees = fees.filter((fee) => activeStudentIds.has(fee.studentId));
    const totalCollected = activeFees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const totalPending = activeFees.reduce((sum, fee) => sum + fee.balance, 0);
    const overdueCount = activeFees.filter((fee) => fee.status === "overdue").length;
    const upcomingCount = activeFees.filter((fee) => {
      const daysLeft = diffDays(fee.dueDate);
      return daysLeft >= 0 && daysLeft <= 15;
    }).length;

    return {
      students: activeStudents.length,
      totalCollected,
      totalPending,
      overdueCount,
      upcomingCount,
      paidCount: activeFees.filter((fee) => fee.balance === 0).length
    };
  }, [fees, activeStudentIds, activeStudents]);

  const priorityFees = useMemo(() => {
    return fees
      .filter((fee) => activeStudentIds.has(fee.studentId))
      .map((fee) => ({
        ...fee,
        studentName: activeStudents.find((student) => student.id === fee.studentId)?.fullName ?? fee.studentId,
        daysLeft: diffDays(fee.dueDate)
      }))
      .filter((fee) => fee.daysLeft <= 15)
      .sort((a, b) => {
        if (a.daysLeft < 0 && b.daysLeft >= 0) return -1;
        if (b.daysLeft < 0 && a.daysLeft >= 0) return 1;
        return a.daysLeft - b.daysLeft;
      })
      .slice(0, 6);
  }, [fees, activeStudentIds, activeStudents]);

  const dashboardTitle = membership?.academyName ? `Resumen de ${membership.academyName}` : "Resumen del centro";
  const collectionRate =
    summary.totalCollected + summary.totalPending > 0
      ? Math.round((summary.totalCollected / (summary.totalCollected + summary.totalPending)) * 100)
      : 0;

  return (
    <div className="grid gap-4">
      <Panel
        title={dashboardTitle}
        action={
          <div className="flex gap-2">
            <Link
              to="/app/fees"
              className="rounded-brand border border-secondary/60 px-3 py-2 text-xs text-secondary hover:bg-secondary/10"
            >
              Gestionar cuotas
            </Link>
            <Link
              to="/app/fees"
              className="rounded-brand border border-warning/60 px-3 py-2 text-xs text-warning hover:bg-warning/10"
            >
              Gestionar cobros
            </Link>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Cobrado" value={`$${summary.totalCollected}`} color="text-secondary" />
          <Stat title="Saldo pendiente" value={`$${summary.totalPending}`} color="text-warning" />
          <Stat title="Alumnos activos" value={summary.students} color="text-primary" />
          <Stat title="Cuotas cerradas" value={summary.paidCount} color="text-text" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MiniCard label="Tasa cobrada" value={`${collectionRate}%`} tone="ok" />
          <MiniCard label="Por vencer" value={`${summary.upcomingCount}`} tone={summary.upcomingCount > 0 ? "warning" : "ok"} />
          <MiniCard label="Vencidas" value={`${summary.overdueCount}`} tone={summary.overdueCount > 0 ? "danger" : "ok"} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <Panel title="Cuotas prioritarias">
          {priorityFees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="px-3 py-2">Alumno</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Entregado</th>
                    <th className="px-3 py-2">Saldo</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityFees.map((fee) => (
                    <tr key={fee.id} className="border-t border-slate-800">
                      <td className="px-3 py-3">{fee.studentName}</td>
                      <td className="px-3 py-3 text-muted">{fee.disciplineName ?? fee.concept ?? "Cuota"}</td>
                      <td className="px-3 py-3 text-secondary">${fee.paidAmount}</td>
                      <td className="px-3 py-3 font-semibold text-warning">${fee.balance}</td>
                      <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={fee.status} daysLeft={fee.daysLeft} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">No hay cuotas urgentes para revisar dentro de los proximos 15 dias.</p>
          )}
        </Panel>

        <Panel title="Acciones rapidas">
          <div className="grid gap-2">
            <QuickLink to="/app/students" label="Administrar alumnos" helper="Alta, edicion y disciplinas asignadas." />
            <QuickLink to="/app/fees" label="Gestionar cuotas" helper="Ver total, entregado, saldo y vencimiento." />
            <QuickLink to="/app/fees" label="Gestionar cobros" helper="Prioriza cuotas cercanas, vencidas y avisos." />
          </div>
        </Panel>
      </div>
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

function MiniCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "danger" | "warning" | "ok";
}) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-secondary";

  return (
    <div className="rounded-brand border border-slate-700 bg-bg px-4 py-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status, daysLeft }: { status: FeeStatus; daysLeft: number }) {
  const label =
    status === "paid"
      ? "Pagada"
      : status === "overdue"
        ? "Vencida"
        : daysLeft <= 0
          ? "Vence hoy"
          : status === "partial"
            ? "Parcial"
            : `${daysLeft} dias`;

  return (
    <span
      className={`rounded-brand px-2 py-1 text-xs ${
        status === "paid"
          ? "bg-secondary/15 text-secondary"
          : status === "overdue"
          ? "bg-danger/15 text-danger"
          : status === "partial"
            ? "bg-primary/15 text-primary"
            : "bg-warning/15 text-warning"
      }`}
    >
      {label}
    </span>
  );
}

function QuickLink({ to, label, helper }: { to: string; label: string; helper: string }) {
  return (
    <Link
      to={to}
      className="rounded-brand border border-slate-700 bg-bg px-3 py-3 transition hover:border-primary"
    >
      <p className="text-sm font-medium text-text">{label}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </Link>
  );
}
