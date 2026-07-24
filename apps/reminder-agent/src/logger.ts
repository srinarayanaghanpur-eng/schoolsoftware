/** Minimal timestamped logger with levels. */
type Level = 'info' | 'warn' | 'error' | 'success';

const COLORS: Record<Level, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
};
const RESET = '\x1b[0m';

function stamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level: Level, msg: string, extra?: unknown): void {
  const line = `${COLORS[level]}[${stamp()}] ${level.toUpperCase()}${RESET} ${msg}`;
  const stream = level === 'error' ? console.error : console.log;
  if (extra !== undefined) stream(line, extra);
  else stream(line);
}

export const logger = {
  info: (m: string, e?: unknown) => log('info', m, e),
  warn: (m: string, e?: unknown) => log('warn', m, e),
  error: (m: string, e?: unknown) => log('error', m, e),
  success: (m: string, e?: unknown) => log('success', m, e),
};

/**
 * Mask a phone number for logs, keeping only the last 4 digits: `******3210`.
 * Standard logs must never contain full parent numbers.
 */
export function maskPhone(phone: string | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}
