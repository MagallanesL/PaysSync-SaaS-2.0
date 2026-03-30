import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { formatBillingType, formatMembershipStatus } from "../../lib/display";
import { db } from "../../lib/firebase";
import {
  type FeeCategory,
  type FeePaymentMode,
  type FeeStatus,
  diffDays,
  getFeeBalance,
  getTodayIso,
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
  amount: string;
  paidAmount: string;
  dueDate: string;
}

const emptyForm: FeeFormState = {
  amount: "",
  paidAmount: "",
  dueDate: ""
};

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultDueDate(period: string) {
  const [year, month] = period.split("-");
  return `${year}-${month}-10`;
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
    const aDays = diffDays(a.dueDate);
    const bDays = diffDays(b.dueDate);
    const aIsDebt = a.balance > 0;
    const bIsDebt = b.balance > 0;
    const aIsOverdueDebt = aDays < 0 && aIsDebt;
    const bIsOverdueDebt = bDays < 0 && bIsDebt;
    const aIsUpcomingDebt = aDays >= 0 && aIsDebt;
    const bIsUpcomingDebt = bDays >= 0 && bIsDebt;

    if (aIsOverdueDebt !== bIsOverdueDebt) return aIsOverdueDebt ? -1 : 1;
    if (aIsUpcomingDebt !== bIsUpcomingDebt) return aIsUpcomingDebt ? -1 : 1;
    if (aDays !== bDays) return aDays - bDays;

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
  });
}

export function FeesPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [form, setForm] = useState<FeeFormState>(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
          const nextDueDate = existing?.dueDate ?? getDefaultDueDate(currentPeriod);

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

  async function loadData() {
    if (isPreviewMode) {
      const previewStudents: StudentOption[] = [
        {
          id: "student-1",
          fullName: "Ana Perez",
          contactPhone: "5491111111111",
          status: "active",
          disciplines: [
            {
              disciplineId: "disc-1",
              name: "Freestyle",
              billingType: "monthly_fee",
              paymentMode: "monthly",
              allowPartial: false,
              price: 20000
            }
          ]
        },
        {
          id: "student-2",
          fullName: "Bruno Diaz",
          contactPhone: "5492222222222",
          status: "active",
          disciplines: [
            {
              disciplineId: "disc-2",
              name: "Indumentaria oficial",
              billingType: "uniform",
              paymentMode: "one_time",
              allowPartial: true,
              price: 18000
            }
          ]
        }
      ];

      const previewFees: Fee[] = sortFees(
        [
          {
            id: "fee-1",
            studentId: "student-1",
            concept: "Cuota mensual 03/2026 - Freestyle",
            category: "monthly_fee",
            disciplineId: "disc-1",
            disciplineName: "Freestyle",
            period: "2026-03",
            observation: "Freestyle",
            amount: 20000,
            paidAmount: 20000,
            balance: 0,
            paymentMode: "monthly",
            partialAllowed: false,
            dueDate: "2026-03-10",
            status: "paid"
          },
          {
            id: "fee-2",
            studentId: "student-2",
            concept: "Indumentaria - Indumentaria oficial",
            category: "uniform",
            disciplineId: "disc-2",
            disciplineName: "Indumentaria oficial",
            observation: "Indumentaria oficial",
            amount: 18000,
            paidAmount: 6000,
            balance: 12000,
            paymentMode: "one_time",
            partialAllowed: true,
            dueDate: "2026-03-08",
            status: "overdue"
          }
        ],
        previewStudents
      );

      setStudents(previewStudents);
      setFees(previewFees);
      return;
    }

    if (!academyPath) return;
    const [studentsSnap, disciplinesSnap, feesSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc"))),
      getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")))
    ]);

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

    const loadedFees: Fee[] = feesSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeFee(docSnap.data() as Omit<Fee, "id">)
    }));

    await syncAssignedFees(loadedStudents, loadedDisciplines, loadedFees);

    const refreshedFeesSnap = await getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")));
    const refreshedFees = refreshedFeesSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeFee(docSnap.data() as Omit<Fee, "id">)
    }));

    setStudents(loadedStudents);
    setFees(sortFees(refreshedFees, loadedStudents));
  }

  useEffect(() => {
    void loadData();
  }, [academyPath, isPreviewMode]);

  useEffect(() => {
    if (!isModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

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
        return {
          ...fee,
          studentName: student?.fullName ?? fee.studentId,
          daysLeft,
          whatsappUrl: buildWhatsAppLink(
            student?.fullName ?? fee.studentId,
            student?.contactPhone ?? "",
            fee.disciplineName ?? fee.concept,
            fee.balance
          )
        };
      })
      .filter((fee) => fee.daysLeft <= 15);
  }, [fees, students]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || !editingFee || isPreviewMode) return;

    const nextAmount = Number(form.amount || 0);
    const nextPaidAmount = normalizePaidAmount(nextAmount, Number(form.paidAmount || 0));

    if (!editingFee.partialAllowed && nextPaidAmount > 0 && nextPaidAmount < nextAmount) {
      setFormError("Esta cuota no permite entregas parciales. Registra 0 o el total completo.");
      return;
    }

    const nextStatus = resolveFeeStatus({
      amount: nextAmount,
      paidAmount: nextPaidAmount,
      dueDate: form.dueDate
    });

    await updateDoc(doc(db, `${academyPath}/fees`, editingFee.id), {
      amount: nextAmount,
      paidAmount: nextPaidAmount,
      dueDate: form.dueDate,
      status: nextStatus,
      updatedAt: serverTimestamp()
    });

    closeModal();
    await loadData();
  }

  function openEditModal(fee: Fee) {
    setEditingFee(fee);
    setForm({
      amount: String(fee.amount),
      paidAmount: String(fee.paidAmount),
      dueDate: fee.dueDate
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingFee(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(false);
  }

  return (
    <>
      <Panel title="Cuotas">
        <div className="mb-4 rounded-brand border border-primary/30 bg-primary/10 p-4 text-sm">
          <p className="font-semibold text-text">Las cuotas se generan desde las disciplinas asignadas a cada alumno.</p>
          <p className="mt-1 text-muted">
            Aqui gestionas total, entregado, saldo, vencimiento y seguimiento. El estado se actualiza solo segun lo que falta cobrar.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Summary label="Vencidas" value={stats.overdue} color="text-danger" />
          <Summary label="Por vencer" value={stats.upcoming} color="text-warning" />
          <Summary label="Parciales" value={stats.partial} color="text-primary" />
          <Summary label="Saldo pendiente" value={`$${stats.pendingBalance}`} color="text-danger" />
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
          <span>En seguimiento: {stats.visible}</span>
          <span>Total de cuotas: {stats.total}</span>
          <span>Orden: mas vencidas primero</span>
        </div>

        <div className="space-y-3 md:hidden">
          {trackingRows.map((fee) => (
            <article key={fee.id} className="rounded-brand border border-slate-800 bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{fee.studentName}</p>
                  <p className="break-words text-sm text-muted">{fee.disciplineName ?? fee.observation ?? fee.concept}</p>
                </div>
                <PriorityBadge daysLeft={fee.daysLeft} />
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
                  className="w-full rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  Gestionar
                </button>
              </div>
            </article>
          ))}
          {trackingRows.length === 0 && (
            <p className="text-sm text-muted">No hay cuotas para seguir dentro de los proximos 15 dias.</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2">Alumno</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Entregado</th>
                <th className="px-3 py-2">Saldo</th>
                <th className="px-3 py-2">Vencimiento</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {trackingRows.map((fee) => {
                return (
                  <tr key={fee.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">
                      <PriorityBadge daysLeft={fee.daysLeft} />
                    </td>
                    <td className="px-3 py-3 text-muted">{fee.studentName}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-text">{fee.disciplineName ?? fee.observation ?? fee.concept}</p>
                      <p className="text-xs text-muted">
                        {fee.period ? `Periodo ${formatPeriodLabel(fee.period)}` : fee.concept}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {fee.paymentMode === "monthly"
                        ? "Mensual"
                        : fee.partialAllowed
                          ? "Entrega parcial"
                          : "Cargo unico"}
                    </td>
                    <td className="px-3 py-3 font-semibold text-primary">${fee.amount}</td>
                    <td className="px-3 py-3 text-secondary">${fee.paidAmount}</td>
                    <td className="px-3 py-3 font-semibold text-warning">${fee.balance}</td>
                    <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={fee.status} />
                    </td>
                    <td className="px-3 py-3">
                      {fee.whatsappUrl ? (
                        <a
                          href={fee.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Enviar WhatsApp a ${fee.studentName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-secondary transition hover:bg-secondary/25"
                        >
                          <WhatsAppIcon />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Sin aviso</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(fee)}
                        disabled={!canWriteAcademyData || isPreviewMode}
                        className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        Gestionar
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
                  Gestionar cuota
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Actualiza vencimiento y lo ya entregado. El estado se calcula automaticamente.
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
                <Info label="Categoria" value={formatBillingType(editingFee.category)} />
                <Info label="Saldo actual" value={`$${editingFee.balance}`} />
                <Info label="Estado actual" value={formatMembershipStatus(editingFee.status)} />
              </div>

              <Field
                label="Monto total"
                type="number"
                value={form.amount}
                onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
              />
              <Field
                label={editingFee.partialAllowed ? "Monto entregado" : "Monto cobrado"}
                type="number"
                value={form.paidAmount}
                onChange={(value) => setForm((prev) => ({ ...prev, paidAmount: value }))}
              />
              <Field
                label="Vencimiento"
                type="date"
                value={form.dueDate}
                onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
              />

              <p className="text-xs text-muted">
                {editingFee.partialAllowed
                  ? "Puedes registrar una entrega parcial o completar el total desde esta misma cuota."
                  : "Esta cuota se resuelve en un solo pago, sin entregas parciales."}
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
                  {isPreviewMode ? "Modo demo" : "Guardar cambios"}
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

function PriorityBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return <span className="rounded-brand bg-danger/15 px-2 py-1 text-xs font-semibold text-danger">Vencida</span>;
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
