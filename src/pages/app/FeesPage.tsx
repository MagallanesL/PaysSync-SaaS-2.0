import { serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FeesMobileList,
  FeesSummaryCard,
  FeesTable
} from "../../components/app/fees/FeeUI";
import { PaymentModal, type PaymentFormState } from "../../components/app/fees/PaymentModal";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import {
  formatPeriodLabel,
  generateMonthlyFeesForCenter,
  getCurrentPeriodParts,
  getFeePriorityWindow,
  loadAcademyBillingSnapshot,
  registerPayment,
  type AcademyBillingSnapshot,
  type FeeRecord
} from "../../lib/academyBilling";
import { db } from "../../lib/firebase";

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
    const billingSnapshot = await loadAcademyBillingSnapshot(membership.academyId, { includePayments: false });
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
          <FeesSummaryCard label="Saldo pendiente" value={`$${stats.pendingBalance}`} color="text-[#FF4D4F]" helper="Dinero por cobrar" featured />
          <FeesSummaryCard label="Vencidas" value={stats.overdue} color="text-[#FF4D4F]" helper="Requieren seguimiento" />
          <FeesSummaryCard label="Por vencer" value={stats.upcoming} color="text-[#F59E0B]" helper="Vencen pronto" />
          <FeesSummaryCard label="Parciales" value={stats.partial} color="text-[#00D1FF]" helper="Cobros incompletos" />
        </div>

        <FeesMobileList
          fees={feeRows}
          snapshot={snapshot}
          canWrite={canWriteAcademyData}
          isPreviewMode={isPreviewMode}
          onRegisterPayment={openPaymentModal}
          onReminderClick={(fee) => void handleMarkReminderSent(fee)}
          onGenerateFees={() => void handleGenerateCurrentMonthFees()}
        />

        <FeesTable
          fees={feeRows}
          snapshot={snapshot}
          canWrite={canWriteAcademyData}
          isPreviewMode={isPreviewMode}
          onRegisterPayment={openPaymentModal}
          onReminderClick={(fee) => void handleMarkReminderSent(fee)}
          onGenerateFees={() => void handleGenerateCurrentMonthFees()}
          formatPeriodLabel={formatPeriodLabel}
        />
      </Panel>

      <PaymentModal
        isOpen={isModalOpen}
        fee={selectedFee}
        form={form}
        formError={formError}
        canWrite={canWriteAcademyData}
        isPreviewMode={isPreviewMode}
        onClose={closeModal}
        onSubmit={(event) => void handleSavePayment(event)}
        onFormChange={setForm}
      />
    </>
  );
}
