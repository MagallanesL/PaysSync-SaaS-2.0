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
              className="rounded-brand border border-[rgba(0,209,255,0.18)] px-3 py-2 text-xs text-[#00D1FF] transition hover:bg-[rgba(0,209,255,0.08)]"
            >
              Ver cuotas vencidas
            </Link>
            <Link
              to="/app/fees"
              className="rounded-brand border border-[rgba(34,197,94,0.18)] px-3 py-2 text-xs text-[#22C55E] transition hover:bg-[rgba(34,197,94,0.08)]"
            >
              Registrar cobro
            </Link>
          </div>
        }
      >
        <div className="mb-4 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[rgba(0,209,255,0.04)] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">Contexto actual</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoPill label="Ciclo actual" value="Mes actual" />
            <InfoPill label="Estado de cobro" value={`${collectionRate}% cobrado`} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Cobrado" value={`$${summary.totalCollected}`} color="text-[#22C55E]" helper="Pagado este ciclo" featured />
          <Stat title="Saldo pendiente" value={`$${summary.totalPending}`} color="text-[#FF4D4F]" helper="Dinero por cobrar" featured />
          <Stat title="Alumnos activos" value={summary.students} color="text-[#00D1FF]" helper="Base activa del centro" />
          <Stat title="Cuotas cerradas" value={summary.paidCount} color="text-[#F5F7FB]" helper="Pagadas por completo" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MiniCard label="Tasa cobrada" value={`${collectionRate}%`} tone="ok" helper="Cobranza del periodo" />
          <MiniCard label="Por vencer" value={`${summary.upcomingCount}`} tone={summary.upcomingCount > 0 ? "warning" : "ok"} helper="Cuotas a seguir" />
          <MiniCard label="Vencidas" value={`${summary.overdueCount}`} tone={summary.overdueCount > 0 ? "danger" : "ok"} helper="Requieren accion" />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <Panel title="Cuotas prioritarias">
          {priorityFees.length > 0 ? (
            <div className="grid gap-3">
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[#9FB0D0]">
                    <tr>
                      <th className="px-3 py-2">Alumno</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Saldo</th>
                      <th className="px-3 py-2">Vencimiento</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityFees.map((fee) => (
                      <tr key={fee.id} className="border-t border-slate-800">
                        <td className="px-3 py-3">{fee.studentName}</td>
                        <td className="px-3 py-3 text-[#9FB0D0]">{fee.disciplineName ?? fee.concept ?? "Cuota"}</td>
                        <td className="px-3 py-3 font-semibold text-[#FF4D4F]">${fee.balance}</td>
                        <td className="px-3 py-3 text-[#9FB0D0]">{fee.dueDate}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={fee.status} daysLeft={fee.daysLeft} />
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            to="/app/fees"
                            className="rounded-brand border border-[rgba(0,209,255,0.15)] px-2 py-1 text-xs text-[#00D1FF] transition hover:bg-[rgba(0,209,255,0.08)]"
                          >
                            Gestionar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {priorityFees.map((fee) => (
                  <article key={fee.id} className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#F5F7FB]">{fee.studentName}</p>
                        <p className="mt-1 text-sm text-[#9FB0D0]">{fee.disciplineName ?? fee.concept ?? "Cuota"}</p>
                      </div>
                      <StatusBadge status={fee.status} daysLeft={fee.daysLeft} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <MobileKpi label="Saldo" value={`$${fee.balance}`} accent="text-[#FF4D4F]" />
                      <MobileKpi label="Vencimiento" value={fee.dueDate} accent="text-[#F5F7FB]" />
                      <MobileKpi label="Accion" value="Gestionar" accent="text-[#00D1FF]" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#9FB0D0]">No hay cuotas urgentes para revisar dentro de los proximos 15 dias.</p>
          )}
        </Panel>

        <Panel title="Acciones rapidas">
          <div className="grid gap-2">
            <QuickLink to="/app/students" label="Crear alumno" helper="Suma nuevos alumnos y organiza su informacion." />
            <QuickLink to="/app/fees" label="Registrar cobro" helper="Actualiza pagos y reduce saldo pendiente." />
            <QuickLink to="/app/fees" label="Ver cuotas vencidas" helper="Prioriza deuda y proximos vencimientos." />
            <QuickLink to="/app/disciplinas" label="Gestionar disciplinas" helper="Ordena la oferta y el valor base de cobro." />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  color,
  helper,
  featured = false
}: {
  title: string;
  value: number | string;
  color: string;
  helper?: string;
  featured?: boolean;
}) {
  return (
    <div className={`rounded-brand border p-4 ${featured ? "border-[rgba(0,209,255,0.22)] bg-[rgba(255,255,255,0.02)]" : "border-[rgba(0,209,255,0.15)] bg-[#0B0F1A]"}`}>
      <p className="text-xs uppercase text-[#9FB0D0]">{title}</p>
      <p className={`mt-3 font-display text-3xl ${color}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#9FB0D0]">{helper}</p> : null}
    </div>
  );
}

function MiniCard({
  label,
  value,
  tone,
  helper
}: {
  label: string;
  value: string;
  tone: "danger" | "warning" | "ok";
  helper?: string;
}) {
  const toneClass = tone === "danger" ? "text-[#FF4D4F]" : tone === "warning" ? "text-[#F59E0B]" : "text-[#22C55E]";

  return (
    <div className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] px-4 py-3">
      <p className="text-xs uppercase text-[#9FB0D0]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#9FB0D0]">{helper}</p> : null}
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
          ? "bg-[#22C55E]/15 text-[#22C55E]"
          : status === "overdue"
            ? "bg-[#FF4D4F]/15 text-[#FF4D4F]"
            : status === "partial"
              ? "bg-[#00D1FF]/15 text-[#00D1FF]"
              : "bg-[#F59E0B]/15 text-[#F59E0B]"
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
      className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] px-4 py-4 transition hover:border-[#00D1FF] hover:bg-[rgba(0,209,255,0.04)]"
    >
      <p className="text-sm font-medium text-[#F5F7FB]">{label}</p>
      <p className="mt-1 text-xs text-[#9FB0D0]">{helper}</p>
    </Link>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[#9FB0D0]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#F5F7FB]">{value}</p>
    </div>
  );
}

function MobileKpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-brand border border-[rgba(0,209,255,0.1)] bg-[#121A2B] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[#9FB0D0]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
