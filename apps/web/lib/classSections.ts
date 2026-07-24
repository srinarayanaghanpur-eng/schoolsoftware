// Shared helpers for the per-class section configuration stored in
// settings/classSections → { sections: { [classId]: ["A", "B", ...] } }.

export const CLASS_SECTION_SETTINGS_DOC = "classSections";
export const CLASS_IDS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const DEFAULT_SECTIONS = ["A", "B"];
export const MAX_SECTIONS_PER_CLASS = 8;

export function defaultSectionsByClass(): Record<string, string[]> {
  return CLASS_IDS.reduce<Record<string, string[]>>((acc, id) => {
    acc[id] = [...DEFAULT_SECTIONS];
    return acc;
  }, {});
}

export function normalizeSection(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().slice(0, 3);
}

export function sanitizeSections(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = Array.from(new Set(value.map(normalizeSection).filter((s) => /^[A-Z][A-Z0-9]{0,2}$/.test(s))));
  if (cleaned.length === 0 || cleaned.length > MAX_SECTIONS_PER_CLASS) return null;
  return cleaned.sort();
}
