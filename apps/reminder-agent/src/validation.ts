/** Per-item validation performed before every send. Invalid items are skipped. */
import type { QueueItem } from './types.js';
import { dueAmountOf } from './messageTemplate.js';

/** Strip non-digits and a leading country code / zeros → national 10-digit. */
export function cleanPhone(raw: string | undefined): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function isValidMobile(raw: string | undefined): boolean {
  return normalizeIndianPhoneNumber(raw) !== null;
}

/**
 * Normalize an Indian mobile number to `+91XXXXXXXXXX`, or null if invalid.
 * Accepts 10-digit (6-9 leading) and 91-prefixed 12-digit forms.
 */
export function normalizeIndianPhoneNumber(input: string | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Format for Google Messages "To" field (India). Falls back to raw digits. */
export function toDialFormat(raw: string | undefined): string {
  return normalizeIndianPhoneNumber(raw) ?? cleanPhone(raw);
}

/** Last-10-digits comparison, used to verify the opened conversation. */
export function normalizeForComparison(value: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

export function numbersMatch(expected: string, actual: string): boolean {
  const e = normalizeForComparison(expected);
  const a = normalizeForComparison(actual);
  return e.length === 10 && e === a;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  phone: string;
}

export function validateItem(
  item: QueueItem,
  message: string,
  opts: { skipAlreadySent: boolean },
): ValidationResult {
  const phone = toDialFormat(item.mobile);

  if (opts.skipAlreadySent && item.status === 'sent') {
    return { ok: false, reason: 'Already sent', phone };
  }
  if (dueAmountOf(item) <= 0) {
    return { ok: false, reason: 'Due amount is 0 (paid)', phone };
  }
  if (!item.mobile || !isValidMobile(item.mobile)) {
    return { ok: false, reason: 'Invalid or missing parent number', phone };
  }
  if (!message || !message.trim()) {
    return { ok: false, reason: 'Empty message', phone };
  }
  return { ok: true, phone };
}

/** Find duplicate phone numbers across the queue (returns the duplicate set). */
export function findDuplicatePhones(items: QueueItem[]): Set<string> {
  const seen = new Map<string, number>();
  for (const it of items) {
    const p = cleanPhone(it.mobile);
    if (!p) continue;
    seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [p, n] of seen) if (n > 1) dups.add(p);
  return dups;
}
