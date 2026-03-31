import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import {
  generateFeeForEnrollmentPeriod,
  getCurrentPeriodParts,
  loadAcademyBillingSnapshot,
  type AcademyBillingSnapshot,
  type AssignedDisciplineSnapshot,
  type DisciplineRecord,
  type EnrollmentRecord
} from "../../lib/academyBilling";
import { formatMembershipStatus } from "../../lib/display";
import { db } from "../../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanLabel,
  getPlanLimit,
  normalizePlatformConfig,
  type PlatformConfig
} from "../../lib/plans";
import type { AcademyPlan } from "../../lib/types";

interface StudentFormState {
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  disciplineIds: string[];
}

const emptyForm: StudentFormState = {
  fullName: "",
  email: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
  disciplineIds: []
};

function sortStudents<T extends { fullName: string; status: "active" | "inactive" }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
  });
}

export function StudentsPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [snapshot, setSnapshot] = useState<AcademyBillingSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [debtFilter, setDebtFilter] = useState<"all" | "with_debt" | "without_debt">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(emptyForm);
  const [plan, setPlan] = useState<AcademyPlan>("basic");
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAdditionalData, setShowAdditionalData] = useState(false);

  async function loadData() {
    if (isPreviewMode) {
      setSnapshot({
        defaultBillingDay: 10,
        disciplines: [
          {
            id: "disc-1",
            centerId: "demo",
            name: "Voley",
            category: "monthly_fee",
            modality: "Adultos",
            baseAmount: 20000,
            billingType: "monthly",
            active: true,
            allowPartial: true,
            note: ""
          },
          {
            id: "disc-2",
            centerId: "demo",
            name: "Danza",
            category: "monthly_fee",
            modality: "Kids",
            baseAmount: 18000,
            billingType: "monthly",
            active: true,
            allowPartial: true,
            note: ""
          }
        ],
        students: [
          {
            id: "student-1",
            fullName: "Ana Perez",
            email: "ana@demo.com",
            phone: "11-5555-1111",
            emergencyContactName: "Laura Perez",
            emergencyContactPhone: "11-4444-1111",
            allergies: "Alergia al mani",
            status: "active",
            disciplines: [
              {
                disciplineId: "disc-1",
                name: "Voley",
                billingType: "monthly_fee",
                paymentMode: "monthly",
                allowPartial: true,
                price: 20000
              }
            ]
          },
          {
            id: "student-2",
            fullName: "Bruno Diaz",
            email: "",
            phone: "11-5555-2222",
            emergencyContactName: "",
            emergencyContactPhone: "",
            allergies: "",
            status: "inactive",
            disciplines: []
          }
        ],
        enrollments: [
          {
            id: "enr-1",
            centerId: "demo",
            studentId: "student-1",
            disciplineId: "disc-1",
            startDate: "2026-03-03",
            active: true,
            billingDay: 10
          }
        ],
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
          }
        ],
        payments: []
      });
      setPlan("pro");
      setPlatformConfig(DEFAULT_PLATFORM_CONFIG);
      return;
    }

    if (!membership) return;
    const [billingSnapshot, academySnap, configSnap] = await Promise.all([
      loadAcademyBillingSnapshot(membership.academyId),
      getDoc(doc(db, "academies", membership.academyId)),
      getDoc(doc(db, "platform", "config"))
    ]);

    setSnapshot(billingSnapshot);
    setPlan((academySnap.data()?.plan as AcademyPlan | undefined) ?? "basic");
    setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
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

  const disciplines = useMemo(
    () => (snapshot?.disciplines ?? []).filter((discipline) => discipline.active),
    [snapshot]
  );

  const activeStudentsCount = useMemo(
    () => (snapshot?.students ?? []).filter((student) => student.status === "active").length,
    [snapshot]
  );

  const maxStudents = useMemo(() => getPlanLimit(platformConfig, plan), [platformConfig, plan]);

  const studentRows = useMemo(() => {
    if (!snapshot) return [];

    return sortStudents(
      snapshot.students.map((student) => {
        const activeEnrollments = snapshot.enrollments.filter(
          (enrollment) => enrollment.studentId === student.id && enrollment.active
        );
        const activeFees = snapshot.fees.filter(
          (fee) => fee.studentId === student.id && activeEnrollments.some((enrollment) => enrollment.id === fee.enrollmentId)
        );
        const pendingBalance = activeFees.reduce((sum, fee) => sum + fee.balance, 0);
        const overdueCount = activeFees.filter((fee) => fee.status === "overdue").length;
        const currentStatus =
          overdueCount > 0
            ? "Vencida"
            : pendingBalance > 0
              ? "Saldo pendiente"
              : activeFees.length > 0
                ? "Al dia"
                : "Sin cuotas";

        return {
          ...student,
          disciplines: student.disciplines,
          pendingBalance,
          currentStatus
        };
      })
    );
  }, [snapshot]);

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return studentRows.filter((student) => {
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      const matchesDebt =
        debtFilter === "all" ||
        (debtFilter === "with_debt" ? student.pendingBalance > 0 : student.pendingBalance === 0);
      const disciplineLabel = student.disciplines.map((discipline) => discipline.name).join(" ").toLowerCase();
      const matchesSearch =
        !term ||
        student.fullName.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.phone.toLowerCase().includes(term) ||
        disciplineLabel.includes(term);
      return matchesStatus && matchesDebt && matchesSearch;
    });
  }, [debtFilter, search, statusFilter, studentRows]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !snapshot || !canWriteAcademyData || isPreviewMode) return;

    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();

    setError(null);
    setSuccessMessage(null);

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!trimmedEmail && !trimmedPhone) {
      setError("Carga al menos un contacto basico: email o telefono.");
      return;
    }
    if (!editingId && maxStudents !== null && activeStudentsCount >= maxStudents) {
      setError(`Limite alcanzado para plan ${getPlanLabel(platformConfig, plan)}: ${maxStudents} alumnos activos.`);
      return;
    }

    const academyId = membership.academyId;
    const academyPath = `academies/${academyId}`;
    const studentRef = editingId
      ? doc(db, `${academyPath}/students`, editingId)
      : doc(collection(db, `${academyPath}/students`));
    const selectedDisciplines = disciplines.filter((discipline) => form.disciplineIds.includes(discipline.id));
    const disciplineSnapshot: AssignedDisciplineSnapshot[] = selectedDisciplines.map((discipline) => ({
      disciplineId: discipline.id,
      name: discipline.name,
      billingType: discipline.category,
      paymentMode: "monthly",
      allowPartial: discipline.allowPartial,
      price: discipline.baseAmount
    }));
    const currentStudent = snapshot.students.find((student) => student.id === editingId);
    const nextStatus = currentStudent?.status ?? "active";
    const existingEnrollments = snapshot.enrollments.filter((enrollment) => enrollment.studentId === studentRef.id);
    const activeEnrollmentByDisciplineId = new Map(
      existingEnrollments.filter((enrollment) => enrollment.active).map((enrollment) => [enrollment.disciplineId, enrollment])
    );
    const inactiveEnrollmentByDisciplineId = new Map(
      existingEnrollments.filter((enrollment) => !enrollment.active).map((enrollment) => [enrollment.disciplineId, enrollment])
    );
    const batch = writeBatch(db);
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const enrollmentsToEnsureFee: Array<{ enrollment: EnrollmentRecord; discipline: DisciplineRecord }> = [];

    batch.set(
      studentRef,
      {
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        contactPhone: form.emergencyContactPhone.trim(),
        allergies: form.allergies.trim(),
        status: nextStatus,
        disciplines: disciplineSnapshot,
        updatedAt: serverTimestamp(),
        ...(editingId ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );

    const selectedIds = new Set(selectedDisciplines.map((discipline) => discipline.id));

    for (const discipline of selectedDisciplines) {
      const existingActive = activeEnrollmentByDisciplineId.get(discipline.id);
      if (existingActive) {
        enrollmentsToEnsureFee.push({ enrollment: existingActive, discipline });
        continue;
      }

      const inactiveEnrollment = inactiveEnrollmentByDisciplineId.get(discipline.id);
      if (inactiveEnrollment) {
        const reactivatedEnrollment: EnrollmentRecord = {
          ...inactiveEnrollment,
          active: true,
          startDate,
          billingDay: inactiveEnrollment.billingDay ?? snapshot.defaultBillingDay
        };
        batch.set(
          doc(db, `${academyPath}/enrollments`, inactiveEnrollment.id),
          {
            active: true,
            startDate,
            billingDay: inactiveEnrollment.billingDay ?? snapshot.defaultBillingDay,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        enrollmentsToEnsureFee.push({ enrollment: reactivatedEnrollment, discipline });
        continue;
      }

      const enrollmentRef = doc(collection(db, `${academyPath}/enrollments`));
      const newEnrollment: EnrollmentRecord = {
        id: enrollmentRef.id,
        centerId: academyId,
        studentId: studentRef.id,
        disciplineId: discipline.id,
        startDate,
        active: true,
        billingDay: snapshot.defaultBillingDay
      };
      batch.set(enrollmentRef, {
        centerId: academyId,
        studentId: studentRef.id,
        disciplineId: discipline.id,
        startDate,
        active: true,
        billingDay: snapshot.defaultBillingDay,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      enrollmentsToEnsureFee.push({ enrollment: newEnrollment, discipline });
    }

    for (const enrollment of existingEnrollments.filter(
      (item) => item.active && !selectedIds.has(item.disciplineId)
    )) {
      batch.update(doc(db, `${academyPath}/enrollments`, enrollment.id), {
        active: false,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();

    const { year, month } = getCurrentPeriodParts(today);
    for (const item of enrollmentsToEnsureFee) {
      await generateFeeForEnrollmentPeriod({
        academyId,
        enrollment: item.enrollment,
        discipline: item.discipline,
        studentName: trimmedName,
        periodYear: year,
        periodMonth: month,
        defaultBillingDay: snapshot.defaultBillingDay
      });
    }

    closeModal();
    setSuccessMessage("Alumno creado + cuota generada");
    await loadData();
  }

  async function handleToggleStatus(studentId: string, currentStatus: "active" | "inactive") {
    if (!membership || !canWriteAcademyData || isPreviewMode) return;
    await updateDoc(doc(db, `academies/${membership.academyId}/students`, studentId), {
      status: currentStatus === "active" ? "inactive" : "active",
      updatedAt: serverTimestamp()
    });
    await loadData();
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setSuccessMessage(null);
    setShowAdditionalData(false);
    setIsModalOpen(true);
  }

  function onEdit(studentId: string) {
    const student = snapshot?.students.find((item) => item.id === studentId);
    if (!student) return;

    setEditingId(student.id);
    setForm({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      emergencyContactName: student.emergencyContactName,
      emergencyContactPhone: student.emergencyContactPhone,
      allergies: student.allergies,
      disciplineIds: student.disciplines.map((discipline) => discipline.disciplineId)
    });
    setError(null);
    setSuccessMessage(null);
    setShowAdditionalData(Boolean(student.emergencyContactName || student.emergencyContactPhone || student.allergies));
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowAdditionalData(false);
    setIsModalOpen(false);
  }

  return (
    <>
      <Panel
        title="Alumnos"
        action={
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canWriteAcademyData || isPreviewMode}
            className="rounded-brand bg-primary px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
          >
            {isPreviewMode ? "Modo demo" : "Crear alumno"}
          </button>
        }
      >
        <div className="mb-4 grid gap-3 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] p-4 xl:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#9FB0D0]">Base operativa</p>
            <p className="mt-2 text-sm text-[#9FB0D0]">
              Crea alumnos, asigna disciplinas activas y deja listo el alta para generar la cuota inicial del periodo.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm text-[#9FB0D0]">
              Buscar
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, contacto o disciplina"
                className="min-w-0 rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] px-3 py-2 text-[#F5F7FB] outline-none focus:border-[#00D1FF]"
              />
            </label>
            <label className="grid gap-1 text-sm text-[#9FB0D0]">
              Estado
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
                className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] px-3 py-2 text-[#F5F7FB] outline-none focus:border-[#00D1FF]"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-[#9FB0D0]">
              Deuda
              <select
                value={debtFilter}
                onChange={(event) => setDebtFilter(event.target.value as "all" | "with_debt" | "without_debt")}
                className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] px-3 py-2 text-[#F5F7FB] outline-none focus:border-[#00D1FF]"
              >
                <option value="all">Todos</option>
                <option value="with_debt">Con deuda</option>
                <option value="without_debt">Sin deuda</option>
              </select>
            </label>
          </div>
        </div>

        <p className="mb-3 text-xs text-muted">
          Plan actual: <span className="uppercase text-primary">{getPlanLabel(platformConfig, plan)}</span> | Limite: {maxStudents ?? "Ilimitado"} | Activos: {activeStudentsCount} | Total: {snapshot?.students.length ?? 0}
        </p>
        {successMessage ? (
          <div className="mb-3 rounded-brand border border-secondary/30 bg-secondary/10 px-3 py-3 text-sm text-secondary">
            {successMessage}
          </div>
        ) : null}

        <div className="space-y-3 md:hidden">
          {visibleStudents.map((student) => (
            <article key={student.id} className="rounded-brand border border-slate-800 bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{student.fullName}</p>
                  <p className="break-all text-sm text-muted">{student.email || student.phone || "Sin contacto principal"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(student.id, student.status)}
                  disabled={!canWriteAcademyData || isPreviewMode}
                  className={`shrink-0 rounded-brand px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                    student.status === "active"
                      ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                      : "bg-danger/15 text-danger hover:bg-danger/25"
                  }`}
                >
                  {formatMembershipStatus(student.status)}
                </button>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted">
                <MobileInfo label="Disciplinas" value={student.disciplines.map((discipline) => discipline.name).join(", ") || "Sin disciplinas"} />
                <MobileInfo label="Estado de cuota" value={student.currentStatus} />
                <MobileInfo label="Saldo pendiente" value={`$${student.pendingBalance}`} />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={!canWriteAcademyData || isPreviewMode}
                  onClick={() => onEdit(student.id)}
                  className="w-full rounded-brand border border-slate-600 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Disciplinas</th>
                <th className="px-3 py-2">Deuda</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-t border-slate-800">
                  <td className="px-3 py-3">{student.fullName}</td>
                  <td className="px-3 py-3 text-muted">{student.email || student.phone || "-"}</td>
                  <td className="max-w-[260px] px-3 py-3 text-muted">
                    {student.disciplines.map((discipline) => discipline.name).join(", ") || "Sin disciplinas"}
                  </td>
                  <td className="px-3 py-3">
                    <p className={`font-semibold ${student.pendingBalance > 0 ? "text-danger" : "text-secondary"}`}>
                      ${student.pendingBalance}
                    </p>
                    <p className="text-xs text-muted">{student.currentStatus}</p>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(student.id, student.status)}
                      disabled={!canWriteAcademyData || isPreviewMode}
                      className={`rounded-brand px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                        student.status === "active"
                          ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                          : "bg-danger/15 text-danger hover:bg-danger/25"
                      }`}
                    >
                      {formatMembershipStatus(student.status)}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={!canWriteAcademyData || isPreviewMode}
                      onClick={() => onEdit(student.id)}
                      className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={6}>
                    No hay alumnos que coincidan con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="student-modal-title" className="font-display text-lg text-text">
                  {editingId ? "Editar alumno y asignacion de cuota" : "Nuevo alumno y asignacion de cuota"}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Deja lista el alta operativa para cobrar desde este mismo paso.
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

            <form onSubmit={(event) => void handleSave(event)} className="grid gap-4 text-sm">
              <SectionTitle title="Asignacion de disciplina" />
              <div className="rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#0B0F1A] p-3">
                <p className="text-xs uppercase tracking-wide text-primary">Alta con impacto inmediato</p>
                <p className="mt-2 text-sm text-muted">Se generara automaticamente la cuota del mes actual.</p>
              </div>
              <div className="grid gap-2 rounded-brand border border-slate-700 bg-bg p-3">
                {disciplines.length > 0 ? (
                  disciplines.map((discipline) => (
                    <label key={discipline.id} className="rounded-brand border border-slate-800 bg-[#0B0F1A] p-3 text-sm text-muted transition hover:border-primary/40">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block font-medium text-text">{discipline.name}</span>
                          <span className="mt-1 block text-xs uppercase text-primary">
                            {discipline.modality || "Mensual"}
                          </span>
                          <span className="mt-2 block text-xs text-muted">
                            Monto mensual: <span className="text-text">${discipline.baseAmount}</span>
                          </span>
                          <span className="mt-1 block text-xs text-muted">
                            Dia de vencimiento: <span className="text-text">{snapshot?.defaultBillingDay ?? 10}</span>
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.disciplineIds.includes(discipline.id)}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              disciplineIds: event.target.checked
                                ? [...prev.disciplineIds, discipline.id]
                                : prev.disciplineIds.filter((id) => id !== discipline.id)
                            }))
                          }
                          className="mt-1"
                        />
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted">Primero crea disciplinas activas en el modulo Disciplinas.</p>
                )}
              </div>
              {disciplines.length > 0 && form.disciplineIds.length === 0 ? (
                <div className="rounded-brand border border-warning/30 bg-warning/10 px-3 py-3 text-xs text-warning">
                  Selecciona al menos una disciplina para generar la cuota inicial.
                </div>
              ) : null}

              <SectionTitle title="Datos basicos del alumno" />
              <p className="-mt-2 text-xs text-muted">Podes completar mas datos despues.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nombre completo" value={form.fullName} onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))} />
                <Field label="Email" type="email" required={false} value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Telefono principal" required={false} value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
                {editingId ? (
                  <div className="rounded-brand border border-slate-700 bg-bg px-3 py-2">
                    <p className="text-xs uppercase text-muted">Estado actual</p>
                    <p className="mt-1 text-sm font-semibold text-secondary">
                      {formatMembershipStatus(snapshot?.students.find((student) => student.id === editingId)?.status ?? "active")}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-brand border border-slate-700 bg-bg px-3 py-2">
                    <p className="text-xs uppercase text-muted">Alta operativa</p>
                    <p className="mt-1 text-sm text-text">Carga un contacto basico y luego asigna disciplina.</p>
                  </div>
                )}
              </div>

              <div className="rounded-brand border border-slate-700 bg-bg">
                <button
                  type="button"
                  onClick={() => setShowAdditionalData((prev) => !prev)}
                  className="flex w-full items-center justify-between px-3 py-3 text-left text-sm text-text"
                >
                  <span>Agregar datos adicionales</span>
                  <span className="text-xs text-primary">{showAdditionalData ? "Ocultar" : "Mostrar"}</span>
                </button>
                {showAdditionalData ? (
                  <div className="grid gap-4 border-t border-slate-700 px-3 py-3">
                    <SectionTitle title="Datos secundarios" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Contacto de urgencia" required={false} value={form.emergencyContactName} onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactName: value }))} />
                      <Field label="Telefono de urgencia" required={false} value={form.emergencyContactPhone} onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactPhone: value }))} />
                    </div>

                    <TextArea
                      label="Alergias"
                      value={form.allergies}
                      onChange={(value) => setForm((prev) => ({ ...prev, allergies: value }))}
                      placeholder="Ej: alergia al mani, asma, medicacion, etc."
                    />
                  </div>
                ) : null}
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-brand border border-slate-600 px-3 py-2 text-muted">
                  Cancelar
                </button>
                <button disabled={!canWriteAcademyData || isPreviewMode} className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40">
                  {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear alumno y generar cuota"}
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

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-t border-slate-700 pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={required}
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
