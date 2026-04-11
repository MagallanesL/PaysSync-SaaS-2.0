import { MobileInfo } from "../common/FormPrimitives";
import { formatMembershipStatus } from "../../../lib/display";

export interface StudentListRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  disciplines: Array<{ name: string }>;
  pendingBalance: number;
  currentStatus: string;
}

interface StudentsListProps {
  students: StudentListRow[];
  canWrite: boolean;
  isPreviewMode: boolean;
  onEdit: (studentId: string) => void;
  onToggleStatus: (studentId: string, status: "active" | "inactive") => void;
}

export function StudentsList({
  students,
  canWrite,
  isPreviewMode,
  onEdit,
  onToggleStatus
}: StudentsListProps) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {students.map((student) => (
          <article key={student.id} className="rounded-brand border border-slate-800 bg-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-text">{student.fullName}</p>
                <p className="break-all text-sm text-muted">{student.email || student.phone || "Sin contacto principal"}</p>
              </div>
              <StudentStatusButton
                status={student.status}
                disabled={!canWrite || isPreviewMode}
                onClick={() => onToggleStatus(student.id, student.status)}
              />
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted">
              <MobileInfo label="Disciplinas" value={student.disciplines.map((discipline) => discipline.name).join(", ") || "Sin disciplinas"} />
              <MobileInfo label="Estado de cuota" value={student.currentStatus} />
              <MobileInfo label="Saldo pendiente" value={`$${student.pendingBalance}`} />
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={!canWrite || isPreviewMode}
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
            {students.map((student) => (
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
                  <StudentStatusButton
                    status={student.status}
                    disabled={!canWrite || isPreviewMode}
                    onClick={() => onToggleStatus(student.id, student.status)}
                  />
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    disabled={!canWrite || isPreviewMode}
                    onClick={() => onEdit(student.id)}
                    className="rounded-brand border border-slate-600 px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={6}>
                  No hay alumnos que coincidan con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StudentStatusButton({
  status,
  disabled,
  onClick
}: {
  status: "active" | "inactive";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-brand px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${
        status === "active"
          ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
          : "bg-danger/15 text-danger hover:bg-danger/25"
      }`}
    >
      {formatMembershipStatus(status)}
    </button>
  );
}
