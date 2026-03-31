import { serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildReminderLink,
  formatPeriodLabel,
  generateMonthlyFeesForCenter,
  getCurrentPeriodParts,
  getFeePriorityWindow,
  loadAcademyBillingSnapshot,
  registerPayment,
  type AcademyBillingSnapshot,
  type FeeRecord,
  type PaymentMethod
} from "../../lib/academyBilling";
import { formatMembershipStatus, formatPaymentMethod } from "../../lib/display";
import { db } from "../../lib/firebase";

interface PaymentFormState {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note: string;
}

const emptyForm: PaymentFormState = {
  amount: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash",
  note: ""
};

function sortFees(fees: FeeRecord[]) {
  return [...fees].sort((a, b) => {
    const aDays = getFeePriorityWindow(a);
    const bDays = getFeePriorityWindow(b);
    const aIsDebt = a.balance > 0;
    const bIsDebt = b.balance > 0;
    const aIsOverdueDebt = a.status === "overdue" && aIsDebt;
    const bIsOverdueDebt = b.status === "overdue" && bIsDebt;
    const aIsUpcomingDebt = aDays >= 0 && aIsDebt;
    const bIsUpcomingDebt = bDays >= 0 && bIsDebt;

    if (aIsOverdueDebt !== bIsOverdueDebt) return aIsOverdueDebt ? -1 : 1;
    if (aIsUpcomingDebt !== bIsUpcomingDebt) return aIsUpcomingDebt ? -1 : 1;
    if (aDays !== bDays) return aDays - bDays;
    return (a.studentName ?? "").localeCompare(b.studentName ?? "", "es", { sensitivity: "base" });
  });
}

export function FeesPage() {
  const { membership, profile, canWriteAcademyData, isPreviewMode } = useAuth();
  const [snapshot, setSnapshot] = useState<AcademyBillingSnapshot | null>(null);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadData() {
    if (isPreviewMode) {
      setSnapshot({
        defaultBillingDay: 10,
        students: [
          {
            id: "student-1",
            fullName: "Ana Perez",
            email: "ana@demo.com",
            phone: "5491111111111",
            emergencyContactName: "",
            emergencyContactPhone: "",
            allergies: "",
            status: "active",
            disciplines: []
          },
          {
            id: "student-2",
            fullName: "Bruno Diaz",
            email: "",
            phone: "5492222222222",
            emergencyContactName: "",
            emergencyContactPhone: "",
            allergies: "",
            status: "active",
            disciplines: []
          }
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
            amountPaid: 8000,
            balance: 12000,
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
            dueDate: "2026-03-05",
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
          }
        ],
        payments: []
      });
      return;
    }

    if (!membership) return;
    await generateMonthlyFeesForCenter(membership.academyId);
    const billingSnapshot = await loadAcademyBillingSnapshot(membership.academyId);
    setSnapshot(billingSnapshot);
  }

  useEffect(() => {
    void loadData();
  }, [isPreviewMode, membership?.academyId]);

  useEffect(() => {
    if (!isModalOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  const currentPeriod = getCurrentPeriodParts();
  const feeRows = useMemo(() => {
    if (!snapshot) return [];
    const activeStudentIds = new Set(snapshot.students.filter((student) => student.status === "active").map((student) => student.id));
    return sortFees(
      snapshot.fees.filter((fee) => {
        const belongsToActiveStudent = activeStudentIds.has(fee.studentId);
        const isCurrentPeriod = fee.periodYear === currentPeriod.year && fee.periodMonth === currentPeriod.month;
        return belongsToActiveStudent && isCurrentPeriod;
      })
    );
  }, [currentPeriod.month, currentPeriod.year, snapshot]);

  const stats = useMemo(() => {
    const overdue = feeRows.filter((fee) => fee.status === "overdue").length;
    const upcoming = feeRows.filter((fee) => fee.balance > 0 && getFeePriorityWindow(fee) >= 0 && getFeePriorityWindow(fee) <= 7).length;
    const partial = feeRows.filter((fee) => fee.status === "partial").length;
    const pendingBalance = feeRows.reduce((sum, fee) => sum + fee.balance, 0);
    return { overdue, upcoming, partial, pendingBalance };
  }, [feeRows]);

  async function handleGenerateCurrentMonthFees() {
    if (!membership || isPreviewMode) return;
    await generateMonthlyFeesForCenter(membership.academyId);
    await loadData();
  }

  function openPaymentModal(fee: FeeRecord) {
    setSelectedFee(fee);
    setForm({
      amount: String(fee.balance || fee.totalAmount),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      note: ""
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setSelectedFee(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(false);
  }

  async function handleSavePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !selectedFee || !canWriteAcademyData || isPreviewMode) return;

    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Ingresa un monto valido.");
      return;
    }
    if (amount > selectedFee.balance) {
      setFormError("El pago no puede superar el saldo pendiente.");
      return;
    }

    await registerPayment({
      academyId: membership.academyId,
      fee: selectedFee,
      amount,
      paymentDate: form.paymentDate,
      paymentMethod: form.paymentMethod,
      note: form.note,
      createdBy: profile?.displayName ?? profile?.email ?? ""
    });

    closeModal();
    await loadData();
  }

  async function handleMarkReminderSent(fee: FeeRecord) {
    if (!membership || isPreviewMode) return;
    const academyPath = `academies/${membership.academyId}`;
    await updateDoc(doc(db, `${academyPath}/fees`, fee.id), {
      reminderStatus: "sent",
      reminderSentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadData();
  }

  return (
    <>
      <Panel
        title="Cobranza del mes"
        action={
          <button
            type="button"
            onClick={() => void handleGenerateCurrentMonthFees()}
            disabled={!canWriteAcademyData || isPreviewMode}
            className="rounded-brand border border-slate-600 px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {isPreviewMode ? "Modo demo" : "Generar cuotas del mes"}
          </button>
        }
      >
        <div className="mb-4 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[rgba(0,209,255,0.06)] p-4 text-sm">
          <p className="font-semibold text-text">Registrá pagos, controlá saldos y gestioná vencimientos en tiempo real.</p>
          <p className="mt-1 text-muted">
            Priorizá primero lo vencido, después lo que está por vencer, y resolvé la cobranza del mes desde una sola vista.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Summary label="Saldo pendiente" value={`$${stats.pendingBalance}`} color="text-[#FF4D4F]" helper="Dinero por cobrar" featured />
          <Summary label="Vencidas" value={stats.overdue} color="text-[#FF4D4F]" helper="Requieren seguimiento" />
          <Summary label="Por vencer" value={stats.upcoming} color="text-[#F59E0B]" helper="Vencen pronto" />
          <Summary label="Parciales" value={stats.partial} color="text-[#00D1FF]" helper="Cobros incompletos" />
        </div>

        <div className="space-y-3 md:hidden">
          {feeRows.map((fee) => {
            const student = snapshot?.students.find((item) => item.id === fee.studentId);
            const whatsappUrl = buildReminderLink(
              fee.studentName ?? "Alumno",
              student?.phone ?? student?.emergencyContactPhone ?? "",
              fee.concept,
              fee.balance
            );

            return (
              <article key={fee.id} className="rounded-brand border border-slate-800 bg-bg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{fee.studentName}</p>
                    <p className="break-words text-sm text-muted">{fee.concept}</p>
                  </div>
                  <StatusBadge status={fee.status} />
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
                    onClick={() => openPaymentModal(fee)}
                    disabled={!canWriteAcademyData || isPreviewMode || fee.balance === 0}
                    className="rounded-brand bg-primary px-3 py-2 text-sm font-semibold text-bg disabled:opacity-40"
                  >
                    Registrar pago
                  </button>
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void handleMarkReminderSent(fee)}
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
          {feeRows.length === 0 && (
            <div className="rounded-brand border border-slate-800 bg-[#0B0F1A] p-4">
              <p className="text-sm text-text">Todavia no tenes cuotas este mes.</p>
              <p className="mt-2 text-xs text-muted">
                Crea un alumno, asignale una disciplina o genera las cuotas del periodo para empezar a cobrar.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <a href="/app/students" className="rounded-brand bg-primary px-3 py-2 text-center text-xs font-semibold text-bg">
                  Crear alumno
                </a>
                <a href="/app/students" className="rounded-brand border border-secondary/30 px-3 py-2 text-center text-xs text-secondary hover:bg-secondary/10">
                  Asignar disciplina
                </a>
                <button
                  type="button"
                  onClick={() => void handleGenerateCurrentMonthFees()}
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  Generar cuotas
                </button>
              </div>
            </div>
          )}
        </div>

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
              {feeRows.map((fee) => {
                const student = snapshot?.students.find((item) => item.id === fee.studentId);
                const whatsappUrl = buildReminderLink(
                  fee.studentName ?? "Alumno",
                  student?.phone ?? student?.emergencyContactPhone ?? "",
                  fee.concept,
                  fee.balance
                );

                return (
                  <tr key={fee.id} className="border-t border-slate-800">
                    <td className="px-3 py-3 text-muted">{fee.studentName}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-text">{fee.concept}</p>
                      <p className="text-xs text-muted">
                        Periodo {formatPeriodLabel(fee.periodYear, fee.periodMonth)}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-warning">${fee.balance}</td>
                    <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={fee.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openPaymentModal(fee)}
                          disabled={!canWriteAcademyData || isPreviewMode || fee.balance === 0}
                          className="rounded-brand border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
                        >
                          Registrar pago
                        </button>
                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => void handleMarkReminderSent(fee)}
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
              {feeRows.length === 0 && (
                <tr>
                  <td className="px-3 py-6" colSpan={6}>
                    <div className="flex flex-col items-start gap-3 rounded-brand border border-slate-800 bg-[#0B0F1A] p-4">
                      <p className="text-sm text-text">Todavia no tenes cuotas este mes.</p>
                      <p className="text-xs text-muted">
                        Crea un alumno, asignale una disciplina o genera las cuotas del periodo para empezar a cobrar.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a href="/app/students" className="rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-bg">
                          Crear alumno
                        </a>
                        <a href="/app/students" className="rounded-brand border border-secondary/30 px-3 py-2 text-xs text-secondary hover:bg-secondary/10">
                          Asignar disciplina
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleGenerateCurrentMonthFees()}
                          disabled={!canWriteAcademyData || isPreviewMode}
                          className="rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                        >
                          Generar cuotas
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {isModalOpen && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fee-modal-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="fee-modal-title" className="font-display text-lg text-text">
                  Registrar pago
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Registra un pago total o parcial. El saldo y el estado se recalculan en el momento.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleSavePayment(event)} className="grid gap-3 text-sm">
              <div className="grid gap-3 rounded-brand border border-slate-700 bg-bg p-3 md:grid-cols-4">
                <Info label="Total" value={`$${selectedFee.totalAmount}`} />
                <Info label="Pagado" value={`$${selectedFee.amountPaid}`} />
                <Info label="Saldo" value={`$${selectedFee.balance}`} />
                <Info label="Estado" value={formatMembershipStatus(selectedFee.status)} />
              </div>

              <Field label="Monto a registrar" type="number" value={form.amount} onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))} />
              <Field label="Fecha de pago" type="date" value={form.paymentDate} onChange={(value) => setForm((prev) => ({ ...prev, paymentDate: value }))} />
              <label className="grid gap-1">
                Metodo de pago
                <select
                  value={form.paymentMethod}
                  onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value as PaymentMethod }))}
                  className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
                >
                  <option value="cash">{formatPaymentMethod("cash")}</option>
                  <option value="transfer">{formatPaymentMethod("transfer")}</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <TextArea label="Nota" value={form.note} onChange={(value) => setForm((prev) => ({ ...prev, note: value }))} placeholder="Opcional" />

              {formError && <p className="text-xs text-danger">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-brand border border-slate-600 px-3 py-2 text-muted">
                  Cancelar
                </button>
                <button disabled={!canWriteAcademyData || isPreviewMode} className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40">
                  {isPreviewMode ? "Modo demo" : "Guardar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="break-words text-text">{value}</p>
    </div>
  );
}

function Summary({
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

function StatusBadge({ status }: { status: FeeRecord["status"] }) {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text">{value}</p>
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
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={placeholder}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
