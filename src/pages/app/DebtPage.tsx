import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { formatMembershipStatus } from "../../lib/display";
import { db } from "../../lib/firebase";
import { diffDays, getFeeBalance, normalizePaidAmount, resolveFeeStatus, type FeeStatus } from "../../lib/fees";

interface Student {
  id: string;
  fullName: string;
  contactPhone: string;
  status: "active" | "inactive";
}

interface Fee {
  id: string;
  studentId: string;
  concept?: string;
  period?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: FeeStatus;
  dueDate: string;
  disciplineName?: string;
}

function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildWhatsAppLink(studentName: string, phone: string, concept: string, balance: number) {
  const normalizedPhone = sanitizePhone(phone);
  if (!normalizedPhone) return null;

  const message = `Hola ${studentName}, te escribimos desde el centro para recordarte que aun queda un saldo pendiente de $${balance} en ${concept}.`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function normalizeFee(data: Omit<Fee, "id" | "paidAmount" | "balance" | "status"> & { paidAmount?: number; status?: string }) {
  const amount = Number(data.amount || 0);
  const paidAmount = normalizePaidAmount(amount, data.paidAmount ?? (data.status === "paid" ? amount : 0));
  return {
    ...data,
    amount,
    paidAmount,
    balance: getFeeBalance(amount, paidAmount),
    status: resolveFeeStatus({
      amount,
      paidAmount,
      dueDate: data.dueDate
    })
  };
}

export function DebtPage() {
  const { membership, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);

  useEffect(() => {
    async function load() {
      if (isPreviewMode) {
        setStudents([
          { id: "student-1", fullName: "Ana Perez", contactPhone: "5491111111111", status: "active" },
          { id: "student-2", fullName: "Bruno Diaz", contactPhone: "5492222222222", status: "active" }
        ]);
        setFees([
          {
            id: "fee-1",
            ...normalizeFee({
              studentId: "student-1",
              concept: "Cuota mensual 03/2026 - Freestyle",
              period: "2026-03",
              amount: 12000,
              paidAmount: 2000,
              dueDate: "2026-03-05",
              disciplineName: "Freestyle"
            })
          },
          {
            id: "fee-2",
            ...normalizeFee({
              studentId: "student-2",
              concept: "Cuota mensual 03/2026 - Breaking",
              period: "2026-03",
              amount: 15000,
              paidAmount: 15000,
              dueDate: "2026-03-09",
              disciplineName: "Breaking"
            })
          }
        ]);
        return;
      }
      if (!academyPath) return;
      const [studentsSnap, feesSnap] = await Promise.all([
        getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
        getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")))
      ]);
      setStudents(
        studentsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          fullName: String(docSnap.data().fullName ?? "Alumno"),
          contactPhone: String(docSnap.data().contactPhone ?? docSnap.data().phone ?? ""),
          status: (docSnap.data().status as Student["status"]) ?? "active"
        }))
      );
      setFees(
        feesSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...normalizeFee(docSnap.data() as Omit<Fee, "id">)
        }))
      );
    }
    void load();
  }, [academyPath, isPreviewMode]);

  const activeStudents = useMemo(() => students.filter((student) => student.status === "active"), [students]);
  const activeStudentIds = useMemo(() => new Set(activeStudents.map((student) => student.id)), [activeStudents]);

  const trackingRows = useMemo(() => {
    return fees
      .filter((fee) => activeStudentIds.has(fee.studentId))
      .map((fee) => {
        const student = activeStudents.find((item) => item.id === fee.studentId);
        const daysLeft = diffDays(fee.dueDate);
        const whatsappUrl =
          fee.balance > 0 && student
            ? buildWhatsAppLink(student.fullName, student.contactPhone, fee.disciplineName ?? fee.concept ?? "la cuota", fee.balance)
            : null;

        return {
          ...fee,
          studentName: student?.fullName ?? fee.studentId,
          phone: student?.contactPhone ?? "",
          daysLeft,
          whatsappUrl
        };
      })
      .filter((fee) => fee.daysLeft <= 15)
      .sort((a, b) => {
        const aIsDebt = a.balance > 0;
        const bIsDebt = b.balance > 0;
        const aIsOverdueDebt = a.daysLeft < 0 && aIsDebt;
        const bIsOverdueDebt = b.daysLeft < 0 && bIsDebt;
        const aIsUpcomingDebt = a.daysLeft >= 0 && aIsDebt;
        const bIsUpcomingDebt = b.daysLeft >= 0 && bIsDebt;

        if (aIsOverdueDebt !== bIsOverdueDebt) return aIsOverdueDebt ? -1 : 1;
        if (aIsUpcomingDebt !== bIsUpcomingDebt) return aIsUpcomingDebt ? -1 : 1;
        return a.daysLeft - b.daysLeft;
      });
  }, [fees, activeStudentIds, activeStudents]);

  const totals = useMemo(() => {
    const overdue = trackingRows.filter((row) => row.daysLeft < 0 && row.balance > 0).length;
    const upcoming = trackingRows.filter((row) => row.daysLeft >= 0 && row.balance > 0).length;
    const partial = trackingRows.filter((row) => row.status === "partial").length;
    const pendingBalance = trackingRows.reduce((sum, row) => sum + row.balance, 0);
    return { overdue, upcoming, partial, pendingBalance };
  }, [trackingRows]);

  return (
    <Panel
      title="Seguimiento de cobros"
      action={
        <Link
          to="/app/fees"
          className="rounded-brand border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          Ir a cuotas
        </Link>
      }
    >
      <div className="mb-4 rounded-brand border border-warning/30 bg-warning/10 p-4 text-sm">
        <p className="font-semibold text-text">Aqui ves lo que ya vencio y lo que esta por vencer dentro de los proximos 15 dias.</p>
        <p className="mt-1 text-muted">
          El orden prioriza primero las cuotas mas vencidas con saldo, luego las proximas a vencer y al final las que ya estan pagadas.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Summary label="Vencidas" value={totals.overdue} color="text-danger" />
        <Summary label="Por vencer" value={totals.upcoming} color="text-warning" />
        <Summary label="Parciales" value={totals.partial} color="text-primary" />
        <Summary label="Saldo pendiente" value={`$${totals.pendingBalance}`} color="text-danger" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-3 py-2">Prioridad</th>
              <th className="px-3 py-2">Alumno</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Entregado</th>
              <th className="px-3 py-2">Saldo</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {trackingRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-3 py-3">
                  <PriorityBadge daysLeft={row.daysLeft} />
                </td>
                <td className="px-3 py-3">{row.studentName}</td>
                <td className="px-3 py-3 text-muted">{row.disciplineName ?? row.concept ?? "Cuota"}</td>
                <td className="px-3 py-3 text-primary">${row.amount}</td>
                <td className="px-3 py-3 text-secondary">${row.paidAmount}</td>
                <td className="px-3 py-3 font-semibold text-warning">${row.balance}</td>
                <td className="px-3 py-3 text-muted">{row.dueDate}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-brand px-2 py-1 text-xs font-semibold ${
                      row.status === "paid"
                        ? "bg-secondary/15 text-secondary"
                        : row.status === "overdue"
                          ? "bg-danger/15 text-danger"
                          : row.status === "partial"
                            ? "bg-primary/15 text-primary"
                            : "bg-warning/15 text-warning"
                    }`}
                  >
                    {formatMembershipStatus(row.status)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {row.whatsappUrl ? (
                    <a
                      href={row.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Enviar WhatsApp a ${row.studentName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-secondary transition hover:bg-secondary/25"
                    >
                      <WhatsAppIcon />
                    </a>
                  ) : (
                    <span className="text-xs text-muted">Sin aviso</span>
                  )}
                </td>
              </tr>
            ))}
            {trackingRows.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={9}>
                  No hay cuotas para seguir dentro de los proximos 15 dias.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
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
