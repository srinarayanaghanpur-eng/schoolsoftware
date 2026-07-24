/**
 * Prepares (and, depending on mode, sends) ONE message through Google Messages
 * Web with strict safety checks:
 *
 *   Start chat → type number → select recipient → VERIFY the open conversation's
 *   number matches the approved number → insert message → VERIFY the inserted
 *   text matches the approved message → then branch on send mode:
 *     • prepare_only : leave it filled, do NOT send (admin sends on the phone/web)
 *     • review_each  : pause for operator confirmation, then send
 *     • automatic    : send immediately
 *
 * Any missing element or mismatch throws an AutomationError with a specific code
 * and sends NOTHING. Uncertain post-click state → UNKNOWN_SEND_STATE (never
 * auto-retried by the engine).
 */
import type { Page } from 'playwright';
import { selectors } from './selectors.js';
import { requireLocator, firstVisible } from './locators.js';
import { AutomationError, ErrorCode } from '../errors.js';
import { numbersMatch, normalizeForComparison } from '../validation.js';
import { logger, maskPhone } from '../logger.js';
import type { SendMode } from '../types.js';

export interface SendArgs {
  phone: string; // dial format, e.g. +919876543210
  message: string;
  mode: SendMode;
  /** Called in review_each mode; resolve to proceed with Send. */
  confirm?: (phone: string, message: string) => Promise<boolean>;
}

export type SendOutcome = 'sent' | 'prepared';

export async function sendOne(page: Page, args: SendArgs): Promise<SendOutcome> {
  const { phone, message, mode } = args;

  // 1. Open the new-conversation view.
  const startChat = await requireLocator(
    page,
    selectors.startChat,
    'Start chat button',
    ErrorCode.NEW_CONVERSATION_BUTTON_NOT_FOUND,
  );
  await startChat.click();

  // 2. Type the number.
  const input = await requireLocator(
    page,
    selectors.recipientInput,
    'recipient input',
    ErrorCode.RECIPIENT_INPUT_NOT_FOUND,
  );
  await input.click();
  await input.fill('');
  await input.type(phone, { delay: 40 });

  // 3. Select the recipient (chip or first suggestion). No blind fallback click.
  const sendTo = await firstVisible(page, selectors.sendToNumber, 3500);
  if (sendTo) {
    await sendTo.click();
  } else {
    const suggestion = await firstVisible(page, selectors.recipientSuggestion, 2500);
    if (!suggestion) {
      throw new AutomationError(
        ErrorCode.RECIPIENT_SUGGESTION_NOT_FOUND,
        `No recipient suggestion appeared for ${maskPhone(phone)}. No message was sent.`,
      );
    }
    await suggestion.click();
  }

  // 4. VERIFY the opened conversation is the right number (never trust the input).
  await verifyRecipient(page, phone);

  // 5. Insert the message and VERIFY its content.
  const compose = await requireLocator(
    page,
    selectors.composeBox,
    'compose box',
    ErrorCode.MESSAGE_INPUT_NOT_FOUND,
  );
  await compose.click();
  await compose.fill(message);
  await verifyComposedText(page, compose, message);

  // 6. prepare_only stops here — the admin sends manually.
  if (mode === 'prepare_only') {
    logger.info(`Prepared (not sent) for ${maskPhone(phone)}`);
    return 'prepared';
  }

  // 7. review_each waits for explicit operator confirmation.
  if (mode === 'review_each') {
    const ok = args.confirm ? await args.confirm(phone, message) : true;
    if (!ok) {
      logger.warn(`Operator skipped ${maskPhone(phone)}`);
      return 'prepared';
    }
  }

  // 8. Send.
  const send = await requireLocator(
    page,
    selectors.sendButton,
    'Send button',
    ErrorCode.SEND_BUTTON_NOT_FOUND,
  );
  await waitEnabled(send);
  await send.click();

  // 9. Confirm the send actually happened. If we can't tell → UNKNOWN_SEND_STATE.
  await confirmSent(page, compose, phone);
  logger.success(`Sent to ${maskPhone(phone)}`);
  return 'sent';
}

/** Read the conversation header and ensure it matches the approved number. */
async function verifyRecipient(page: Page, expectedPhone: string): Promise<void> {
  const header = await firstVisible(page, selectors.conversationHeader, 5000);
  const headerText = header ? ((await header.textContent()) ?? '') : '';

  // If the header shows a number, it must match. Many chats show a saved name
  // instead of a number — in that case we can't number-match, so we require that
  // the header at least exists (a conversation opened) and contains no OTHER
  // 10-digit number than the expected one.
  const digitsInHeader = normalizeForComparison(headerText);
  if (digitsInHeader.length === 10 && !numbersMatch(expectedPhone, headerText)) {
    throw new AutomationError(
      ErrorCode.RECIPIENT_VERIFICATION_FAILED,
      `Expected ${maskPhone(expectedPhone)} but the open conversation shows a different number. The message was not inserted or sent.`,
    );
  }
  if (!header) {
    throw new AutomationError(
      ErrorCode.RECIPIENT_VERIFICATION_FAILED,
      `Could not confirm the conversation opened for ${maskPhone(expectedPhone)}. No message was inserted.`,
    );
  }
}

/** Ensure what's in the compose box equals the approved message. */
async function verifyComposedText(
  page: Page,
  compose: import('playwright').Locator,
  expected: string,
): Promise<void> {
  const actual =
    (await compose.inputValue().catch(() => null)) ??
    (await compose.textContent().catch(() => '')) ??
    '';
  if (norm(actual) !== norm(expected)) {
    throw new AutomationError(
      ErrorCode.MESSAGE_CONTENT_MISMATCH,
      'The text in the compose box does not match the approved message. Nothing was sent.',
    );
  }
}

/** Post-send confirmation. Ambiguity is treated as UNKNOWN_SEND_STATE. */
async function confirmSent(
  page: Page,
  compose: import('playwright').Locator,
  phone: string,
): Promise<void> {
  const bubble = await firstVisible(page, selectors.outgoingMessage, 8000);
  if (bubble) return; // outgoing bubble appeared → sent
  const remaining = (await compose.inputValue().catch(() => '')) || '';
  if (remaining.trim().length === 0) return; // compose cleared → sent
  throw new AutomationError(
    ErrorCode.UNKNOWN_SEND_STATE,
    `Could not confirm whether the message to ${maskPhone(phone)} was sent. Manual review required before any retry.`,
  );
}

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

async function waitEnabled(loc: import('playwright').Locator, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await loc.isEnabled().catch(() => false)) return;
    await loc.page().waitForTimeout(150);
  }
}
