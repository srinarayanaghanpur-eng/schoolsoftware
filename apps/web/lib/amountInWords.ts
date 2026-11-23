const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      parts.push([TENS[ten], ONES[one]].filter(Boolean).join(" "));
    }
  }
  return parts.join(" ");
}

function integerToIndianWords(value: number): string {
  if (value === 0) return "Zero";
  const units: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"]
  ];
  let remaining = value;
  const parts: string[] = [];

  for (const [size, label] of units) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${integerToIndianWords(count)} ${label}`);
      remaining %= size;
    }
  }

  if (remaining > 0) parts.push(wordsBelowThousand(remaining));
  return parts.join(" ");
}

export function numberToIndianWords(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rupees = Math.floor(safeAmount);
  const paise = Math.round((safeAmount - rupees) * 100);
  const rupeeWords = `${integerToIndianWords(rupees)} Rupees`;
  if (paise > 0) return `${rupeeWords} and ${integerToIndianWords(paise)} Paise Only`;
  return `${rupeeWords} Only`;
}
