/**
 * Bus EMI / Vehicle Finance — shared client/server types.
 *
 * This module manages monthly EMI repayments for school buses/vehicles bought
 * on finance. It is completely separate from the student transport fee module.
 */

export type BusFinanceStatus = "active" | "emi_due" | "paid_this_month" | "overdue" | "completed" | "closed";
export type EmiPaymentStatus = "upcoming" | "due" | "paid" | "partial" | "overdue" | "waived";
export type EmiPaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "auto_debit" | "other";

export interface BusFinance {
  id: string;
  vehicleName: string;
  vehicleNumber: string;
  financeCompany: string;
  loanAccountNumber: string;
  loanStartDate: string; // ISO date (yyyy-mm-dd)
  loanEndDate: string; // ISO date (yyyy-mm-dd)
  totalLoanAmount: number;
  downPayment: number;
  emiAmount: number;
  emiDueDay: number; // 1–31, day of month the EMI is due
  totalEmis: number;
  paidEmis: number;
  pendingEmis: number;
  totalAmountPaid?: number;
  outstandingPrincipal?: number;
  nextEmiDueDate?: string | null;
  principalPaid?: number;
  interestPaid?: number;
  interestRate?: number;
  status: BusFinanceStatus;
  notes?: string;
  documentUrls?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusEmiPayment {
  id: string;
  busFinanceId: string;
  vehicleNumber: string;
  emiNumber: number;
  emiMonth: string; // e.g. "2026-07"
  dueDate: string; // ISO date
  emiAmount: number;
  openingBalance?: number;
  principalComponent?: number;
  interestComponent?: number;
  closingBalance?: number;
  paidAmount: number;
  paymentDate?: string;
  paymentMode?: EmiPaymentMode;
  bankAccount?: string;
  transactionId?: string;
  proofUrl?: string;
  status: EmiPaymentStatus;
  lateFee?: number;
  remarks?: string;
  expenseId?: string;
  createdBy?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusFinanceSummary {
  totalActiveLoans: number;
  totalLoanAmount: number;
  totalEmiPaid: number;
  totalEmiPending: number;
  currentMonthDue: number;
  overdueAmount: number;
  nextDueDate: string | null;
}

export const EMI_PAYMENT_MODES: { value: EmiPaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "auto_debit", label: "Auto Debit" },
  { value: "other", label: "Other" },
];

export const BUS_FINANCE_STATUSES: BusFinanceStatus[] = ["active", "emi_due", "paid_this_month", "overdue", "completed", "closed"];

// ===== Daily KM Logs =====
export interface DailyKmLog {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  date: string;
  startOdometer: number;
  endOdometer: number;
  kmRun: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ===== Maintenance Logs =====
export type MaintenanceType = "service" | "repair" | "parts" | "other";

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  date: string;
  type: MaintenanceType;
  description?: string;
  cost: number;
  mechanic?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Repair" },
  { value: "parts", label: "Parts" },
  { value: "other", label: "Other" },
];

// ===== Insurance Records =====
export interface InsuranceRecord {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  provider: string;
  policyNo?: string;
  premium: number;
  startDate: string;
  renewalDate: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ===== Drivers =====
export interface Driver {
  id: string;
  name: string;
  phone?: string;
  salary?: number;
  licenseExpiry?: string;
  vehicleId?: string;
  vehicleRegNo?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ===== Fuel Logs =====
export interface FuelLog {
  id: string;
  vehicleId: string;
  vehicleRegNo?: string;
  date: string;
  liters: number;
  costPerLiter: number;
  totalCost: number;
  odometerReading?: number;
  station?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
