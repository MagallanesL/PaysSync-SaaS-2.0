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
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { formatBillingType, formatMembershipStatus } from "../../lib/display";
import { db } from "../../lib/firebase";
import type { FeeCategory, FeePaymentMode } from "../../lib/fees";
import { DEFAULT_PLATFORM_CONFIG, getPlanLabel, getPlanLimit, normalizePlatformConfig, type PlatformConfig } from "../../lib/plans";
import type { AcademyPlan } from "../../lib/types";

interface Student {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  contactPhone: string;
  allergies: string;
  status: "active" | "inactive";
  disciplines?: AssignedDiscipline[];
}

interface AssignedDiscipline {
  disciplineId: string;
  name: string;
  billingType: FeeCategory;
  paymentMode?: FeePaymentMode;
  allowPartial?: boolean;
  price: number;
}

interface DisciplineOption extends AssignedDiscipline {
  id: string;
  active: boolean;
}

interface StudentFormState {
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  contactPhone: string;
  allergies: string;
  disciplineIds: string[];
}

const emptyForm: StudentFormState = {
  fullName: "",
  email: "",
  phone: "",
  emergencyContactName: "",
  contactPhone: "",
  allergies: "",
  disciplineIds: []
};

function sortStudents(items: Student[]) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "active" ? -1 : 1;
    }
    return a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
  });
}

function buildWhatsAppLink(phone: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone) return null;
  return `https://wa.me/${normalizedPhone}`;
}

export function StudentsPage() {
  const { membership, canWriteAcademyData, isPreviewMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(emptyForm);
  const [plan, setPlan] = useState<AcademyPlan>("basic");
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const academyPath = membership ? `academies/${membership.academyId}` : null;

  async function loadStudents() {
    if (isPreviewMode) {
      setStudents(
        sortStudents([
          {
            id: "student-1",
            fullName: "Ana Perez",
            email: "ana@demo.com",
            phone: "11-5555-1111",
            emergencyContactName: "Laura Perez",
            contactPhone: "11-4444-1111",
            allergies: "Alergia al mani",
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
            email: "bruno@demo.com",
            phone: "11-5555-2222",
            emergencyContactName: "Carlos Diaz",
            contactPhone: "11-4444-2222",
            allergies: "",
            status: "inactive",
            disciplines: []
          }
        ])
      );
      setDisciplines([
        {
          id: "disc-1",
          disciplineId: "disc-1",
          name: "Freestyle",
          billingType: "monthly_fee",
          paymentMode: "monthly",
          allowPartial: false,
          price: 20000,
          active: true
        },
        {
          id: "disc-2",
          disciplineId: "disc-2",
          name: "Indumentaria",
          billingType: "uniform",
          paymentMode: "one_time",
          allowPartial: true,
          price: 12000,
          active: true
        }
      ]);
      setPlan("pro");
      return;
    }

    if (!academyPath || !membership) return;
    const [studentsSnap, academySnap, disciplinesSnap, configSnap] = await Promise.all([
      getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
      getDoc(doc(db, "academies", membership.academyId)),
      getDocs(query(collection(db, `${academyPath}/disciplines`), orderBy("name", "asc"))),
      getDoc(doc(db, "platform", "config"))
    ]);
    setStudents(
      sortStudents(
        studentsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fullName: String(data.fullName ?? ""),
            email: String(data.email ?? ""),
            phone: String(data.phone ?? ""),
            emergencyContactName: String(data.emergencyContactName ?? ""),
            contactPhone: String(data.contactPhone ?? ""),
            allergies: String(data.allergies ?? ""),
            status: (data.status as Student["status"]) ?? "active",
            disciplines: (data.disciplines as AssignedDiscipline[] | undefined) ?? []
          };
        })
      )
    );
    setDisciplines(
      disciplinesSnap.docs.map((d) => ({
        id: d.id,
        disciplineId: d.id,
        name: String(d.data().name ?? ""),
        billingType: d.data().billingType as DisciplineOption["billingType"],
        paymentMode: (d.data().paymentMode as DisciplineOption["paymentMode"] | undefined) ?? undefined,
        allowPartial: Boolean(d.data().allowPartial ?? false),
        price: Number(d.data().price ?? 0),
        active: Boolean(d.data().active ?? true)
      }))
    );
    if (academySnap.exists()) {
      setPlan(academySnap.data().plan as AcademyPlan);
    }
    setPlatformConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
  }

  useEffect(() => {
    void loadStudents();
  }, [academyPath, isPreviewMode]);

  const maxStudents = useMemo(() => getPlanLimit(platformConfig, plan), [plan, platformConfig]);

  useEffect(() => {
    if (!isModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteAcademyData || !academyPath || isPreviewMode) return;

    setError(null);
    if (!editingId && maxStudents !== null && students.filter((student) => student.status === "active").length >= maxStudents) {
      setError(`Limite alcanzado para plan ${getPlanLabel(platformConfig, plan)}: ${maxStudents} alumnos activos.`);
      return;
    }

    const assignedDisciplines = disciplines
      .filter((discipline) => form.disciplineIds.includes(discipline.id))
      .map((discipline) => ({
        disciplineId: discipline.id,
        name: discipline.name,
        billingType: discipline.billingType,
        paymentMode: discipline.paymentMode,
        allowPartial: discipline.allowPartial,
        price: discipline.price
      }));

    const payload = {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      emergencyContactName: form.emergencyContactName.trim(),
      contactPhone: form.contactPhone,
      allergies: form.allergies.trim(),
      status: editingId ? students.find((student) => student.id === editingId)?.status ?? "active" : "active",
      disciplines: assignedDisciplines,
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      await updateDoc(doc(db, `${academyPath}/students`, editingId), payload);
    } else {
      await addDoc(collection(db, `${academyPath}/students`), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeModal();
    await loadStudents();
  }

  async function handleToggleStatus(student: Student) {
    if (!canWriteAcademyData || isPreviewMode) return;

    const nextStatus: Student["status"] = student.status === "active" ? "inactive" : "active";
    if (academyPath) {
      await updateDoc(doc(db, `${academyPath}/students`, student.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      await loadStudents();
      return;
    }

    setStudents((prev) =>
      sortStudents(prev.map((item) => (item.id === student.id ? { ...item, status: nextStatus } : item)))
    );
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setIsModalOpen(true);
  }

  function onEdit(student: Student) {
    setEditingId(student.id);
    setForm({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      emergencyContactName: student.emergencyContactName,
      contactPhone: student.contactPhone,
      allergies: student.allergies,
      disciplineIds: (student.disciplines ?? []).map((discipline) => discipline.disciplineId)
    });
    setError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  const activeStudents = students.filter((student) => student.status === "active").length;

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
            Crear alumno
          </button>
        }
      >
        <p className="mb-3 text-xs text-muted">
          Plan actual: <span className="uppercase text-primary">{getPlanLabel(platformConfig, plan)}</span> | Limite: {maxStudents ?? "Ilimitado"} | Activos: {activeStudents} | Total: {students.length}
        </p>
        <div className="space-y-3 md:hidden">
          {students.map((student) => (
            <article
              key={student.id}
              className={`rounded-brand border border-slate-800 bg-bg p-4 ${student.status === "inactive" ? "opacity-80" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{student.fullName}</p>
                  <p className="break-all text-sm text-muted">{student.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(student)}
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
                <MobileInfo label="Telefono" value={student.phone || "-"} />
                <MobileInfo label="Contacto" value={student.emergencyContactName || "-"} />
                <MobileInfo label="WhatsApp urgencia" value={student.contactPhone || "-"} href={buildWhatsAppLink(student.contactPhone)} />
                <MobileInfo label="Alergias" value={student.allergies || "-"} />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={!canWriteAcademyData || isPreviewMode}
                  onClick={() => onEdit(student)}
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
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Telefono urgencia</th>
                <th className="px-3 py-2">Alergias</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className={`border-t border-slate-800 ${student.status === "inactive" ? "opacity-80" : ""}`}>
                  <td className="px-3 py-3">{student.fullName}</td>
                  <td className="px-3 py-3 text-muted">{student.email}</td>
                  <td className="px-3 py-3 text-muted">{student.phone || "-"}</td>
                  <td className="px-3 py-3 text-muted">{student.emergencyContactName || "-"}</td>
                  <td className="px-3 py-3 text-muted">
                    {buildWhatsAppLink(student.contactPhone) ? (
                      <a
                        href={buildWhatsAppLink(student.contactPhone) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {student.contactPhone}
                      </a>
                    ) : (
                      student.contactPhone || "-"
                    )}
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-muted">{student.allergies || "-"}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(student)}
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
                      onClick={() => onEdit(student)}
                      className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
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
                  {editingId ? "Editar alumno" : "Nuevo alumno"}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Completa los datos sin perder de vista el listado principal.
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

            <form onSubmit={(e) => void handleSave(e)} className="grid gap-4 text-sm">
              <SectionTitle title="Datos del alumno" />
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Nombre completo"
                  value={form.fullName}
                  onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
                />
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Telefono del alumno"
                  value={form.phone}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                  required={false}
                />
                {editingId && (
                  <div className="rounded-brand border border-slate-700 bg-bg px-3 py-2">
                    <p className="text-xs uppercase text-muted">Estado actual</p>
                    <p className={`mt-1 text-sm font-semibold ${students.find((student) => student.id === editingId)?.status === "active" ? "text-secondary" : "text-danger"}`}>
                      {formatMembershipStatus(students.find((student) => student.id === editingId)?.status ?? "active")}
                    </p>
                  </div>
                )}
              </div>

              <SectionTitle title="Datos de urgencia" />
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Nombre del contacto"
                  value={form.emergencyContactName}
                  onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactName: value }))}
                  required={false}
                />
                <Field
                  label="Telefono de contacto"
                  value={form.contactPhone}
                  onChange={(value) => setForm((prev) => ({ ...prev, contactPhone: value }))}
                  required={false}
                />
              </div>

              <TextArea
                label="Alergias"
                value={form.allergies}
                onChange={(value) => setForm((prev) => ({ ...prev, allergies: value }))}
                placeholder="Ej: alergia al mani, asma, requiere medicacion, etc."
              />

              <SectionTitle title="Disciplinas" />
              <div className="grid gap-2 rounded-brand border border-slate-700 bg-bg p-3">
                {disciplines.filter((discipline) => discipline.active).length > 0 ? (
                  disciplines
                    .filter((discipline) => discipline.active)
                    .map((discipline) => (
                      <label key={discipline.id} className="flex items-center justify-between gap-3 text-sm text-muted">
                        <span>
                          {discipline.name} <span className="text-xs uppercase">({formatBillingType(discipline.billingType)})</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-[11px] text-muted">
                            {(discipline.paymentMode ?? (discipline.billingType === "monthly_fee" ? "monthly" : "one_time")) === "monthly"
                              ? "Mensual"
                              : discipline.allowPartial
                                ? "Entrega parcial"
                                : "Unico"}
                          </span>
                          <span className="text-primary">${discipline.price}</span>
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
                          />
                        </span>
                      </label>
                    ))
                ) : (
                  <p className="text-xs text-muted">Primero crea disciplinas en el modulo Disciplinas.</p>
                )}
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}
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
                  {editingId ? "Guardar cambios" : "Crear alumno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MobileInfo({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-words text-primary underline-offset-2 hover:underline">
          {value}
        </a>
      ) : (
        <p className="break-words text-text">{value}</p>
      )}
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
        onChange={(e) => onChange(e.target.value)}
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
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
