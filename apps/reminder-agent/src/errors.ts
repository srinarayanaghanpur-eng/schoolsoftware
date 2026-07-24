/**
 * Standardized automation error codes. Every failure the engine can produce maps
 * to one of these so the ERP can react consistently (and so logs are greppable).
 *
 * Severity decides queue behaviour:
 *   'job'  → stop the ENTIRE job (selector drift, recipient mismatch, unknown send)
 *   'item' → mark this item failed and (optionally) continue to the next
 */
export const ErrorCode = {
  ENGINE_NOT_CONNECTED: 'ENGINE_NOT_CONNECTED',
  GOOGLE_MESSAGES_NOT_PAIRED: 'GOOGLE_MESSAGES_NOT_PAIRED',
  GOOGLE_MESSAGES_SELECTOR_CHANGED: 'GOOGLE_MESSAGES_SELECTOR_CHANGED',
  NEW_CONVERSATION_BUTTON_NOT_FOUND: 'NEW_CONVERSATION_BUTTON_NOT_FOUND',
  RECIPIENT_INPUT_NOT_FOUND: 'RECIPIENT_INPUT_NOT_FOUND',
  RECIPIENT_SUGGESTION_NOT_FOUND: 'RECIPIENT_SUGGESTION_NOT_FOUND',
  RECIPIENT_VERIFICATION_FAILED: 'RECIPIENT_VERIFICATION_FAILED',
  MESSAGE_INPUT_NOT_FOUND: 'MESSAGE_INPUT_NOT_FOUND',
  MESSAGE_CONTENT_MISMATCH: 'MESSAGE_CONTENT_MISMATCH',
  SEND_BUTTON_NOT_FOUND: 'SEND_BUTTON_NOT_FOUND',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',
  DUPLICATE_REMINDER: 'DUPLICATE_REMINDER',
  JOB_NOT_APPROVED: 'JOB_NOT_APPROVED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  BROWSER_CLOSED: 'BROWSER_CLOSED',
  PHONE_OFFLINE: 'PHONE_OFFLINE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_SEND_STATE: 'UNKNOWN_SEND_STATE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Errors that must halt the whole job (safety-critical ambiguity). */
export const JOB_FATAL_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  ErrorCode.GOOGLE_MESSAGES_SELECTOR_CHANGED,
  ErrorCode.NEW_CONVERSATION_BUTTON_NOT_FOUND,
  ErrorCode.RECIPIENT_INPUT_NOT_FOUND,
  ErrorCode.RECIPIENT_SUGGESTION_NOT_FOUND,
  ErrorCode.RECIPIENT_VERIFICATION_FAILED,
  ErrorCode.MESSAGE_INPUT_NOT_FOUND,
  ErrorCode.MESSAGE_CONTENT_MISMATCH,
  ErrorCode.SEND_BUTTON_NOT_FOUND,
  ErrorCode.GOOGLE_MESSAGES_NOT_PAIRED,
  ErrorCode.UNKNOWN_SEND_STATE,
  ErrorCode.BROWSER_CLOSED,
]);

export class AutomationError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;

  constructor(code: ErrorCode, message?: string, detail?: string) {
    super(message ? `${code}: ${message}` : code);
    this.name = 'AutomationError';
    this.code = code;
    this.detail = detail;
  }

  /** Whether this error should stop the entire job (vs. skip one item). */
  get isJobFatal(): boolean {
    return JOB_FATAL_CODES.has(this.code);
  }
}

export function asAutomationError(e: unknown): AutomationError {
  if (e instanceof AutomationError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/Target closed|browser has been closed/i.test(msg)) {
    return new AutomationError(ErrorCode.BROWSER_CLOSED, msg);
  }
  return new AutomationError(ErrorCode.NETWORK_ERROR, msg);
}
