export function formatCurrencyINR(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const lakh = Math.floor(abs / 100000);
  const thousand = Math.floor((abs % 100000) / 1000);
  const hundred = abs % 1000;
  let formatted = "";
  if (lakh > 0) {
    formatted += `${lakh},`;
    if (thousand > 0) {
      formatted += `${String(thousand).padStart(2, "0")},`;
    } else {
      formatted += "00,";
    }
    formatted += String(hundred).padStart(3, "0");
  } else if (thousand > 0) {
    formatted += `${thousand},${String(hundred).padStart(3, "0")}`;
  } else {
    formatted += String(hundred);
  }
  return `${sign}₹${formatted}`;
}
