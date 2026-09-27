// Shared per-class selector config used by /admin/students (overview) and
// /admin/students/[classId]. Kept out of page files because Next.js only
// allows specific named exports from route files.

export type ClassAgeGroup = "toddler" | "early-years" | "primary" | "upper-primary" | "pre-teen" | "teen";
export type ChildIconVariant = "baby" | "tiny" | "kindergarten" | "primary" | "senior-primary" | "preteen" | "teen";

export type StudentClassCardConfig = {
  id: string;
  label: string;
  ageGroup: ClassAgeGroup;
  icon: ChildIconVariant;
  availableSections: string[];
  accent: {
    border: string;
    activeBorder: string;
    background: string;
    activeBackground: string;
    text: string;
    ring: string;
    select: string;
  };
};

// Static fallback only; the live per-class lists come from settings/classSections (default A/B).
export const SECTION_OPTIONS = ["A", "B"];

export const CLASS_SELECTOR_CLASSES: StudentClassCardConfig[] = [
  {
    id: "Nur",
    label: "Nursery",
    ageGroup: "toddler",
    icon: "baby",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffd8c7]",
      activeBorder: "border-[#f08a65]",
      background: "bg-[#fff8f3]",
      activeBackground: "bg-[#fff0e8]",
      text: "text-[#b75f37]",
      ring: "shadow-[0_14px_34px_rgba(240,138,101,0.20)]",
      select: "focus:border-[#f08a65] focus:ring-[#f08a65]/20"
    }
  },
  {
    id: "LKG",
    label: "LKG",
    ageGroup: "early-years",
    icon: "tiny",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffe2a9]",
      activeBorder: "border-[#e5a52f]",
      background: "bg-[#fffaf0]",
      activeBackground: "bg-[#fff3d9]",
      text: "text-[#a66c09]",
      ring: "shadow-[0_14px_34px_rgba(229,165,47,0.20)]",
      select: "focus:border-[#e5a52f] focus:ring-[#e5a52f]/20"
    }
  },
  {
    id: "UKG",
    label: "UKG",
    ageGroup: "early-years",
    icon: "kindergarten",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#cdeec9]",
      activeBorder: "border-[#55ad62]",
      background: "bg-[#f6fff5]",
      activeBackground: "bg-[#ebfae8]",
      text: "text-[#2e7d39]",
      ring: "shadow-[0_14px_34px_rgba(85,173,98,0.20)]",
      select: "focus:border-[#55ad62] focus:ring-[#55ad62]/20"
    }
  },
  {
    id: "1",
    label: "Class 1",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#c8e6ff]",
      activeBorder: "border-[#4b96d8]",
      background: "bg-[#f4fbff]",
      activeBackground: "bg-[#eaf6ff]",
      text: "text-[#246ba7]",
      ring: "shadow-[0_14px_34px_rgba(75,150,216,0.20)]",
      select: "focus:border-[#4b96d8] focus:ring-[#4b96d8]/20"
    }
  },
  {
    id: "2",
    label: "Class 2",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#d8d9ff]",
      activeBorder: "border-[#7370dc]",
      background: "bg-[#f8f8ff]",
      activeBackground: "bg-[#eeeeff]",
      text: "text-[#4f4bae]",
      ring: "shadow-[0_14px_34px_rgba(115,112,220,0.20)]",
      select: "focus:border-[#7370dc] focus:ring-[#7370dc]/20"
    }
  },
  {
    id: "3",
    label: "Class 3",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#f2cfef]",
      activeBorder: "border-[#c765bb]",
      background: "bg-[#fff6fe]",
      activeBackground: "bg-[#faeafa]",
      text: "text-[#96398e]",
      ring: "shadow-[0_14px_34px_rgba(199,101,187,0.20)]",
      select: "focus:border-[#c765bb] focus:ring-[#c765bb]/20"
    }
  },
  {
    id: "4",
    label: "Class 4",
    ageGroup: "upper-primary",
    icon: "senior-primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#c8eadf]",
      activeBorder: "border-[#36a988]",
      background: "bg-[#f4fffb]",
      activeBackground: "bg-[#e7faf3]",
      text: "text-[#18765e]",
      ring: "shadow-[0_14px_34px_rgba(54,169,136,0.20)]",
      select: "focus:border-[#36a988] focus:ring-[#36a988]/20"
    }
  },
  {
    id: "5",
    label: "Class 5",
    ageGroup: "upper-primary",
    icon: "senior-primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#fed4dc]",
      activeBorder: "border-[#e65b73]",
      background: "bg-[#fff7f8]",
      activeBackground: "bg-[#ffeef2]",
      text: "text-[#b33b51]",
      ring: "shadow-[0_14px_34px_rgba(230,91,115,0.20)]",
      select: "focus:border-[#e65b73] focus:ring-[#e65b73]/20"
    }
  },
  {
    id: "6",
    label: "Class 6",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#cde3ff]",
      activeBorder: "border-[#407fd2]",
      background: "bg-[#f6faff]",
      activeBackground: "bg-[#eaf3ff]",
      text: "text-[#245ca4]",
      ring: "shadow-[0_14px_34px_rgba(64,127,210,0.20)]",
      select: "focus:border-[#407fd2] focus:ring-[#407fd2]/20"
    }
  },
  {
    id: "7",
    label: "Class 7",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#d7edd2]",
      activeBorder: "border-[#70aa4e]",
      background: "bg-[#f7fff3]",
      activeBackground: "bg-[#edf9e8]",
      text: "text-[#4f7f2f]",
      ring: "shadow-[0_14px_34px_rgba(112,170,78,0.20)]",
      select: "focus:border-[#70aa4e] focus:ring-[#70aa4e]/20"
    }
  },
  {
    id: "8",
    label: "Class 8",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#e0d5ff]",
      activeBorder: "border-[#8a69de]",
      background: "bg-[#faf7ff]",
      activeBackground: "bg-[#f1ecff]",
      text: "text-[#6045b1]",
      ring: "shadow-[0_14px_34px_rgba(138,105,222,0.20)]",
      select: "focus:border-[#8a69de] focus:ring-[#8a69de]/20"
    }
  },
  {
    id: "9",
    label: "Class 9",
    ageGroup: "teen",
    icon: "teen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#bfe7ec]",
      activeBorder: "border-[#2696a6]",
      background: "bg-[#f3fdff]",
      activeBackground: "bg-[#e4f8fb]",
      text: "text-[#167384]",
      ring: "shadow-[0_14px_34px_rgba(38,150,166,0.20)]",
      select: "focus:border-[#2696a6] focus:ring-[#2696a6]/20"
    }
  },
  {
    id: "10",
    label: "Class 10",
    ageGroup: "teen",
    icon: "teen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffd0b9]",
      activeBorder: "border-[#df7144]",
      background: "bg-[#fff7f2]",
      activeBackground: "bg-[#ffede3]",
      text: "text-[#a64d26]",
      ring: "shadow-[0_14px_34px_rgba(223,113,68,0.20)]",
      select: "focus:border-[#df7144] focus:ring-[#df7144]/20"
    }
  }
];

export const CLASS_OPTIONS = CLASS_SELECTOR_CLASSES.map((classItem) => classItem.id);

export const CLASS_LABELS: Record<string, string> = CLASS_SELECTOR_CLASSES.reduce<Record<string, string>>((labels, classItem) => {
  labels[classItem.id] = classItem.label;
  return labels;
}, {});

// Per-class page slugs look like /admin/students/class-1. Both the full
// slug ("class-1") and the raw id ("1", "nur") resolve to the canonical id.
export function classIdToSlug(id: string): string {
  return `class-${id.toLowerCase()}`;
}

export function slugToClassId(slug: string): string | null {
  const normalized = decodeURIComponent(slug).toLowerCase();
  const raw = normalized.startsWith("class-") ? normalized.slice("class-".length) : normalized;
  return CLASS_OPTIONS.find((id) => id.toLowerCase() === raw) ?? null;
}
