/**
 * Launches a persistent Chromium context for Google Messages Web and waits for
 * the phone to be paired. The persistent profile means the admin scans the QR
 * only once; subsequent runs reuse the session.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { selectors, GM_URL } from './selectors.js';
import { firstVisible } from './locators.js';
import { AutomationError, ErrorCode } from '../errors.js';

export interface GmSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function openGoogleMessages(): Promise<GmSession> {
  logger.info(`Launching Chromium (headless=${config.headless}), profile: ${config.browserProfileDir}`);
  const context = await chromium.launchPersistentContext(config.browserProfileDir, {
    channel: config.browserChannel, // real Chrome/Edge; falls back to bundled Chromium if absent
    headless: config.headless,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(GM_URL, { waitUntil: 'domcontentloaded' });

  await waitForPairing(page);

  return {
    context,
    page,
    close: async () => {
      await context.close().catch(() => undefined);
    },
  };
}

/**
 * Blocks until the conversation list is visible (paired). If a QR is showing,
 * prints instructions and keeps waiting (up to 5 minutes) so the admin can scan.
 */
export async function waitForPairing(page: Page, timeoutMs = 5 * 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let promptedQr = false;

  while (Date.now() < deadline) {
    const ready = await firstVisible(page, selectors.readyMarkers, 1500);
    if (ready) {
      logger.success('Google Messages is paired and ready.');
      return;
    }
    const qr = await firstVisible(page, selectors.qrMarkers, 1000);
    if (qr && !promptedQr) {
      promptedQr = true;
      logger.warn(
        'Google Messages is NOT paired. On your phone open Messages → ⋮ → "Device pairing" → scan the QR in the opened window.',
      );
    }
    await page.waitForTimeout(2000);
  }
  throw new AutomationError(
    ErrorCode.GOOGLE_MESSAGES_NOT_PAIRED,
    'Timed out waiting for Google Messages pairing (5 min). Pair the phone, then re-run.',
  );
}
