/**
 * Crash-safe progress persistence. Written after every item so a browser crash,
 * shutdown, or network drop never loses more than the in-flight message. On the
 * next run the engine resumes from the last processed item.
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { config } from './config.js';
import { logger } from './logger.js';
import type { ProgressState, SendResult } from './types.js';

export function loadProgress(): ProgressState | null {
  if (!existsSync(config.progressFile)) return null;
  try {
    return JSON.parse(readFileSync(config.progressFile, 'utf8')) as ProgressState;
  } catch (e) {
    logger.warn(`Could not parse progress file: ${(e as Error).message}`);
    return null;
  }
}

/** Atomic write (temp file + rename) so a crash can't corrupt the file. */
export function saveProgress(state: ProgressState): void {
  state.updatedAt = new Date().toISOString();
  const tmp = `${config.progressFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, config.progressFile);
}

export function newProgress(total: number, sentToday: number): ProgressState {
  return {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    total,
    processedIds: [],
    completedKeys: [],
    results: [],
    sentToday,
    status: 'running',
  };
}

export function recordResult(state: ProgressState, result: SendResult): void {
  state.processedIds.push(result.id);
  state.results.push(result);
  if (result.status === 'sent') state.sentToday += 1;
  saveProgress(state);
}

export function clearProgress(): void {
  if (existsSync(config.progressFile)) {
    try {
      renameSync(config.progressFile, `${config.progressFile}.done`);
    } catch {
      /* ignore */
    }
  }
}
