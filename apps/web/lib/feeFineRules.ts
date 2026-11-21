import { z } from "zod";

export const FEE_FINE_SCOPES = ["late_payment", "overdue_installment"] as const;
export const FEE_FINE_TYPES = ["flat", "percent"] as const;
export const FEE_FINE_FREQUENCIES = ["one_time", "per_day", "per_month"] as const;

export const FEE_FINE_SCOPE_LABELS: Record<(typeof FEE_FINE_SCOPES)[number], string> = {
  late_payment: "Late payment",
  overdue_installment: "Overdue installment"
};

export const FEE_FINE_TYPE_LABELS: Record<(typeof FEE_FINE_TYPES)[number], string> = {
  flat: "Flat amount",
  percent: "Percent of due"
};

export const FEE_FINE_FREQUENCY_LABELS: Record<(typeof FEE_FINE_FREQUENCIES)[number], string> = {
  one_time: "One time",
  per_day: "Per day",
  per_month: "Per month"
};

const feeFineRuleBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(FEE_FINE_SCOPES).default("late_payment"),
  graceDays: z.coerce.number().int().min(0).max(90).default(0),
  fineType: z.enum(FEE_FINE_TYPES).default("flat"),
  amount: z.coerce.number().min(0).max(1000000),
  frequency: z.enum(FEE_FINE_FREQUENCIES).default("one_time"),
  maxFine: z.coerce.number().min(0).max(1000000).default(0),
  academicYearId: z.string().trim().max(100).optional().default(""),
  active: z.boolean().default(true)
});

function percentCapRefine(value: { fineType?: string; amount?: number }) {
  return value.fineType !== "percent" || value.amount === undefined || value.amount <= 100;
}

const percentCapOptions = { message: "Percentage fine cannot exceed 100", path: ["amount"] };

export const feeFineRuleSchema = feeFineRuleBaseSchema.refine(percentCapRefine, percentCapOptions);

export const feeFineRuleUpdateSchema = feeFineRuleBaseSchema.partial().refine(percentCapRefine, percentCapOptions);

export type FeeFineRuleInput = z.infer<typeof feeFineRuleSchema>;

export type FeeFineRule = FeeFineRuleInput & {
  id: string;
  schoolId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** Fine payable for a given number of days late; 0 when inside the grace window. */
export function computeFine(rule: FeeFineRuleInput, daysLate: number, dueAmount: number): number {
  const effectiveDays = Math.max(0, daysLate - rule.graceDays);
  if (effectiveDays === 0) return 0;

  const base = rule.fineType === "percent" ? (dueAmount * rule.amount) / 100 : rule.amount;
  let total = base;
  if (rule.frequency === "per_day") total = base * effectiveDays;
  if (rule.frequency === "per_month") total = base * Math.ceil(effectiveDays / 30);

  const capped = rule.maxFine > 0 ? Math.min(total, rule.maxFine) : total;
  return Math.round(capped * 100) / 100;
}
