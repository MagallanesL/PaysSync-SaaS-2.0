import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { formatMembershipStatus } from "../../lib/display";
import { db } from "../../lib/firebase";
import { Panel } from "../../components/ui/Panel";
import {
  applyBillingSettingsToFee,
  compareFeePriority,
  DEFAULT_ACADEMY_BILLING_SETTINGS,
  diffDays,
  getDaysOverdue,
  getFeeBalance,
  normalizeAcademyBillingSettings,
  normalizePaidAmount,
  resolveFeeStatus,
  type FeeStatus
} from "../../lib/fees";

interface StudentOption {
  id: string;
  fullName: string;
  status: "active" | "inactive";
}

interface Fee {
  id: string;
  studentId: string;
  concept: string;
  disciplineName?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: FeeStatus;
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

export function PaymentsPage() {
  const { membership, isPreviewMode } = useAuth();
  const academyPath = membership ? `academies/${membership.academyId}` : null;
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);

  useEffect(() => {
    async function loadData() {
      if (isPreviewMode) {
        setStudents([
          { id: "student-1", fullName: "Ana Perez", status: "active" },
          { id: "student-2", fullName: "Bruno Diaz", status: "active" }
        ]);
        setFees([
          {
            id: "fee-1",
            ...applyBillingSettingsToFee(normalizeFee({
              studentId: "student-1",
              concept: "Cuota mensual 03/2026 - Freestyle",
              disciplineName: "Freestyle",
              amount: 20000,
              paidAmount: 10000,
              dueDate: "2026-03-08"
            }), {
              defaultDueDay: 10,
              lateFeeEnabled: true,
              lateFeeStartsAfterDays: 3,
              lateFeeType: "fixed",
              lateFeeValue: 2500
            })
          },
          {
            id: "fee-2",
            ...applyBillingSettingsToFee(normalizeFee({
              studentId: "student-2",
              concept: "Cuota mensual 03/2026 - Breaking",
              disciplineName: "Breaking",
              amount: 18000,
              paidAmount: 0,
              dueDate: "2026-03-03"
            }), DEFAULT_ACADEMY_BILLING_SETTINGS)
          }
        ]);
        return;
      }

      if (!academyPath) return;
      const [academySnap, studentsSnap, feesSnap] = await Promise.all([
        getDoc(doc(db, "academies", membership!.academyId)),
        getDocs(query(collection(db, `${academyPath}/students`), orderBy("fullName", "asc"))),
        getDocs(query(collection(db, `${academyPath}/fees`), orderBy("dueDate", "asc")))
      ]);
      const billingSettings = normalizeAcademyBillingSettings(academySnap.exists() ? academySnap.data().billingSettings : undefined);

      setStudents(
        studentsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          fullName: String(docSnap.data().fullName ?? "Alumno"),
          status: (docSnap.data().status as StudentOption["status"]) ?? "active"
        }))
      );
      setFees(
        feesSnap.docs.map((docSnap) => {
          const normalizedFee = normalizeFee(docSnap.data() as Omit<Fee, "id">);
          return {
            id: docSnap.id,
            ...applyBillingSettingsToFee(normalizedFee, billingSettings)
          };
        })
      );
    }

    void loadData();
  }, [academyPath, isPreviewMode]);

  const urgentFees = useMemo(() => {
    return fees
      .filter((fee) => {
        const student = students.find((item) => item.id === fee.studentId);
        if (!student || student.status !== "active") return false;
        const daysLeft = diffDays(fee.dueDate);
        return daysLeft <= 15;
      })
      .map((fee) => {
        const student = students.find((item) => item.id === fee.studentId);
        const daysLeft = diffDays(fee.dueDate);
        const daysOverdue = getDaysOverdue(fee.dueDate);
        return {
          ...fee,
          studentName: student?.fullName ?? fee.studentId,
          daysLeft,
          daysOverdue
        };
      })
      .sort((a, b) => compareFeePriority(a, b) || a.studentName.localeCompare(b.studentName, "es", { sensitivity: "base" }));
  }, [fees, students]);

  return (
    <Panel
      title="Vencimientos"
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
        <p className="font-semibold text-text">Se muestran cuotas que ya vencieron o vencen en los proximos 15 dias.</p>
        <p className="mt-1 text-muted">
          El orden prioriza primero las cuotas con mas dias de mora y saldo, luego las proximas a vencer y al final las que ya no deben nada.
        </p>
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
            </tr>
          </thead>
          <tbody>
            {urgentFees.map((fee) => (
              <tr key={fee.id} className="border-t border-slate-800">
                <td className="px-3 py-3">
                  <PriorityBadge daysLeft={fee.daysLeft} daysOverdue={fee.daysOverdue} />
                </td>
                <td className="px-3 py-3">{fee.studentName}</td>
                <td className="px-3 py-3 text-muted">{fee.disciplineName ?? fee.concept}</td>
                <td className="px-3 py-3 text-primary">${fee.amount}</td>
                <td className="px-3 py-3 text-secondary">${fee.paidAmount}</td>
                <td className="px-3 py-3 font-semibold text-warning">${fee.balance}</td>
                <td className="px-3 py-3 text-muted">{fee.dueDate}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-brand px-2 py-1 text-xs font-semibold ${
                      fee.status === "paid"
                        ? "bg-secondary/15 text-secondary"
                        : fee.status === "overdue"
                        ? "bg-danger/15 text-danger"
                        : fee.status === "partial"
                          ? "bg-primary/15 text-primary"
                          : "bg-warning/15 text-warning"
                    }`}
                  >
                    {formatMembershipStatus(fee.status)}
                  </span>
                </td>
              </tr>
            ))}
            {urgentFees.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={8}>
                  No hay cuotas urgentes para seguir hoy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
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
