<<<<<<< HEAD
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
=======
import { serverTimestamp, updateDoc, doc } from "firebase/firestore";
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
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
<<<<<<< HEAD
  applyBillingSettingsToFee,
  compareFeePriority,
  DEFAULT_ACADEMY_BILLING_SETTINGS,
  type AcademyBillingSettings,
  type FeeCategory,
  type FeePaymentMode,
  type FeeStatus,
  diffDays,
  getDaysOverdue,
  getFeeBalance,
  getTodayIso,
  normalizeAcademyBillingSettings,
  normalizePaidAmount,
  resolveFeeStatus,
  resolvePaymentMode
} from "../../lib/fees";

interface AssignedDiscipline {
  disciplineId: string;
  name: string;
  billingType: FeeCategory;
  paymentMode?: FeePaymentMode;
  allowPartial?: boolean;
  price: number;
}

interface DisciplineCatalogItem extends AssignedDiscipline {
  id: string;
  active: boolean;
}

interface StudentOption {
  id: string;
  fullName: string;
  contactPhone?: string;
  status: "active" | "inactive";
  disciplines?: AssignedDiscipline[];
}

interface Fee {
  id: string;
  studentId: string;
  concept: string;
  category: FeeCategory;
  disciplineId?: string;
  disciplineName?: string;
  period?: string;
  observation?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  paymentMode: FeePaymentMode;
  partialAllowed: boolean;
  dueDate: string;
  status: FeeStatus;
}

interface FeeFormState {
  paidAmount: string;
  paymentState: "none" | "partial" | "full";
}

const emptyForm: FeeFormState = {
  paidAmount: "",
  paymentState: "none"
};

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultDueDateForDay(period: string, dueDay: number) {
  const [year, month] = period.split("-");
  return `${year}-${month}-${String(dueDay).padStart(2, "0")}`;
}

function formatPeriodLabel(period?: string) {
  if (!period) return "-";
  const [year, month] = period.split("-");
  return year && month ? `${month}/${year}` : period;
}

function buildMonthlyConcept(disciplineName: string, period: string) {
  return `Cuota mensual ${formatPeriodLabel(period)} - ${disciplineName}`;
}

function buildSingleChargeConcept(category: FeeCategory, disciplineName: string) {
  return `${formatBillingType(category)} - ${disciplineName}`;
}

function sortFees(fees: Fee[], students: StudentOption[]) {
  const studentNames = new Map(students.map((student) => [student.id, student.fullName]));

  return [...fees].sort((a, b) => {
    const priority = compareFeePriority(a, b);
    if (priority !== 0) return priority;
    const aName = studentNames.get(a.studentId) ?? a.studentId;
    const bName = studentNames.get(b.studentId) ?? b.studentId;
    return aName.localeCompare(bName, "es", { sensitivity: "base" });
  });
}

function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildWhatsAppLink(studentName: string, phone: string, concept: string, balance: number) {
  const normalizedPhone = sanitizePhone(phone);
  if (!normalizedPhone || balance <= 0) return null;

  const message = `Hola ${studentName}, te escribimos desde el centro para recordarte que aun queda un saldo pendiente de $${balance} en ${concept}.`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function normalizeFee(data: Omit<Fee, "id" | "paidAmount" | "balance" | "paymentMode" | "partialAllowed" | "status"> & {
  paidAmount?: number;
  paymentMode?: string;
  partialAllowed?: boolean;
  status?: string;
}): Omit<Fee, "id"> {
  const amount = Number(data.amount || 0);
  const paidAmount = normalizePaidAmount(amount, data.paidAmount ?? (data.status === "paid" ? amount : 0));
  const paymentMode = resolvePaymentMode(data.paymentMode, data.category);
  const partialAllowed = Boolean(data.partialAllowed ?? false);

  return {
    ...data,
    amount,
    paidAmount,
    balance: getFeeBalance(amount, paidAmount),
    paymentMode,
    partialAllowed,
    status: resolveFeeStatus({
      amount,
      paidAmount,
      dueDate: data.dueDate
    })
  };
}

function mergeAssignedDisciplines(
  assigned: AssignedDiscipline[] | undefined,
  catalog: Map<string, DisciplineCatalogItem>
) {
  return (assigned ?? []).map((discipline) => {
    const latest = catalog.get(discipline.disciplineId);
    if (!latest) {
      return {
        ...discipline,
        paymentMode: resolvePaymentMode(discipline.paymentMode, discipline.billingType),
        allowPartial: Boolean(discipline.allowPartial)
      };
    }

    return {
      disciplineId: discipline.disciplineId,
      name: latest.name,
      billingType: latest.billingType,
      paymentMode: latest.paymentMode ?? resolvePaymentMode(undefined, latest.billingType),
      allowPartial: Boolean(latest.allowPartial),
      price: latest.price
    };
=======
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
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
  });
}

export function FeesPage() {
  const { membership, profile, canWriteAcademyData, isPreviewMode } = useAuth();
  const [snapshot, setSnapshot] = useState<AcademyBillingSnapshot | null>(null);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
<<<<<<< HEAD
  const [billingSettings, setBillingSettings] = useState<AcademyBillingSettings>(DEFAULT_ACADEMY_BILLING_SETTINGS);
  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function syncAssignedFees(studentsList: StudentOption[], disciplinesList: DisciplineCatalogItem[], feesList: Fee[]) {
    if (!academyPath || isPreviewMode) return;

    const currentPeriod = getCurrentPeriod();
    const monthlyByKey = new Map<string, Fee>(
      feesList
        .filter((fee) => fee.paymentMode === "monthly" && fee.period === currentPeriod)
        .map((fee) => [`${fee.studentId}-${fee.disciplineId ?? "none"}-${currentPeriod}`, fee] as const)
    );
    const singleChargeByKey = new Map<string, Fee[]>();

    for (const fee of feesList.filter((item) => item.paymentMode === "one_time")) {
      const key = `${fee.studentId}-${fee.disciplineId ?? "none"}`;
      singleChargeByKey.set(key, [...(singleChargeByKey.get(key) ?? []), fee]);
    }

    const disciplineCatalog = new Map(disciplinesList.map((discipline) => [discipline.id, discipline]));

    for (const student of studentsList.filter((item) => item.status === "active")) {
      const assignedDisciplines = mergeAssignedDisciplines(student.disciplines, disciplineCatalog);

      for (const discipline of assignedDisciplines) {
        const paymentMode = resolvePaymentMode(discipline.paymentMode, discipline.billingType);
        const partialAllowed = Boolean(discipline.allowPartial);

        if (paymentMode === "monthly") {
          const key = `${student.id}-${discipline.disciplineId}-${currentPeriod}`;
          const existing = monthlyByKey.get(key);
          const nextConcept = buildMonthlyConcept(discipline.name, currentPeriod);
          const nextDueDate = existing?.dueDate ?? getDefaultDueDateForDay(currentPeriod, billingSettings.defaultDueDay);

          if (!existing) {
            await addDoc(collection(db, `${academyPath}/fees`), {
              studentId: student.id,
              disciplineId: discipline.disciplineId,
              disciplineName: discipline.name,
              category: discipline.billingType,
              paymentMode,
              partialAllowed,
              period: currentPeriod,
              observation: discipline.name,
              concept: nextConcept,
              amount: discipline.price,
              paidAmount: 0,
              dueDate: nextDueDate,
              status: "pending",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            continue;
          }

          const shouldRefresh =
            existing.amount !== discipline.price ||
            existing.disciplineName !== discipline.name ||
            existing.partialAllowed !== partialAllowed ||
            existing.paymentMode !== paymentMode ||
            existing.category !== discipline.billingType ||
            existing.concept !== nextConcept;

          if (shouldRefresh && existing.status !== "paid") {
            await updateDoc(doc(db, `${academyPath}/fees`, existing.id), {
              disciplineName: discipline.name,
              observation: discipline.name,
              category: discipline.billingType,
              paymentMode,
              partialAllowed,
              concept: nextConcept,
              amount: discipline.price,
              status: resolveFeeStatus({
                amount: discipline.price,
                paidAmount: existing.paidAmount,
                dueDate: existing.dueDate
              }),
              updatedAt: serverTimestamp()
            });
          }

          continue;
        }

        const key = `${student.id}-${discipline.disciplineId}`;
        const existingSingleCharge = (singleChargeByKey.get(key) ?? []).find((fee) => fee.period == null);
        const nextConcept = buildSingleChargeConcept(discipline.billingType, discipline.name);

        if (!existingSingleCharge) {
          await addDoc(collection(db, `${academyPath}/fees`), {
            studentId: student.id,
            disciplineId: discipline.disciplineId,
            disciplineName: discipline.name,
            category: discipline.billingType,
            paymentMode,
            partialAllowed,
            observation: discipline.name,
            concept: nextConcept,
            amount: discipline.price,
            paidAmount: 0,
            dueDate: getTodayIso(),
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          continue;
        }

        const shouldRefresh =
          existingSingleCharge.amount !== discipline.price ||
          existingSingleCharge.disciplineName !== discipline.name ||
          existingSingleCharge.partialAllowed !== partialAllowed ||
          existingSingleCharge.paymentMode !== paymentMode ||
          existingSingleCharge.category !== discipline.billingType ||
          existingSingleCharge.concept !== nextConcept;

        if (shouldRefresh && existingSingleCharge.status !== "paid") {
          await updateDoc(doc(db, `${academyPath}/fees`, existingSingleCharge.id), {
            disciplineName: discipline.name,
            observation: discipline.name,
            category: discipline.billingType,
            paymentMode,
            partialAllowed,
            concept: nextConcept,
            amount: discipline.price,
            status: resolveFeeStatus({
              amount: discipline.price,
              paidAmount: existingSingleCharge.paidAmount,
              dueDate: existingSingleCharge.dueDate
            }),
            updatedAt: serverTimestamp()
          });
        }
      }
    }
  }
=======
  const [isModalOpen, setIsModalOpen] = useState(false);
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d

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
<<<<<<< HEAD
        previewStudents
      );

      setStudents(previewStudents);
      setFees(previewFees);
      setBillingSettings({
        defaultDueDay: 10,
        lateFeeEnabled: true,
        lateFeeStartsAfterDays: 3,
        lateFeeType: "fixed",
        lateFeeValue: 2500
=======
        payments: []
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
      });
      return;
    }

<<<<<<< HEAD
    if (!academyPath) return;
    const [academySnap, studentsSnap, disciplinesSnap, feesSnap] = await Promise.all([
      getDoc(doc(db, "academies", membership!.academyId)),
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")))
    ]);
    const nextBillingSettings = normalizeAcademyBillingSettings(academySnap.exists() ? academySnap.data().billingSettings : undefined);
    setBillingSettings(nextBillingSettings);

    const loadedDisciplines: DisciplineCatalogItem[] = disciplinesSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      disciplineId: docSnap.id,
      name: String(docSnap.data().name ?? ""),
      billingType: (docSnap.data().billingType as FeeCategory | undefined) ?? "other",
      paymentMode: resolvePaymentMode(docSnap.data().paymentMode as string | undefined, docSnap.data().billingType as FeeCategory | undefined),
      allowPartial: Boolean(docSnap.data().allowPartial ?? false),
      price: Number(docSnap.data().price ?? 0),
      active: Boolean(docSnap.data().active ?? true)
    }));

    const disciplineCatalog = new Map(loadedDisciplines.map((discipline) => [discipline.id, discipline]));
    const loadedStudents: StudentOption[] = studentsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      fullName: String(docSnap.data().fullName ?? "Alumno"),
      contactPhone: String(docSnap.data().contactPhone ?? docSnap.data().phone ?? ""),
      status: (docSnap.data().status as StudentOption["status"]) ?? "active",
      disciplines: mergeAssignedDisciplines(
        (docSnap.data().disciplines as AssignedDiscipline[] | undefined) ?? [],
        disciplineCatalog
      )
    }));

    const loadedFeesBase: Fee[] = feesSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeFee(docSnap.data() as Omit<Fee, "id">)
    }));

    await syncAssignedFees(loadedStudents, loadedDisciplines, loadedFeesBase);

    const refreshedFeesSnap = await getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")));
    const refreshedFees = refreshedFeesSnap.docs.map((docSnap) => {
      const normalizedFee = normalizeFee(docSnap.data() as Omit<Fee, "id">);
      return {
        id: docSnap.id,
        ...applyBillingSettingsToFee(normalizedFee, nextBillingSettings)
      };
    });

    setStudents(loadedStudents);
    setFees(sortFees(refreshedFees, loadedStudents));
=======
    if (!membership) return;
    const billingSnapshot = await loadAcademyBillingSnapshot(membership.academyId, { includePayments: false });
    setSnapshot(billingSnapshot);
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
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

<<<<<<< HEAD
  const stats = useMemo(() => {
    const upcomingWindow = fees.filter((fee) => diffDays(fee.dueDate) <= 15);
    return {
      visible: upcomingWindow.length,
      total: fees.length,
      partial: fees.filter((fee) => fee.status === "partial").length,
      overdue: fees.filter((fee) => fee.balance > 0 && diffDays(fee.dueDate) < 0).length,
      upcoming: fees.filter((fee) => fee.balance > 0 && diffDays(fee.dueDate) >= 0 && diffDays(fee.dueDate) <= 15).length,
      pendingBalance: fees.reduce((sum, fee) => sum + fee.balance, 0)
    };
  }, [fees]);

  const trackingRows = useMemo(() => {
    return fees
      .map((fee) => {
        const student = students.find((item) => item.id === fee.studentId);
        const daysLeft = diffDays(fee.dueDate);
        const daysOverdue = getDaysOverdue(fee.dueDate);
        return {
          ...fee,
          studentName: student?.fullName ?? fee.studentId,
          daysLeft,
          daysOverdue,
          whatsappUrl: buildWhatsAppLink(
            student?.fullName ?? fee.studentId,
            student?.contactPhone ?? "",
            fee.disciplineName ?? fee.concept,
            fee.balance
          )
        };
=======
  const currentPeriod = getCurrentPeriodParts();
  const feeRows = useMemo(() => {
    if (!snapshot) return [];
    const activeStudentIds = new Set(snapshot.students.filter((student) => student.status === "active").map((student) => student.id));
    return sortFees(
      snapshot.fees.filter((fee) => {
        const belongsToActiveStudent = activeStudentIds.has(fee.studentId);
        const isCurrentPeriod = fee.periodYear === currentPeriod.year && fee.periodMonth === currentPeriod.month;
        return belongsToActiveStudent && isCurrentPeriod;
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
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

<<<<<<< HEAD
    const nextAmount = editingFee.amount;
    const nextPaidAmount =
      form.paymentState === "full"
        ? nextAmount
        : form.paymentState === "partial"
          ? normalizePaidAmount(nextAmount, Number(form.paidAmount || 0))
          : 0;

    if (form.paymentState === "partial" && !editingFee.partialAllowed) {
      setFormError("Esta cuota no permite pagos parciales. Marca pago total o no pago.");
      return;
    }

    if (form.paymentState === "partial" && nextPaidAmount <= 0) {
      setFormError("Ingresa un monto parcial mayor a 0.");
      return;
    }

    if (!editingFee.partialAllowed && nextPaidAmount > 0 && nextPaidAmount < nextAmount) {
      setFormError("Esta cuota no permite entregas parciales. Registra 0 o el total completo.");
      return;
    }

    const nextStatus = resolveFeeStatus({
      amount: nextAmount,
      paidAmount: nextPaidAmount,
      dueDate: editingFee.dueDate
    });

    await updateDoc(doc(db, `${academyPath}/fees`, editingFee.id), {
      paidAmount: nextPaidAmount,
      status: nextStatus,
      updatedAt: serverTimestamp()
    });

    closeModal();
=======
  async function handleGenerateCurrentMonthFees() {
    if (!membership || isPreviewMode) return;
    await generateMonthlyFeesForCenter(membership.academyId);
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
    await loadData();
  }

  function openPaymentModal(fee: FeeRecord) {
    setSelectedFee(fee);
    setForm({
<<<<<<< HEAD
      paidAmount: fee.paidAmount > 0 && fee.paidAmount < fee.amount ? String(fee.paidAmount) : "",
      paymentState: fee.paidAmount >= fee.amount ? "full" : fee.paidAmount > 0 ? "partial" : "none"
=======
      amount: String(fee.balance || fee.totalAmount),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      note: ""
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
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

<<<<<<< HEAD
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
          <span>En seguimiento: {stats.visible}</span>
          <span>Total de cuotas: {stats.total}</span>
          <span>Orden: mas dias de mora primero</span>
        </div>

        <div className="space-y-3 xl:hidden">
          {trackingRows.map((fee) => (
            <article key={fee.id} className="rounded-brand border border-slate-800 bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{fee.studentName}</p>
                  <p className="break-words text-sm text-muted">{fee.disciplineName ?? fee.observation ?? fee.concept}</p>
                </div>
                <PriorityBadge daysLeft={fee.daysLeft} daysOverdue={fee.daysOverdue} />
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted">
                <MobileInfo
                  label="Modalidad"
                  value={
                    fee.paymentMode === "monthly"
                      ? "Mensual"
                      : fee.partialAllowed
                        ? "Entrega parcial"
                        : "Cargo unico"
                  }
                />
                <MobileInfo label="Periodo" value={fee.period ? formatPeriodLabel(fee.period) : fee.concept} />
                <MobileInfo label="Vencimiento" value={fee.dueDate} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Summary label="Total" value={`$${fee.amount}`} color="text-primary" />
                <Summary label="Entregado" value={`$${fee.paidAmount}`} color="text-secondary" />
                <Summary label="Saldo" value={`$${fee.balance}`} color="text-warning" />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Estado</p>
                  <StatusBadge status={fee.status} />
                </div>
                {fee.whatsappUrl ? (
                  <a
                    href={fee.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Enviar WhatsApp a ${fee.studentName}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-brand bg-secondary/15 px-3 py-2 text-sm font-medium text-secondary transition hover:bg-secondary/25"
                  >
                    <WhatsAppIcon />
                    Avisar por WhatsApp
                  </a>
                ) : (
                  <p className="text-sm text-muted">Sin aviso disponible</p>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(fee)}
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="w-full rounded-brand bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-bg disabled:opacity-40"
                >
                  Registrar pago
                </button>
              </div>
            </article>
          ))}
          {trackingRows.length === 0 && (
            <p className="text-sm text-muted">No hay cuotas para seguir dentro de los proximos 15 dias.</p>
          )}
        </div>
        <div className="hidden xl:block">
          <table className="min-w-full table-fixed text-xs 2xl:text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="w-[10%] px-2 py-2">Prioridad</th>
                <th className="w-[12%] px-2 py-2">Alumno</th>
                <th className="w-[20%] px-2 py-2">Concepto</th>
                <th className="w-[9%] px-2 py-2">Modalidad</th>
                <th className="w-[8%] px-2 py-2">Total</th>
                <th className="w-[8%] px-2 py-2">Entregado</th>
                <th className="w-[8%] px-2 py-2">Saldo</th>
                <th className="w-[9%] px-2 py-2">Vencimiento</th>
                <th className="w-[7%] px-2 py-2">Estado</th>
                <th className="w-[4%] px-2 py-2 text-center">WhatsApp</th>
                <th className="w-[5%] px-2 py-2 text-right">Accion</th>
              </tr>
            </thead>
            <tbody>
              {trackingRows.map((fee) => {
                return (
                  <tr key={fee.id} className="border-t border-slate-800">
                    <td className="px-2 py-3 align-top">
                      <PriorityBadge daysLeft={fee.daysLeft} daysOverdue={fee.daysOverdue} />
                    </td>
                    <td className="px-2 py-3 align-top text-muted">{fee.studentName}</td>
                    <td className="px-2 py-3 align-top">
                      <p className="font-medium text-text">{fee.disciplineName ?? fee.observation ?? fee.concept}</p>
                      <p className="text-xs text-muted">
                        {fee.period ? `Periodo ${formatPeriodLabel(fee.period)}` : fee.concept}
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top text-muted">
                      {fee.paymentMode === "monthly"
                        ? "Mensual"
                        : fee.partialAllowed
                          ? "Entrega parcial"
                          : "Cargo unico"}
                    </td>
                    <td className="px-2 py-3 align-top font-semibold text-primary">${fee.amount}</td>
                    <td className="px-2 py-3 align-top text-secondary">${fee.paidAmount}</td>
                    <td className="px-2 py-3 align-top font-semibold text-warning">${fee.balance}</td>
                    <td className="px-2 py-3 align-top text-muted">{fee.dueDate}</td>
                    <td className="px-2 py-3 align-top">
                      <StatusBadge status={fee.status} />
                    </td>
                    <td className="px-2 py-3 align-top text-center">
                      {fee.whatsappUrl ? (
                        <a
                          href={fee.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Enviar WhatsApp a ${fee.studentName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/15 text-secondary transition hover:bg-secondary/25"
                        >
                          <WhatsAppIcon />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Sin aviso</span>
                      )}
                    </td>
                    <td className="px-2 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(fee)}
                        disabled={!canWriteAcademyData || isPreviewMode}
                        className="rounded-brand bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-bg disabled:opacity-40"
                      >
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                );
              })}
              {trackingRows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted" colSpan={11}>
                    No hay cuotas para seguir dentro de los proximos 15 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {isModalOpen && editingFee && (
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
                  Marca si no pago, si pago parcial o si ya pago el total. El resumen se actualiza automaticamente.
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

            <form onSubmit={(event) => void handleSave(event)} className="grid gap-3 text-sm">
              <div className="grid gap-3 rounded-brand border border-slate-700 bg-bg p-3 md:grid-cols-3">
                <Info label="Total cuota" value={`$${editingFee.amount}`} />
                <Info label="Ya abonado" value={`$${editingFee.paidAmount}`} />
                <Info label="Saldo actual" value={`$${editingFee.balance}`} />
              </div>

              <div className="grid gap-2 rounded-brand border border-slate-700 bg-bg p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Estado del pago</p>
                <label className="flex items-center gap-2 text-text">
                  <input
                    type="radio"
                    name="paymentState"
                    checked={form.paymentState === "none"}
                    onChange={() => setForm((prev) => ({ ...prev, paymentState: "none", paidAmount: "" }))}
                  />
                  No pago
                </label>
                <label className={`flex items-center gap-2 ${editingFee.partialAllowed ? "text-text" : "text-muted"}`}>
                  <input
                    type="radio"
                    name="paymentState"
                    checked={form.paymentState === "partial"}
                    disabled={!editingFee.partialAllowed}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        paymentState: "partial",
                        paidAmount: prev.paidAmount || String(editingFee.paidAmount > 0 ? editingFee.paidAmount : "")
                      }))
                    }
                  />
                  Pago parcial
                </label>
                <label className="flex items-center gap-2 text-text">
                  <input
                    type="radio"
                    name="paymentState"
                    checked={form.paymentState === "full"}
                    onChange={() => setForm((prev) => ({ ...prev, paymentState: "full", paidAmount: String(editingFee.amount) }))}
                  />
                  Pago total
                </label>
              </div>

              {form.paymentState === "partial" && (
                <Field
                  label="Monto abonado"
                  type="number"
                  value={form.paidAmount}
                  onChange={(value) => setForm((prev) => ({ ...prev, paidAmount: value }))}
                />
              )}

              <p className="text-xs text-muted">
                {editingFee.partialAllowed
                  ? "Si eliges pago parcial, ingresa el monto acumulado abonado para esta cuota."
                  : "Esta cuota solo admite no pago o pago total."}
              </p>

              {formError && <p className="text-xs text-danger">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-brand border border-slate-600 px-3 py-2 text-muted"
                >
                  Cancelar
                </button>
                <button
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40"
                >
                  Guardar cambios
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

function Summary({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-brand border border-slate-700 bg-bg p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: FeeStatus }) {
  return (
    <span
      className={`rounded-brand px-2 py-1 text-xs font-semibold ${
        status === "paid"
          ? "bg-secondary/15 text-secondary"
          : status === "partial"
            ? "bg-primary/15 text-primary"
            : status === "overdue"
              ? "bg-danger/15 text-danger"
              : "bg-warning/15 text-warning"
      }`}
    >
      {formatMembershipStatus(status)}
    </span>
  );
}

function PriorityBadge({ daysLeft, daysOverdue }: { daysLeft: number; daysOverdue: number }) {
  if (daysOverdue > 0) {
    return <span className="rounded-brand bg-danger/15 px-2 py-1 text-xs font-semibold text-danger">{daysOverdue} dia{daysOverdue === 1 ? "" : "s"} de mora</span>;
  }
  if (daysLeft === 0) {
    return <span className="rounded-brand bg-danger/15 px-2 py-1 text-xs font-semibold text-danger">Vence hoy</span>;
  }
  if (daysLeft <= 3) {
    return <span className="rounded-brand bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">{daysLeft} dias</span>;
  }
  return <span className="rounded-brand bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">{daysLeft} dias</span>;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M19.05 4.94A9.9 9.9 0 0 0 12.03 2C6.56 2 2.1 6.46 2.1 11.93c0 1.75.46 3.47 1.34 4.98L2 22l5.24-1.37a9.92 9.92 0 0 0 4.78 1.22h.01c5.47 0 9.93-4.46 9.93-9.93a9.86 9.86 0 0 0-2.91-6.98Zm-7.02 15.23h-.01a8.3 8.3 0 0 1-4.22-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.23 8.23 0 0 1-1.27-4.39c0-4.56 3.71-8.27 8.28-8.27 2.2 0 4.27.85 5.83 2.42a8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.25 8.25Zm4.54-6.19c-.25-.13-1.47-.72-1.7-.8-.23-.09-.39-.13-.56.12-.16.25-.64.79-.78.95-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.36-1.71-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.42h-.48c-.17 0-.43.06-.65.31-.23.25-.87.85-.87 2.07 0 1.22.9 2.39 1.02 2.56.12.17 1.76 2.68 4.25 3.76.59.26 1.06.42 1.42.54.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.17.21-.58.21-1.07.15-1.17-.06-.1-.22-.16-.46-.29Z" />
    </svg>
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
  type = "text",
  required = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
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
        required={required}
      />
    </label>
  );
}
=======
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
>>>>>>> 9718ee6041c9a04af9bc6e63bfefc204bb2b073d
