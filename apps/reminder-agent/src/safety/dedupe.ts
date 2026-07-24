/**
 * Idempotency / duplicate protection. A reminder is uniquely keyed by school +
 * student + due amount + message. The engine records completed keys locally so a
 * crash-resume never re-sends the same reminder, and warns on same-number sends
 * within one run.
 */
import type { QueueItem } from '../types.js';
import { cleanPhone } from '../validation.js';

export function createReminderKey(input: {
  schoolId: string;
  studentId: string;
  dueAmount: number;
  message: string;
}): string {
  return [input.schoolId, input.studentId, input.dueAmount, input.message].join(':');
}

export function reminderKeyFor(item: QueueItem, schoolId: string, message: string): string {
  return createReminderKey({
    schoolId,
    studentId: item.studentId ?? item.id,
    dueAmount: Number(item.dueAmount ?? item.totalDue ?? 0),
    message,
  });
}

/** Tracks keys and phone numbers already handled this run. */
export class DedupeTracker {
  private readonly keys = new Set<string>();
  private readonly phones = new Set<string>();

  constructor(completedKeys: string[] = []) {
    for (const k of completedKeys) this.keys.add(k);
  }

  hasKey(key: string): boolean {
    return this.keys.has(key);
  }

  phoneSeen(phone: string | undefined): boolean {
    return this.phones.has(cleanPhone(phone));
  }

  markDone(key: string, phone: string | undefined): void {
    this.keys.add(key);
    const p = cleanPhone(phone);
    if (p) this.phones.add(p);
  }

  get completedKeys(): string[] {
    return [...this.keys];
  }
}
