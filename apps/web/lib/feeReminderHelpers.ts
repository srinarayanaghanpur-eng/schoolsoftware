export type ReminderStudentMessageInput = {
  studentName?: string;
  parentName?: string;
  className?: string;
  sectionName?: string;
};

export type SelectedFeeTypeDue = {
  feeType: string;
  dueAmount: number;
};

export function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function cleanPhoneNumber(number: string) {
  return String(number || "").replace(/\D/g, "").replace(/^0+/, "");
}

export function getIndianPhoneForWhatsApp(number: string) {
  const cleaned = cleanPhoneNumber(number);
  if (!cleaned) return "";
  return cleaned.length === 10 ? `91${cleaned}` : cleaned;
}

export function buildFeeReminderMessage(student: ReminderStudentMessageInput, selectedFeeTypeDue: SelectedFeeTypeDue) {
  const parentName = student.parentName?.trim() || "Parent";
  const className = `${student.className ?? ""}${student.sectionName ?? ""}`;

  return `Dear Parent,
This is a fee reminder from Sri Narayana High School.

Student Name: ${student.studentName ?? ""}
Parent Name: ${parentName}
Class: ${className}
Fee Type: ${selectedFeeTypeDue.feeType}
Pending Amount: ${formatCurrency(selectedFeeTypeDue.dueAmount)}

Kindly pay the pending fee as early as possible.

Thank you,
Sri Narayana High School`;
}

export function openWhatsAppReminder(parentMobile: string, message: string) {
  const mobileWithCountryCode = getIndianPhoneForWhatsApp(parentMobile);
  if (!mobileWithCountryCode || typeof window === "undefined") return false;
  window.open(`https://wa.me/${mobileWithCountryCode}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  return true;
}

export async function openGoogleMessagesReminder(parentMobile: string, message: string) {
  if (!cleanPhoneNumber(parentMobile) || typeof window === "undefined") return false;
  await navigator.clipboard.writeText(message);
  window.open("https://messages.google.com/web/conversations", "_blank", "noopener,noreferrer");
  return true;
}
