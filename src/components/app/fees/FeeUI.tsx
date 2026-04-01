import { Link } from "react-router-dom";
import { buildReminderLink, type AcademyBillingSnapshot, type FeeRecord } from "../../../lib/academyBilling";
import { formatMembershipStatus } from "../../../lib/display";
import { MobileInfo } from "../common/FormPrimitives";

export function FeesSummaryCard({
  label,
  value,
  color,
  helper,
  featured = false
}: {
  label: string;
  value: number | string;
  color: string;
  helper?: string;
  featured?: boolean;
}) {
  return (
    <div className={`rounded-brand border p-3 ${featured ? "border-[rgba(255,77,79,0.28)] bg-[rgba(255,77,79,0.06)]" : "border-slate-700 bg-bg"}`}>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${color}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

export function FeeStatusBadge({ status }: { status: FeeRecord["status"] }) {
  return (
    <span
      className={`rounded-brand px-2 py-1 text-xs font-semibold ${
        status === "paid"
          ? "bg-secondary/15 text-secondary"
          : status === "partial"
            ? "bg-warning/15 text-warning"
            : status === "overdue"
              ? "bg-danger/15 text-danger"
              : "bg-primary/15 text-primary"
      }`}
    >
      {formatMembershipStatus(status)}
    </span>
  );
}

export function FeesEmptyState({
  canWrite,
  isPreviewMode,
  onGenerateFees,
  mobile = false
}: {
  canWrite: boolean;
  isPreviewMode: boolean;
  onGenerateFees: () => void;
  mobile?: boolean;
}) {
  const wrapperClass = mobile
    ? "rounded-brand border border-slate-800 bg-[#0B0F1A] p-4"
    : "flex flex-col items-start gap-3 rounded-brand border border-slate-800 bg-[#0B0F1A] p-4";

  return (
    <div className={wrapperClass}>
      <p className="text-sm text-text">Todavia no tenes cuotas este mes.</p>
      <p className="mt-2 text-xs text-muted">
        Crea un alumno, asignale una disciplina o genera las cuotas del periodo para empezar a cobrar.
      </p>
      <div className={`mt-3 ${mobile ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}`}>
        <Link to="/app/students" className="rounded-brand bg-primary px-3 py-2 text-center text-xs font-semibold text-bg">
          Crear alumno
        </Link>
        <Link to="/app/students" className="rounded-brand border border-secondary/30 px-3 py-2 text-center text-xs text-secondary hover:bg-secondary/10">
          Asignar disciplina
        </Link>
        <button
          type="button"
          onClick={onGenerateFees}
          disabled={!canWrite || isPreviewMode}
          className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
        >
          Generar cuotas
        </button>
      </div>
    </div>
  );
}

interface FeeListProps {
  fees: FeeRecord[];
  snapshot: AcademyBillingSnapshot | null;
  canWrite: boolean;
  isPreviewMode: boolean;
  onRegisterPayment: (fee: FeeRecord) => void;
  onReminderClick: (fee: FeeRecord, reminderUrl: string) => void;
  onGenerateFees: () => void;
}

export function FeesMobileList({
  fees,
  snapshot,
  canWrite,
  isPreviewMode,
  onRegisterPayment,
  onReminderClick,
  onGenerateFees
}: FeeListProps) {
  return (
    <div className="space-y-3 md:hidden">
      {fees.map((fee) => {
        const reminderUrl = getReminderUrl(snapshot, fee);

        return (
          <article key={fee.id} className="rounded-brand border border-slate-800 bg-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-text">{fee.studentName}</p>
                <p className="break-words text-sm text-muted">{fee.concept}</p>
              </div>
              <FeeStatusBadge status={fee.status} />
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted">
              <MobileInfo label="Total" value={`$${fee.totalAmount}`} />
              <MobileInfo label="Pagado" value={`$${fee.amountPaid}`} />
              <MobileInfo label="Saldo" value={`$${fee.balance}`} />
              <MobileInfo label="Vencimiento" value={fee.dueDate} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onRegisterPayment(fee)}
                disabled={!canWrite || isPreviewMode || fee.balance === 0}
                className="rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-bg disabled:opacity-40"
              >
                Registrar pago
              </button>
              {reminderUrl ? (
                <a
                  href={reminderUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onReminderClick(fee, reminderUrl)}
                  className="rounded-brand border border-secondary/30 px-3 py-2 text-center text-sm text-secondary hover:bg-secondary/10"
                >
                  Enviar recordatorio
                </a>
              ) : (
                <p className="text-sm text-muted">Aviso pendiente sin telefono cargado</p>
              )}
            </div>
          </article>
        );
      })}
      {fees.length === 0 ? (
        <FeesEmptyState canWrite={canWrite} isPreviewMode={isPreviewMode} onGenerateFees={onGenerateFees} mobile />
      ) : null}
    </div>
  );
}

export function FeesTable({
  fees,
  snapshot,
  canWrite,
  isPreviewMode,
  onRegisterPayment,
  onReminderClick,
  onGenerateFees,
  formatPeriodLabel
}: FeeListProps & {
  formatPeriodLabel: (year: number, month: number) => string;
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted">
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
          {fees.map((fee) => {
            const reminderUrl = getReminderUrl(snapshot, fee);

            return (
              <tr key={fee.id} className="border-t border-slate-800">
                <td className="px-3 py-3 text-muted">{fee.studentName}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-text">{fee.concept}</p>
                  <p className="text-xs text-muted">Periodo {formatPeriodLabel(fee.periodYear, fee.periodMonth)}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-warning">${fee.balance}</td>
                <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                <td className="px-3 py-3">
                  <FeeStatusBadge status={fee.status} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRegisterPayment(fee)}
                      disabled={!canWrite || isPreviewMode || fee.balance === 0}
                      className="rounded-brand border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
                    >
                      Registrar pago
                    </button>
                    {reminderUrl ? (
                      <a
                        href={reminderUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => onReminderClick(fee, reminderUrl)}
                        className="rounded-brand border border-secondary/30 px-2 py-1 text-xs text-secondary hover:bg-secondary/10"
                      >
                        Enviar recordatorio
                      </a>
                    ) : (
                      <span className="text-xs text-muted">Sin telefono</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {fees.length === 0 ? (
            <tr>
              <td className="px-3 py-6" colSpan={6}>
                <FeesEmptyState canWrite={canWrite} isPreviewMode={isPreviewMode} onGenerateFees={onGenerateFees} />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function getReminderUrl(snapshot: AcademyBillingSnapshot | null, fee: FeeRecord) {
  const student = snapshot?.students.find((item) => item.id === fee.studentId);
  return buildReminderLink(
    fee.studentName ?? "Alumno",
    student?.phone ?? student?.emergencyContactPhone ?? "",
    fee.concept,
    fee.balance
  );
}
