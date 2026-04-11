import type { FormEvent } from "react";
import type { DisciplineRecord } from "../../../lib/academyBilling";
import { formatMembershipStatus } from "../../../lib/display";
import { Field, SectionTitle, TextArea } from "../common/FormPrimitives";

export interface StudentFormState {
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  disciplineIds: string[];
}

interface StudentFormModalProps {
  isOpen: boolean;
  editingId: string | null;
  form: StudentFormState;
  disciplines: DisciplineRecord[];
  defaultBillingDay: number;
  currentStudentStatus?: "active" | "inactive";
  showAdditionalData: boolean;
  canWrite: boolean;
  isPreviewMode: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleAdditionalData: () => void;
  onFormChange: (nextForm: StudentFormState) => void;
}

export function StudentFormModal({
  isOpen,
  editingId,
  form,
  disciplines,
  defaultBillingDay,
  currentStudentStatus,
  showAdditionalData,
  canWrite,
  isPreviewMode,
  error,
  onClose,
  onSubmit,
  onToggleAdditionalData,
  onFormChange
}: StudentFormModalProps) {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
            className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 text-sm">
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
                        Dia de vencimiento: <span className="text-text">{defaultBillingDay}</span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.disciplineIds.includes(discipline.id)}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          disciplineIds: event.target.checked
                            ? [...form.disciplineIds, discipline.id]
                            : form.disciplineIds.filter((id) => id !== discipline.id)
                        })
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
            <Field label="Nombre completo" value={form.fullName} onChange={(value) => onFormChange({ ...form, fullName: value })} />
            <Field label="Email" type="email" required={false} value={form.email} onChange={(value) => onFormChange({ ...form, email: value })} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Telefono principal" required={false} value={form.phone} onChange={(value) => onFormChange({ ...form, phone: value })} />
            {editingId ? (
              <div className="rounded-brand border border-slate-700 bg-bg px-3 py-2">
                <p className="text-xs uppercase text-muted">Estado actual</p>
                <p className="mt-1 text-sm font-semibold text-secondary">
                  {formatMembershipStatus(currentStudentStatus ?? "active")}
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
              onClick={onToggleAdditionalData}
              className="flex w-full items-center justify-between px-3 py-3 text-left text-sm text-text"
            >
              <span>Agregar datos adicionales</span>
              <span className="text-xs text-primary">{showAdditionalData ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showAdditionalData ? (
              <div className="grid gap-4 border-t border-slate-700 px-3 py-3">
                <SectionTitle title="Datos secundarios" />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Contacto de urgencia" required={false} value={form.emergencyContactName} onChange={(value) => onFormChange({ ...form, emergencyContactName: value })} />
                  <Field label="Telefono de urgencia" required={false} value={form.emergencyContactPhone} onChange={(value) => onFormChange({ ...form, emergencyContactPhone: value })} />
                </div>

                <TextArea
                  label="Alergias"
                  value={form.allergies}
                  onChange={(value) => onFormChange({ ...form, allergies: value })}
                  placeholder="Ej: alergia al mani, asma, medicacion, etc."
                />
              </div>
            ) : null}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-brand border border-slate-600 px-3 py-2 text-muted">
              Cancelar
            </button>
            <button disabled={!canWrite || isPreviewMode} className="rounded-brand bg-primary px-3 py-2 font-semibold text-bg disabled:opacity-40">
              {isPreviewMode ? "Modo demo" : editingId ? "Guardar cambios" : "Crear alumno y generar cuota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
