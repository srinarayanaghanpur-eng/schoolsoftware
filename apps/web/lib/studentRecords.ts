import { z } from "zod";

export const STUDENT_RECORD_KINDS = ["behavior", "health", "exits"] as const;
export type StudentRecordKind = (typeof STUDENT_RECORD_KINDS)[number];

export const STUDENT_RECORD_META: Record<
  StudentRecordKind,
  { collection: string; title: string; description: string }
> = {
  behavior: {
    collection: "student_behavior",
    title: "Behavior Records",
    description: "Log positive notes and disciplinary incidents with the action taken."
  },
  health: {
    collection: "student_health",
    title: "Health Records",
    description: "Medical profile, allergies and last check-up for each student."
  },
  exits: {
    collection: "student_exits",
    title: "TC & Exit",
    description: "Track transfer certificate requests, last working day and exit status."
  }
};

export function isStudentRecordKind(value: string): value is StudentRecordKind {
  return (STUDENT_RECORD_KINDS as readonly string[]).includes(value);
}

const base = {
  studentId: z.string().trim().min(1),
  studentName: z.string().trim().min(1).max(160),
  admissionNumber: z.string().trim().max(40).optional().default(""),
  className: z.string().trim().max(50).optional().default("")
};

export const behaviorSchema = z.object({
  ...base,
  type: z.enum(["positive", "negative"]).default("positive"),
  category: z.string().trim().max(80).optional().default("General"),
  description: z.string().trim().min(1).max(1000),
  actionTaken: z.string().trim().max(500).optional().default(""),
  date: z.string().trim().min(8)
});

export const healthSchema = z.object({
  ...base,
  bloodGroup: z.string().trim().max(10).optional().default(""),
  allergies: z.string().trim().max(500).optional().default(""),
  conditions: z.string().trim().max(500).optional().default(""),
  lastCheckup: z.string().trim().max(30).optional().default(""),
  notes: z.string().trim().max(1000).optional().default("")
});

export const exitSchema = z.object({
  ...base,
  reason: z.enum(["transfer", "graduation", "relocation", "other"]).default("transfer"),
  lastDay: z.string().trim().min(8),
  tcNumber: z.string().trim().max(40).optional().default(""),
  status: z.enum(["requested", "approved", "completed"]).default("requested"),
  notes: z.string().trim().max(1000).optional().default("")
});

export const STUDENT_RECORD_SCHEMAS = {
  behavior: behaviorSchema,
  health: healthSchema,
  exits: exitSchema
} as const;
