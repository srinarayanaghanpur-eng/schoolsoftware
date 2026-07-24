/** Locator helpers that try an ordered list of selectors and use the first hit. */
import type { Page, Locator } from 'playwright';
import { AutomationError, ErrorCode } from '../errors.js';

/** Return the first selector (from the list) that resolves to a visible element. */
export async function firstVisible(
  page: Page,
  candidates: readonly string[],
  timeoutMs = 4000,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.isVisible()) return loc;
      } catch {
        // selector may be transiently invalid during Angular re-render; ignore
      }
    }
    await page.waitForTimeout(200);
  }
  return null;
}

/**
 * Like firstVisible but FAILS LOUDLY with a specific error code when nothing
 * matches — the engine must never guess when a required element is missing.
 */
export async function requireLocator(
  page: Page,
  candidates: readonly string[],
  elementName: string,
  code: ErrorCode = ErrorCode.GOOGLE_MESSAGES_SELECTOR_CHANGED,
  timeoutMs = 8000,
): Promise<Locator> {
  const loc = await firstVisible(page, candidates, timeoutMs);
  if (!loc) {
    throw new AutomationError(
      code,
      `${elementName} was not found. No message was sent. Update the Google Messages selectors before continuing.`,
      `tried: ${candidates.join(', ')}`,
    );
  }
  return loc;
}
