import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { generateMonthlyFeesForCenter, getCurrentPeriodParts, getFeePriorityWindow, loadAcademyBillingSnapshot, type AcademyBillingSnapshot } from "../../lib/academyBilling";

export function AcademyDashboardPage() {
  const { membership, isPreviewMode } = useAuth();
  const [snapshot, setSnapshot] = useState<AcademyBillingSnapshot | null>(null);

  useEffect(() => {
    async function load() {
      if (isPreviewMode) {
        setSnapshot({
          defaultBillingDay: 10,
          students: [
            { id: "student-1", fullName: "Ana Perez", email: "", phone: "", emergencyContactName: "", emergencyContactPhone: "", allergies: "", status: "active", disciplines: [] },
            { id: "student-2", fullName: "Bruno Diaz", email: "", phone: "", emergencyContactName: "", emergencyContactPhone: "", allergies: "", status: "active", disciplines: [] },
            { id: "student-3", fullName: "Carla Ruiz", email: "", phone: "", emergencyContactName: "", emergencyContactPhone: "", allergies: "", status: "inactive", disciplines: [] }
          ],
          disciplines: [],
          enrollments: [],
          fees: [
            {
              id: "fee-1",
              centerId: "demo",
              studentId: "student-1",
              disciplineId: "disc-1",
              enrollmentId: "enr-1",
              concept: "Voley - 03/2026",
              periodYear: 2026,
              periodMonth: 3,
              dueDate: "2026-03-10",
              originalAmount: 20000,
              amountPaid: 10000,
              balance: 10000,
              status: "partial",
              lateFeeAmount: 0,
              totalAmount: 20000,
              reminderStatus: "not_sent",
              paymentMode: "monthly",
              partialAllowed: true,
              studentName: "Ana Perez",
              disciplineName: "Voley"
            },
            {
              id: "fee-2",
              centerId: "demo",
              studentId: "student-2",
              disciplineId: "disc-2",
              enrollmentId: "enr-2",
              concept: "Danza - 03/2026",
              periodYear: 2026,
              periodMonth: 3,
              dueDate: "2026-03-04",
              originalAmount: 18000,
              amountPaid: 0,
              balance: 18000,
              status: "overdue",
              lateFeeAmount: 0,
              totalAmount: 18000,
              reminderStatus: "not_sent",
              paymentMode: "monthly",
              partialAllowed: true,
              studentName: "Bruno Diaz",
              disciplineName: "Danza"
            },
            {
              id: "fee-3",
              centerId: "demo",
              studentId: "student-1",
              disciplineId: "disc-1",
              enrollmentId: "enr-3",
              concept: "Pilates - 03/2026",
              periodYear: 2026,
              periodMonth: 3,
              dueDate: "2026-03-01",
              originalAmount: 22000,
              amountPaid: 22000,
              balance: 0,
              status: "paid",
              lateFeeAmount: 0,
              totalAmount: 22000,
              reminderStatus: "not_needed",
              paymentMode: "monthly",
              partialAllowed: true,
              studentName: "Ana Perez",
              disciplineName: "Pilates"
            }
          ],
          payments: []
        });
        return;
      }

      if (!membership) return;
      await generateMonthlyFeesForCenter(membership.academyId);
      setSnapshot(await loadAcademyBillingSnapshot(membership.academyId));
    }

    void load();
  }, [isPreviewMode, membership?.academyId]);

  const currentPeriod = getCurrentPeriodParts();
  const activeStudents = useMemo(
    () => (snapshot?.students ?? []).filter((student) => student.status === "active"),
    [snapshot]
  );

  const currentFees = useMemo(() => {
    const activeIds = new Set(activeStudents.map((student) => student.id));
    return (snapshot?.fees ?? []).filter(
      (fee) =>
        activeIds.has(fee.studentId) &&
        fee.periodYear === currentPeriod.year &&
        fee.periodMonth === currentPeriod.month
    );
  }, [activeStudents, currentPeriod.month, currentPeriod.year, snapshot]);

  const summary = useMemo(() => {
    const totalIssued = currentFees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalCollected = currentFees.reduce((sum, fee) => sum + fee.amountPaid, 0);
    const totalPending = currentFees.reduce((sum, fee) => sum + fee.balance, 0);
    const overdueCount = currentFees.filter((fee) => fee.status === "overdue").length;
    const upcomingCount = currentFees.filter((fee) => fee.balance > 0 && getFeePriorityWindow(fee) >= 0 && getFeePriorityWindow(fee) <= 7).length;
    const paidCount = currentFees.filter((fee) => fee.status === "paid").length;
    const collectionRate = totalIssued > 0 ? Math.round((totalCollected / totalIssued) * 100) : 0;

    return {
      totalIssued,
      totalCollected,
      totalPending,
      overdueCount,
      upcomingCount,
      paidCount,
      collectionRate
    };
  }, [currentFees]);

  const priorityFees = useMemo(() => {
    return [...currentFees]
      .filter((fee) => fee.balance > 0)
      .sort((a, b) => getFeePriorityWindow(a) - getFeePriorityWindow(b))
      .slice(0, 6);
  }, [currentFees]);

  const dashboardTitle = membership?.academyName ? `Resumen de ${membership.academyName}` : "Resumen del centro";

  return (
    <div className="grid gap-4">
      <Panel
        title={dashboardTitle}
        action={
          <div className="flex gap-2">
            <Link to="/app/fees" className="rounded-brand border border-[rgba(0,209,255,0.18)] px-3 py-2 text-xs text-[#00D1FF] transition hover:bg-[rgba(0,209,255,0.08)]">
              Ver cuotas
            </Link>
            <Link to="/app/students" className="rounded-brand border border-[rgba(34,197,94,0.18)] px-3 py-2 text-xs text-[#22C55E] transition hover:bg-[rgba(34,197,94,0.08)]">
              Crear alumno
            </Link>
          </div>
        }
      >
        <div className="mb-4 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[rgba(0,209,255,0.04)] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">Ciclo actual</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoPill label="Periodo operativo" value={`${String(currentPeriod.month).padStart(2, "0")}/${currentPeriod.year}`} />
            <InfoPill label="Tasa cobrada" value={`${summary.collectionRate}% del total emitido`} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Cobrado" value={`$${summary.totalCollected}`} color="text-[#22C55E]" helper="Pagado este ciclo" featured />
          <Stat title="Saldo pendiente" value={`$${summary.totalPending}`} color="text-[#FF4D4F]" helper="Pendiente del ciclo" featured />
          <Stat title="Alumnos activos" value={activeStudents.length} color="text-[#00D1FF]" helper="Base activa del centro" />
          <Stat title="Cuotas cerradas" value={summary.paidCount} color="text-[#F5F7FB]" helper="Cuotas totalmente pagadas" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MiniCard label="Tasa cobrada" value={`${summary.collectionRate}%`} tone="ok" helper="Cobranza del periodo" />
          <MiniCard label="Por vencer" value={`${summary.upcomingCount}`} tone={summary.upcomingCount > 0 ? "warning" : "ok"} helper="Vencen en los proximos 7 dias" />
          <MiniCard label="Vencidas" value={`${summary.overdueCount}`} tone={summary.overdueCount > 0 ? "danger" : "ok"} helper="Requieren accion inmediata" />
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
                        <td className="px-3 py-3 text-[#9FB0D0]">{fee.concept}</td>
                        <td className="px-3 py-3 font-semibold text-[#FF4D4F]">${fee.balance}</td>
                        <td className="px-3 py-3 text-[#9FB0D0]">{fee.dueDate}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={fee.status} />
                        </td>
                        <td className="px-3 py-3">
                          <Link to="/app/fees" className="rounded-brand border border-[rgba(0,209,255,0.15)] px-2 py-1 text-xs text-[#00D1FF] transition hover:bg-[rgba(0,209,255,0.08)]">
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
                        <p className="mt-1 text-sm text-[#9FB0D0]">{fee.concept}</p>
                      </div>
                      <StatusBadge status={fee.status} />
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
            <p className="text-sm text-[#9FB0D0]">No hay cuotas prioritarias pendientes para este ciclo.</p>
          )}
        </Panel>

        <Panel title="Acciones rapidas">
          <div className="grid gap-2">
            <QuickLink to="/app/disciplinas" label="Crear disciplina" helper="Define el valor base de la cuota." />
            <QuickLink to="/app/students" label="Crear alumno" helper="Carga el alumno y asigna sus disciplinas." />
            <QuickLink to="/app/fees" label="Registrar cobro" helper="Impacta el pago en cuotas y resumen." />
            <QuickLink to="/app/settings" label="Configuracion" helper="Ajusta el centro sin competir con la operacion." />
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

function StatusBadge({ status }: { status: "pending" | "partial" | "paid" | "overdue" }) {
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
      {status === "paid" ? "Pagada" : status === "overdue" ? "Vencida" : status === "partial" ? "Parcial" : "Pendiente"}
    </span>
  );
}

function QuickLink({ to, label, helper }: { to: string; label: string; helper: string }) {
  return (
    <Link to={to} className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] px-4 py-4 transition hover:border-[#00D1FF] hover:bg-[rgba(0,209,255,0.04)]">
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
