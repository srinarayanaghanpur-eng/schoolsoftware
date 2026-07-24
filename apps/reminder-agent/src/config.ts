/** Loads agent configuration from environment (.env) with safe defaults. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(): void {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. See .env.example.`);
  return v;
}

import type { SendMode } from './types.js';

function parseSendMode(v: string | undefined): SendMode {
  return v === 'prepare_only' || v === 'automatic' ? v : 'review_each';
}

export const config = {
  erpBaseUrl: (process.env.ERP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  get erpAdminToken(): string {
    return required('ERP_ADMIN_TOKEN');
  },
  schoolId: process.env.SCHOOL_ID ?? '',
  browserProfileDir: resolve(process.cwd(), process.env.BROWSER_PROFILE_DIR ?? './.gm-profile'),
  browserChannel: process.env.BROWSER_CHANNEL || 'chrome',
  headless: process.env.HEADLESS === 'true',
  progressFile: resolve(process.cwd(), process.env.PROGRESS_FILE ?? './.agent-progress.json'),
  controlPort: Number(process.env.CONTROL_PORT ?? 4599),
  screenshotDir: resolve(process.cwd(), process.env.SCREENSHOT_DIR ?? './screenshots'),
  screenshotOnError: process.env.SCREENSHOT_ON_ERROR !== 'false',
  /** CLI/env override for send mode; ERP settings win if they specify one. */
  defaultSendMode: parseSendMode(process.env.DEFAULT_SEND_MODE),
  delayMinMs: Number(process.env.MESSAGE_DELAY_MIN_MS ?? 2500),
  delayMaxMs: Number(process.env.MESSAGE_DELAY_MAX_MS ?? 5000),
};
