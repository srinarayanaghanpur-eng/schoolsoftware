/**
 * Utility functions for class name conversions
 */

export function getClassDisplayName(classCode: string | number): string {
  const classMap: { [key: string]: string } = {
    "1": "I",
    "2": "II",
    "3": "III",
    "4": "IV",
    "5": "V",
    "6": "VI",
    "7": "VII",
    "8": "VIII",
    "9": "IX",
    "10": "X",
    "11": "XI",
    "12": "XII",
    "Nur": "Nursery",
    "KG": "KG",
    "nur": "Nursery",
    "kg": "KG"
  };

  const key = String(classCode).trim();
  return classMap[key] || key;
}

export function getClassLabel(classCode: string | number): string {
  return getClassDisplayName(classCode);
}

export function formatClassRange(): string {
  return "Nur to X";
}
