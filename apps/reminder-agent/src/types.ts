/** Shared types for the reminder agent. */
import type { ErrorCode } from './errors.js';

/**
 * How the engine finishes each item:
 *  - review_each : fill everything, pause for operator confirm, then send (default)
 *  - prepare_only: fill everything, never click Send (admin sends manually)
 *  - automatic   : send with no per-message confirmation (gated, highest risk)
 */
export type SendMode = 'review_each' | 'prepare_only' | 'automatic';

/** A single reminder queue item, as stored in Firestore `fee_reminder_queue`. */
export interface QueueItem {
  id: string;
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  parentName?: string;
  /** Parent mobile number (raw; may contain spaces/+91). */
  mobile?: string;
  alternateMobile?: string;
  feeType?: string;
  totalDue?: number;
  dueAmount?: number;
  dueDate?: string;
  schoolName?: string;
  supportPhone?: string;
  /** Pre-generated message (if the ERP already rendered it); else agent renders. */
  message?: string;
  channel?: string;
  status: QueueItemStatus;
  attempts?: number;
  scheduledAt?: string;
  sentAt?: string;
}

export type QueueItemStatus =
  | 'pending'
  | 'approved' // marked ready for the agent by the admin's "Start Sending"
  | 'queued'
  | 'sending'
  | 'prepared' // filled in Google Messages but not sent (prepare_only / skipped)
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'interrupted' // emergency-stopped mid-item
  | 'deferred'; // over daily limit — send tomorrow

/** Agent runtime settings (merged from ERP settings + local .env). */
export interface AgentSettings {
  sendMode: SendMode;
  dailyLimitEnabled: boolean;
  dailyLimit: number; // default 300
  alreadySentToday: number;
  delayMinMs: number; // randomized human-like delay range
  delayMaxMs: number;
  pauseAfterEvery: number; // 0 = never
  pauseDurationMs: number;
  retryFailed: boolean;
  maxRetryCount: number;
  skipAlreadySent: boolean;
  messageTemplate: string;
  schoolName: string;
  supportPhone: string;
}

/** Per-item send outcome. */
export interface SendResult {
  id: string;
  status: 'sent' | 'prepared' | 'failed' | 'skipped' | 'interrupted';
  phone: string; // dial format (mask before logging)
  message: string;
  errorCode?: ErrorCode;
  error?: string;
  retryCount: number;
  at: string; // ISO
}

/** Persisted, crash-safe progress for resume. */
export interface ProgressState {
  runId: string;
  startedAt: string;
  updatedAt: string;
  total: number;
  processedIds: string[]; // ids already handled this run (any terminal status)
  completedKeys: string[]; // idempotency keys of completed sends (duplicate guard)
  results: SendResult[];
  sentToday: number;
  status: 'running' | 'paused' | 'stopped' | 'completed';
}

export type ControlCommand = 'pause' | 'resume' | 'stop';
