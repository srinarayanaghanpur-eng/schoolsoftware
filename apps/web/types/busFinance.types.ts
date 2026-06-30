/**
 * Bus EMI / Vehicle Finance — shared client/server types.
 *
 * This module manages monthly EMI repayments for school buses/vehicles bought
 * on finance. It is completely separate from the student transport fee module.
 */

export type BusFinanceStatus = "active" | "closed" | "overdue" | "cancelled";
export type EmiPaymentStatus = "pending" | "paid" | "partial" | "overdue";
export type EmiPaymentMode = "cash" | "bank_transfer" | "upi" | "cheque" | "other";

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
  interestRate?: number;
  status: BusFinanceStatus;
  notes?: string;
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
  paidAmount: number;
  paymentDate?: string;
  paymentMode?: EmiPaymentMode;
  transactionId?: string;
  proofUrl?: string;
  status: EmiPaymentStatus;
  lateFee?: number;
  remarks?: string;
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
  { value: "other", label: "Other" },
];

export const BUS_FINANCE_STATUSES: BusFinanceStatus[] = ["active", "closed", "overdue", "cancelled"];
