import { z } from "zod";
import type { MasterConfig, MasterField } from "@/lib/masterConfig";

function fieldSchema(field: MasterField): z.ZodTypeAny {
  if (field.type === "boolean") {
    return field.required ? z.boolean() : z.boolean().optional();
  }
  if (field.type === "number") {
    const base = z.coerce.number().min(field.min ?? 0).max(field.max ?? 1_000_000_000);
    return field.required ? base : base.optional();
  }
  if (field.type === "select") {
    const values = (field.options ?? []).map((option) => option.value);
    const enumSchema = z.enum(values as [string, ...string[]]);
    return field.required ? enumSchema : enumSchema.optional();
  }
  if (field.type === "date") {
    const base = z.string().trim().min(8);
    return field.required ? base : base.optional();
  }
  const base = z.string().trim().max(field.max ?? (field.type === "textarea" ? 2000 : 200));
  return field.required ? base.min(1, `${field.label} is required`) : base.optional();
}

export function buildMasterSchema(config: MasterConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of config.fields) {
    shape[field.key] = fieldSchema(field);
  }
  return z.object(shape);
}
