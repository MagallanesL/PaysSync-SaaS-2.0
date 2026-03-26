import type { AcademyPlan, AcademyRole } from "./types";

export function formatAcademyPlan(plan: AcademyPlan | string) {
  switch (plan) {
    case "basic":
      return "Basico";
    case "pro":
      return "Pro";
    case "premium":
      return "Premium";
    default:
      return String(plan ?? "");
  }
}

export function formatAcademyRole(role: AcademyRole | string) {
  switch (role) {
    case "owner":
      return "Propietario";
    case "staff":
      return "Personal";
    case "viewer":
      return "Visualizador";
    default:
      return String(role ?? "");
  }
}

export function formatMembershipStatus(status: string) {
  switch (String(status ?? "").toLowerCase()) {
    case "active":
      return "Activo";
    case "inactive":
      return "Inactivo";
    case "trial":
      return "Prueba";
    case "suspended":
      return "Suspendido";
    case "pending":
      return "Pendiente";
    case "partial":
      return "Parcial";
    case "paid":
      return "Pagada";
    case "overdue":
      return "Vencida";
    default:
      return String(status ?? "");
  }
}

export function formatBillingType(type: string) {
  switch (type) {
    case "monthly_fee":
      return "Disciplina mensual";
    case "enrollment":
      return "Matricula";
    case "uniform":
      return "Indumentaria";
    case "product":
      return "Producto";
    case "exam":
      return "Examen";
    case "other":
      return "Otro";
    default:
      return String(type ?? "");
  }
}

export function formatPaymentMethod(method: string) {
  switch (String(method ?? "").toLowerCase()) {
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    case "card":
      return "Tarjeta";
    default:
      return String(method ?? "");
  }
}
