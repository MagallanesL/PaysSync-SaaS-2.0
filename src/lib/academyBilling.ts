import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { diffDays, normalizePaidAmount, resolveFeeStatus, resolvePaymentMode, type FeeCategory, type FeePaymentMode, type FeeStatus } from "./fees";

export type BillingType = "monthly" | "weekly" | "one_time" | "custom";
export type ReminderStatus = "not_sent" | "sent" | "not_needed";
export type PaymentMethod = "cash" | "transfer" | "other";
export type StudentStatus = "active" | "inactive";

export interface AssignedDisciplineSnapshot {
  disciplineId: string;
  name: string;
  billingType: FeeCategory;
  paymentMode?: FeePaymentMode;
  allowPartial?: boolean;
  price: number;
}

export interface StudentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  status: StudentStatus;
  disciplines: AssignedDisciplineSnapshot[];
}

export interface DisciplineRecord {
  id: string;
  centerId: string;
  name: string;
  category: FeeCategory;
  modality: string;
  baseAmount: number;
  billingType: BillingType;
  active: boolean;
  allowPartial: boolean;
  note: string;
}

export interface EnrollmentRecord {
  id: string;
  centerId: string;
  studentId: string;
  disciplineId: string;
  startDate: string;
  active: boolean;
  customAmount?: number;
  billingDay?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FeeRecord {
  id: string;
  centerId: string;
  studentId: string;
  disciplineId: string;
  enrollmentId: string;
  concept: string;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  originalAmount: number;
  amountPaid: number;
  balance: number;
  status: FeeStatus;
  lateFeeAmount: number;
  totalAmount: number;
  reminderStatus: ReminderStatus;
  reminderSentAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  studentName?: string;
  disciplineName?: string;
  paymentMode: FeePaymentMode;
  partialAllowed: boolean;
}

export interface PaymentRecord {
  id: string;
  centerId: string;
  feeId: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note: string;
  createdAt?: unknown;
  createdBy?: string;
}

export interface AcademyBillingSnapshot {
  defaultBillingDay: number;
  students: StudentRecord[];
  disciplines: DisciplineRecord[];
  enrollments: EnrollmentRecord[];
  fees: FeeRecord[];
  payments: PaymentRecord[];
}

interface LoadAcademyBillingSnapshotOptions {
  includePayments?: boolean;
}

export function normalizeMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

export function getCurrentPeriodParts(baseDate = new Date()) {
  return {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth() + 1
  };
}

export function getCurrentPeriodKey(baseDate = new Date()) {
  const { year, month } = getCurrentPeriodParts(baseDate);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatPeriodLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function getFeeDocId(enrollmentId: string, year: number, month: number) {
  return `${enrollmentId}_${year}_${String(month).padStart(2, "0")}`;
}

export function buildMonthlyFeeConcept(disciplineName: string, year: number, month: number) {
  return `${disciplineName} - ${formatPeriodLabel(year, month)}`;
}

export function clampBillingDay(day?: number | null) {
  if (!day || !Number.isFinite(day)) return 10;
  return Math.min(28, Math.max(1, Math.round(day)));
}

export function resolveAcademyDefaultBillingDay(rawAcademyData?: Record<string, unknown>) {
  const operations = rawAcademyData?.operations as Record<string, unknown> | undefined;
  return clampBillingDay(Number(operations?.defaultBillingDay ?? 10));
}

export function resolveEnrollmentBillingDay(enrollment: Pick<EnrollmentRecord, "billingDay">, defaultBillingDay: number) {
  return clampBillingDay(enrollment.billingDay ?? defaultBillingDay);
}

export function buildDueDateForPeriod(year: number, month: number, billingDay: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(clampBillingDay(billingDay)).padStart(2, "0")}`;
}

export function resolveFeeAmounts(originalAmount: number, lateFeeAmount: number, amountPaid: number) {
  const normalizedOriginalAmount = normalizeMoney(originalAmount);
  const normalizedLateFee = normalizeMoney(lateFeeAmount);
  const totalAmount = normalizedOriginalAmount + normalizedLateFee;
  const normalizedPaid = normalizePaidAmount(totalAmount, amountPaid);
  const balance = Math.max(0, totalAmount - normalizedPaid);

  return {
    originalAmount: normalizedOriginalAmount,
    lateFeeAmount: normalizedLateFee,
    totalAmount,
    amountPaid: normalizedPaid,
    balance
  };
}

export function normalizeFeeRecord(
  id: string,
  data: Record<string, unknown>,
  studentNameById: Map<string, string>,
  disciplineNameById: Map<string, string>
): FeeRecord {
  const periodYear = Number(data.periodYear ?? 0);
  const periodMonth = Number(data.periodMonth ?? 0);
  const amounts = resolveFeeAmounts(
    Number(data.originalAmount ?? data.amount ?? 0),
    Number(data.lateFeeAmount ?? 0),
    Number(data.amountPaid ?? data.paidAmount ?? 0)
  );

  return {
    id,
    centerId: String(data.centerId ?? ""),
    studentId: String(data.studentId ?? ""),
    disciplineId: String(data.disciplineId ?? ""),
    enrollmentId: String(data.enrollmentId ?? ""),
    concept: String(data.concept ?? ""),
    periodYear,
    periodMonth,
    dueDate: String(data.dueDate ?? ""),
    originalAmount: amounts.originalAmount,
    amountPaid: amounts.amountPaid,
    balance: amounts.balance,
    lateFeeAmount: amounts.lateFeeAmount,
    totalAmount: amounts.totalAmount,
    status: resolveFeeStatus({
      amount: amounts.totalAmount,
      paidAmount: amounts.amountPaid,
      dueDate: String(data.dueDate ?? "")
    }),
    reminderStatus: (data.reminderStatus as ReminderStatus | undefined) ?? "not_sent",
    reminderSentAt: data.reminderSentAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    studentName: String(data.studentName ?? studentNameById.get(String(data.studentId ?? "")) ?? ""),
    disciplineName: String(data.disciplineName ?? disciplineNameById.get(String(data.disciplineId ?? "")) ?? ""),
    paymentMode: resolvePaymentMode(data.paymentMode as string | undefined, data.category as FeeCategory | undefined),
    partialAllowed: Boolean(data.partialAllowed ?? false)
  };
}

export function buildReminderMessage(studentName: string, concept: string, balance: number) {
  return `Hola ${studentName}, te recordamos que tenes un saldo pendiente de $${balance} correspondiente a ${concept}.`;
}

export function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildReminderLink(studentName: string, phone: string, concept: string, balance: number) {
  const normalizedPhone = sanitizePhone(phone);
  if (!normalizedPhone || balance <= 0) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(buildReminderMessage(studentName, concept, balance))}`;
}

export async function loadAcademyBillingSnapshot(
  academyId: string,
  options: LoadAcademyBillingSnapshotOptions = {}
): Promise<AcademyBillingSnapshot> {
  const academyPath = `academies/${academyId}`;
  const includePayments = options.includePayments ?? true;
  const [academySnap, studentsSnap, disciplinesSnap, enrollmentsSnap, feesSnap, paymentsSnap] = await Promise.all([
    getDoc(doc(db, "academies", academyId)),
    getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
    getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc"))),
    getDocs(collection(db, `${academyPath}/enrollments`)),
    getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc"))),
    includePayments
      ? getDocs(query(collection(db, `${academyPath}/payments`), orderBy("paymentDate", "desc")))
      : Promise.resolve(null)
  ]);

  const defaultBillingDay = resolveAcademyDefaultBillingDay(
    academySnap.exists() ? (academySnap.data() as Record<string, unknown>) : undefined
  );

  const disciplines = disciplinesSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      centerId: academyId,
      name: String(data.name ?? ""),
      category: (data.category as FeeCategory | undefined) ?? (data.billingType as FeeCategory | undefined) ?? "monthly_fee",
      modality: String(data.modality ?? data.note ?? ""),
      baseAmount: normalizeMoney(data.baseAmount ?? data.price ?? 0),
      billingType: (data.feeBillingType as BillingType | undefined) ?? "monthly",
      active: Boolean(data.active ?? true),
      allowPartial: Boolean(data.allowPartial ?? false),
      note: String(data.note ?? "")
    } satisfies DisciplineRecord;
  });

  const disciplineById = new Map(disciplines.map((discipline) => [discipline.id, discipline]));

  const students = studentsSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      fullName: String(data.fullName ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      emergencyContactName: String(data.emergencyContactName ?? ""),
      emergencyContactPhone: String(data.emergencyContactPhone ?? data.contactPhone ?? ""),
      allergies: String(data.allergies ?? ""),
      status: (data.status as StudentStatus | undefined) ?? "active",
      disciplines: ((data.disciplines as AssignedDisciplineSnapshot[] | undefined) ?? []).map((discipline) => ({
        ...discipline,
        paymentMode: resolvePaymentMode(discipline.paymentMode, discipline.billingType)
      }))
    } satisfies StudentRecord;
  });

  const studentById = new Map(students.map((student) => [student.id, student]));
  const studentNameById = new Map(students.map((student) => [student.id, student.fullName]));
  const disciplineNameById = new Map(disciplines.map((discipline) => [discipline.id, discipline.name]));

  const enrollments = enrollmentsSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      centerId: String(data.centerId ?? academyId),
      studentId: String(data.studentId ?? ""),
      disciplineId: String(data.disciplineId ?? ""),
      startDate: String(data.startDate ?? ""),
      active: Boolean(data.active ?? true),
      customAmount: data.customAmount != null ? normalizeMoney(data.customAmount) : undefined,
      billingDay: data.billingDay != null ? clampBillingDay(Number(data.billingDay)) : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    } satisfies EnrollmentRecord;
  });

  for (const student of students) {
    const hasSnapshot = student.disciplines.length > 0;
    if (hasSnapshot) continue;

    student.disciplines = enrollments
      .filter((enrollment) => enrollment.studentId === student.id && enrollment.active)
      .map((enrollment) => {
        const discipline = disciplineById.get(enrollment.disciplineId);
        return {
          disciplineId: enrollment.disciplineId,
          name: discipline?.name ?? "Disciplina",
          billingType: discipline?.category ?? "monthly_fee",
          paymentMode: "monthly",
          allowPartial: Boolean(discipline?.allowPartial ?? false),
          price: enrollment.customAmount ?? discipline?.baseAmount ?? 0
        };
      });
  }

  const fees = feesSnap.docs.map((docSnap) =>
    normalizeFeeRecord(docSnap.id, docSnap.data() as Record<string, unknown>, studentNameById, disciplineNameById)
  );

  const payments = paymentsSnap?.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      centerId: String(data.centerId ?? academyId),
      feeId: String(data.feeId ?? ""),
      studentId: String(data.studentId ?? ""),
      amount: normalizeMoney(data.amount),
      paymentDate: String(data.paymentDate ?? ""),
      paymentMethod: (data.paymentMethod as PaymentMethod | undefined) ?? "other",
      note: String(data.note ?? ""),
      createdAt: data.createdAt,
      createdBy: String(data.createdBy ?? "")
    } satisfies PaymentRecord;
  }) ?? [];

  void studentById;

  return {
    defaultBillingDay,
    students,
    disciplines,
    enrollments,
    fees,
    payments
  };
}

export async function generateFeeForEnrollmentPeriod(params: {
  academyId: string;
  enrollment: EnrollmentRecord;
  discipline: DisciplineRecord;
  studentName: string;
  periodYear: number;
  periodMonth: number;
  defaultBillingDay: number;
}) {
  const { academyId, enrollment, discipline, studentName, periodYear, periodMonth, defaultBillingDay } = params;
  const feeId = getFeeDocId(enrollment.id, periodYear, periodMonth);
  const feeRef = doc(db, `academies/${academyId}/fees`, feeId);
  const existingFeeSnap = await getDoc(feeRef);
  if (existingFeeSnap.exists()) {
    return existingFeeSnap.id;
  }

  const originalAmount = enrollment.customAmount ?? discipline.baseAmount;
  const dueDate = buildDueDateForPeriod(
    periodYear,
    periodMonth,
    resolveEnrollmentBillingDay(enrollment, defaultBillingDay)
  );
  const concept = buildMonthlyFeeConcept(discipline.name, periodYear, periodMonth);

  await setDoc(feeRef, {
    centerId: academyId,
    studentId: enrollment.studentId,
    studentName,
    disciplineId: enrollment.disciplineId,
    disciplineName: discipline.name,
    enrollmentId: enrollment.id,
    concept,
    periodYear,
    periodMonth,
    dueDate,
    originalAmount,
    amountPaid: 0,
    balance: originalAmount,
    lateFeeAmount: 0,
    totalAmount: originalAmount,
    reminderStatus: "not_sent",
    paymentMode: "monthly",
    partialAllowed: Boolean(discipline.allowPartial),
    category: discipline.category,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return feeId;
}

export async function generateMonthlyFeesForCenter(academyId: string, baseDate = new Date()) {
  const snapshot = await loadAcademyBillingSnapshot(academyId);
  const { year, month } = getCurrentPeriodParts(baseDate);
  const activeStudents = new Map(
    snapshot.students.filter((student) => student.status === "active").map((student) => [student.id, student])
  );
  const disciplineById = new Map(snapshot.disciplines.map((discipline) => [discipline.id, discipline]));

  for (const enrollment of snapshot.enrollments.filter((item) => item.active)) {
    const student = activeStudents.get(enrollment.studentId);
    const discipline = disciplineById.get(enrollment.disciplineId);
    if (!student || !discipline || !discipline.active) continue;

    await generateFeeForEnrollmentPeriod({
      academyId,
      enrollment,
      discipline,
      studentName: student.fullName,
      periodYear: year,
      periodMonth: month,
      defaultBillingDay: snapshot.defaultBillingDay
    });
  }
}

export async function registerPayment(params: {
  academyId: string;
  fee: FeeRecord;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note?: string;
  createdBy?: string;
}) {
  const { academyId, fee, paymentDate, paymentMethod, note = "", createdBy = "" } = params;
  const amount = normalizeMoney(params.amount);
  if (amount <= 0) {
    throw new Error("El pago debe ser mayor a cero.");
  }
  if (amount > fee.balance) {
    throw new Error("El pago supera el saldo pendiente de esta cuota.");
  }

  const feeRef = doc(db, `academies/${academyId}/fees`, fee.id);
  const paymentRef = doc(collection(db, `academies/${academyId}/payments`));
  const nextAmountPaid = fee.amountPaid + amount;
  const amounts = resolveFeeAmounts(fee.originalAmount, fee.lateFeeAmount, nextAmountPaid);
  const nextStatus = resolveFeeStatus({
    amount: amounts.totalAmount,
    paidAmount: amounts.amountPaid,
    dueDate: fee.dueDate
  });

  const batch = writeBatch(db);
  batch.update(feeRef, {
    amountPaid: amounts.amountPaid,
    balance: amounts.balance,
    totalAmount: amounts.totalAmount,
    status: nextStatus,
    updatedAt: serverTimestamp()
  });
  batch.set(paymentRef, {
    centerId: academyId,
    feeId: fee.id,
    studentId: fee.studentId,
    amount,
    paymentDate,
    paymentMethod,
    note: note.trim(),
    createdBy,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export function getFeePriorityWindow(fee: Pick<FeeRecord, "dueDate">) {
  return diffDays(fee.dueDate);
}
