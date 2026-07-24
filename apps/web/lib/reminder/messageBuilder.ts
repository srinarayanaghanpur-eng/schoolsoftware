import type { FeeBreakupItem } from "@sri-narayana/shared";

export function cleanPhoneNumber(number: string): string {
  return String(number || "").replace(/\D/g, "").replace(/^0+/, "");
}

export function isValidMobile(number: string): boolean {
  const cleaned = cleanPhoneNumber(number);
  return cleaned.length === 10;
}

export function getIndianPhoneForWhatsApp(number: string): string {
  const cleaned = cleanPhoneNumber(number);
  if (!cleaned) return "";
  return cleaned.length === 10 ? `91${cleaned}` : cleaned;
}

export function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export type MessageInput = {
  parentName?: string;
  studentName?: string;
  className?: string;
  section?: string;
  dueAmount: number;
  feeType?: string;
  feeBreakup?: FeeBreakupItem[];
  totalDue?: number;
  schoolName?: string;
  supportPhone?: string;
};

export function buildFeeReminderMessage(input: MessageInput): string {
  const parentName = input.parentName?.trim() || "Parent";
  const studentName = input.studentName || "Student";
  const sectionText = input.section ? `-${input.section}` : "";
  const className = `${input.className || ""}${sectionText}`;
  const schoolName = input.schoolName || "Sri Narayana High School";
  const supportPhone = input.supportPhone || "";

  let body: string;

  if (input.feeBreakup && input.feeBreakup.length > 1) {
    const breakupLines = input.feeBreakup
      .map((item) => `  ${item.feeType}: ${formatCurrency(item.dueAmount)}`)
      .join("\n");
    const total = input.totalDue || input.dueAmount;
    body = `Fee due for ${studentName} of Class ${className}:\n${breakupLines}\n  Total Due: ${formatCurrency(total)}`;
  } else {
    const feeType = input.feeType || "Fee";
    body = `Fee due for ${studentName} of Class ${className} is ${formatCurrency(input.dueAmount)} for ${feeType}.`;
  }

  const message = [
    `Dear ${parentName},`,
    `This is a fee reminder from ${schoolName}.`,
    body,
    "Kindly clear the due amount as early as possible.",
    supportPhone ? `For queries, contact: ${supportPhone}` : "",
    "",
    `Thank you,`,
    schoolName
  ]
    .filter(Boolean)
    .join("\n");

  return message;
}

export function getChannelFromPriority(
  priority: string,
  primary: "whatsapp" | "sms",
  fallback?: "whatsapp" | "sms"
): { primary: "whatsapp" | "sms"; fallback: "whatsapp" | "sms" | null } {
  switch (priority) {
    case "whatsapp_first_sms_fallback":
      return { primary: "whatsapp", fallback: "sms" };
    case "sms_first_whatsapp_fallback":
      return { primary: "sms", fallback: "whatsapp" };
    case "whatsapp_only":
      return { primary: "whatsapp", fallback: null };
    case "sms_only":
      return { primary: "sms", fallback: null };
    default:
      return { primary, fallback: fallback || null };
  }
}
