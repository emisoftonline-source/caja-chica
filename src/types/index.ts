export type UserRole = "superadmin" | "admin" | "cajero";
export type PeriodEstado = "abierto" | "cerrado";
export type TipoPago = "efectivo" | "qr" | "cheque";
export type ExpenseEstado = "activo" | "anulado";

export interface Company {
  id: string;
  nombre: string;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashPeriod {
  id: string;
  company_id: string;
  nombre: string;
  periodo_mes: string;
  estado: PeriodEstado;
  created_at: string;
  closed_at: string | null;
}

export interface FundEntry {
  id: string;
  company_id: string;
  period_id: string;
  monto: number;
  detalle: string;
  created_by: string | null;
  created_at: string;
  usuario_nombre?: string;
}

export interface Expense {
  id: string;
  company_id: string;
  period_id: string;
  persona: string;
  motivo: string;
  monto: number;
  tipo_pago: TipoPago;
  estado: ExpenseEstado;
  entregado_nombre: string | null;
  entregado_ci: string | null;
  recibido_nombre: string | null;
  recibido_ci: string | null;
  editado: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
}

export interface MonthlyClosure {
  id: string;
  company_id: string;
  period_id: string;
  fondos_total: number;
  gastado_total: number;
  saldo_devuelto: number;
  cerrado_por: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Super Administrador",
  admin: "Administrador",
  cajero: "Cajero",
};

export const TIPO_PAGO_LABELS: Record<TipoPago, string> = {
  efectivo: "Efectivo",
  qr: "QR",
  cheque: "Cheque",
};
