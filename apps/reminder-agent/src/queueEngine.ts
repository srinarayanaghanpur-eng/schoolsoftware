/**
 * The sending engine. Owns the whole run:
 *   send-mode selection (review_each default / prepare_only / automatic),
 *   validation, idempotency/duplicate protection, recipient + content
 *   verification (in the sender), daily-limit enforcement, randomized delay,
 *   pause-after-X, retry of ITEM-level errors only, crash-safe resume, live
 *   pause/resume/stop, and fail-loud job halt on any safety-critical ambiguity.
 *
 * Messages are sent strictly one at a time.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { logger, maskPhone } from './logger.js';
import { config } from './config.js';
import type { QueueItem, AgentSettings, ProgressState, SendResult } from './types.js';
import { AutomationError, asAutomationError, ErrorCode } from './errors.js';
import { buildMessage } from './messageTemplate.js';
import { validateItem, findDuplicatePhones, cleanPhone } from './validation.js';
import { sendOne } from './googleMessages/sender.js';
import {
  fetchApprovedQueue,
  fetchSettings,
  updateItemStatus,
  logResult,
} from './erpClient.js';
import { openGoogleMessages } from './googleMessages/browser.js';
import {
  loadProgress,
  saveProgress,
  newProgress,
  recordResult,
  clearProgress,
} from './progressStore.js';
import { startControlServer, type Controller } from './control.js';
import { DedupeTracker, reminderKeyFor } from './safety/dedupe.js';
import { confirmEachSend } from './safety/operatorConfirm.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (Math.max(min, max) - Math.min(min, max) + 1)) + Math.min(min, max);

export interface RunOptions {
  resume: boolean;
}

export async function runQueue(opts: RunOptions): Promise<ProgressState> {
  const settings = await fetchSettings();
  const items = await fetchApprovedQueue('approved');

  if (items.length === 0) {
    logger.warn('No approved items in the queue. Mark items "approved" in the ERP first.');
    return newProgress(0, settings.alreadySentToday);
  }

  // Automatic mode is high-risk — require an explicit typed confirmation.
  if (settings.sendMode === 'automatic') {
    const ok = await confirmAutomaticMode(items.length, settings.schoolName);
    if (!ok) {
      logger.warn('Automatic send cancelled by operator.');
      return newProgress(items.length, settings.alreadySentToday);
    }
  }

  let state = opts.resume ? loadProgress() : null;
  if (state) {
    logger.info(
      `Resuming run ${state.runId}: ${state.processedIds.length}/${state.total} already processed.`,
    );
    state.status = 'running';
  } else {
    state = newProgress(items.length, settings.alreadySentToday);
  }
  saveProgress(state);

  const processed = new Set(state.processedIds);
  const dedupe = new DedupeTracker(state.completedKeys);
  const duplicates = findDuplicatePhones(items);

  const control = startControlServer();
  control.setProgress(state);

  const remainingCapacity = () =>
    settings.dailyLimitEnabled ? Math.max(0, settings.dailyLimit - state!.sentToday) : Infinity;

  logger.info(
    `Mode: ${settings.sendMode}. Queue: ${items.length}. Daily limit ${
      settings.dailyLimitEnabled ? settings.dailyLimit : 'OFF'
    }, sent today ${state.sentToday}, capacity ${remainingCapacity()}.`,
  );

  const session = await openGoogleMessages();
  let sentSincePause = 0;
  let fatal: AutomationError | null = null;

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (processed.has(item.id)) continue;

      if (control.isStopped()) {
        logger.warn('Stop requested — halting after current position.');
        await updateItemStatus(item.id, 'interrupted', 'Operator stop').catch(() => undefined);
        state.status = 'stopped';
        break;
      }
      await waitWhilePaused(control, state);

      if (remainingCapacity() <= 0) {
        logger.warn(`Daily limit reached (${settings.dailyLimit}). Deferring remaining items.`);
        await deferRemaining(items, i, processed);
        state.status = 'completed';
        break;
      }

      let result: SendResult;
      try {
        result = await processItem(session.page, item, settings, { dedupe, duplicates });
      } catch (e) {
        // Job-fatal (selector drift, recipient mismatch, unknown send, ...) → STOP.
        fatal = asAutomationError(e);
        await captureScreenshot(session.page, item.id, fatal.code);
        await updateItemStatus(item.id, 'failed', `${fatal.code}: ${fatal.message}`).catch(
          () => undefined,
        );
        logger.error(`JOB HALTED — ${fatal.code}: ${fatal.message}`);
        state.status = 'stopped';
        break;
      }

      recordResult(state, result);
      state.completedKeys = dedupe.completedKeys;
      saveProgress(state);
      control.setProgress(state);

      if (result.status === 'sent') {
        sentSincePause += 1;
        if (settings.pauseAfterEvery > 0 && sentSincePause >= settings.pauseAfterEvery) {
          logger.info(`Pausing ${settings.pauseDurationMs / 1000}s after ${sentSincePause} sends.`);
          await sleep(settings.pauseDurationMs);
          sentSincePause = 0;
        }
        await sleep(randomDelay(settings.delayMinMs, settings.delayMaxMs));
      }
    }

    if (state.status === 'running') state.status = 'completed';
  } finally {
    await session.close();
    saveProgress(state);
    if (state.status === 'completed') clearProgress();
    control.close();
  }

  printSummary(state, fatal);
  return state;
}

/**
 * Handle one item end-to-end. Returns a SendResult for item-level outcomes.
 * THROWS an AutomationError for job-fatal conditions so the caller stops the job.
 */
async function processItem(
  page: Page,
  item: QueueItem,
  settings: AgentSettings,
  ctx: { dedupe: DedupeTracker; duplicates: Set<string> },
): Promise<SendResult> {
  const message = buildMessage(item, settings);
  const base = {
    id: item.id,
    phone: '',
    message,
    retryCount: 0,
    at: new Date().toISOString(),
  };

  // Local validation (item-level; never fatal).
  const v = validateItem(item, message, { skipAlreadySent: settings.skipAlreadySent });
  base.phone = v.phone;
  if (!v.ok) {
    const code =
      v.reason === 'Empty message'
        ? ErrorCode.EMPTY_MESSAGE
        : ErrorCode.INVALID_PHONE_NUMBER;
    return await skip(item, { ...base }, code, v.reason ?? 'Invalid');
  }

  // Idempotency — never re-send the same reminder.
  const key = reminderKeyFor(item, settings.schoolName || 'school', message);
  if (ctx.dedupe.hasKey(key)) {
    return await skip(item, base, ErrorCode.DUPLICATE_REMINDER, 'Duplicate reminder (already sent)');
  }
  const national = cleanPhone(item.mobile);
  if (ctx.duplicates.has(national) && ctx.dedupe.phoneSeen(item.mobile)) {
    return await skip(item, base, ErrorCode.DUPLICATE_REMINDER, 'Duplicate number this run');
  }

  await updateItemStatus(item.id, 'sending').catch(() => undefined);

  const maxAttempts = settings.retryFailed ? Math.max(1, settings.maxRetryCount) : 1;
  let lastError: AutomationError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const outcome = await sendOne(page, {
        phone: v.phone,
        message,
        mode: settings.sendMode,
        confirm: confirmEachSend,
      });

      if (outcome === 'sent') {
        ctx.dedupe.markDone(key, item.mobile);
        await updateItemStatus(item.id, 'sent').catch(() => undefined);
        const result: SendResult = { ...base, status: 'sent', retryCount: attempt - 1 };
        await logResult(result, item);
        logger.success(`✓ ${item.studentName ?? item.id} (${maskPhone(v.phone)})`);
        return result;
      }
      // 'prepared' — prepare_only mode or operator skipped in review_each.
      await updateItemStatus(item.id, 'prepared').catch(() => undefined);
      const result: SendResult = { ...base, status: 'prepared', retryCount: attempt - 1 };
      await logResult(result, item);
      return result;
    } catch (e) {
      const err = asAutomationError(e);
      // Safety-critical ambiguity → bubble up and STOP the whole job. Never retry.
      if (err.isJobFatal) throw err;
      lastError = err;
      logger.warn(`Attempt ${attempt}/${maxAttempts} for ${maskPhone(v.phone)}: ${err.code}`);
      if (attempt < maxAttempts) await sleep(2000);
    }
  }

  await updateItemStatus(item.id, 'failed', lastError?.message ?? 'failed').catch(() => undefined);
  const result: SendResult = {
    ...base,
    status: 'failed',
    errorCode: lastError?.code,
    error: lastError?.message,
    retryCount: maxAttempts,
  };
  await logResult(result, item);
  return result;
}

async function skip(
  item: QueueItem,
  base: Omit<SendResult, 'status'>,
  code: ErrorCode,
  reason: string,
): Promise<SendResult> {
  logger.warn(`Skip ${item.studentName ?? item.id}: ${reason}`);
  await updateItemStatus(item.id, 'skipped', reason).catch(() => undefined);
  const result: SendResult = { ...base, status: 'skipped', errorCode: code, error: reason };
  await logResult(result, item);
  return result;
}

async function deferRemaining(
  items: QueueItem[],
  fromIndex: number,
  processed: Set<string>,
): Promise<void> {
  for (let i = fromIndex; i < items.length; i++) {
    const it = items[i]!;
    if (processed.has(it.id)) continue;
    await updateItemStatus(it.id, 'deferred', 'Over daily limit — continue tomorrow').catch(
      () => undefined,
    );
  }
}

async function waitWhilePaused(control: Controller, state: ProgressState): Promise<void> {
  if (!control.isPaused()) return;
  state.status = 'paused';
  saveProgress(state);
  logger.info('Paused. Send /control?cmd=resume to continue.');
  while (control.isPaused() && !control.isStopped()) await sleep(500);
  if (!control.isStopped()) {
    state.status = 'running';
    logger.info('Resumed.');
  }
}

async function captureScreenshot(page: Page, itemId: string, code: string): Promise<void> {
  if (!config.screenshotOnError) return;
  try {
    mkdirSync(config.screenshotDir, { recursive: true });
    const file = join(config.screenshotDir, `${Date.now()}_${itemId}_${code}.png`);
    await page.screenshot({ path: file, fullPage: false });
    logger.info(`Saved error screenshot: ${file}`);
  } catch {
    /* screenshots are best-effort */
  }
}

async function confirmAutomaticMode(count: number, schoolName: string): Promise<boolean> {
  logger.warn('──────── AUTOMATIC MODE ────────');
  logger.warn(`About to auto-SEND ${count} message(s) as "${schoolName || 'this school'}".`);
  logger.warn('Messages cannot be recalled. Review is per-message DISABLED in this mode.');
  process.stdout.write('Type YES (uppercase) to proceed, anything else to cancel: ');
  return new Promise<boolean>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', (buf: Buffer) => {
      process.stdin.pause();
      resolve(buf.toString().trim() === 'YES');
    });
  });
}

function printSummary(state: ProgressState, fatal: AutomationError | null): void {
  const count = (s: string) => state.results.filter((r) => r.status === s).length;
  const seconds = Math.round((Date.parse(state.updatedAt) - Date.parse(state.startedAt)) / 1000);
  logger.info('──────── Run finished ────────');
  logger.success(`Sent:     ${count('sent')}`);
  logger.info(`Prepared: ${count('prepared')}`);
  if (count('failed')) logger.error(`Failed:   ${count('failed')}`);
  logger.info(`Skipped:  ${count('skipped')}`);
  logger.info(`Status:   ${state.status}`);
  logger.info(`Time:     ${seconds}s`);
  if (fatal) {
    logger.error(`Halted by ${fatal.code}. Fix the cause, then: npm run agent:resume`);
  }
}
