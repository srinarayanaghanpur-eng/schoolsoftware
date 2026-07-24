#!/usr/bin/env node
/**
 * Reminder Agent CLI.
 *
 *   reminder-agent run       Send the ERP's "approved" queue via Google Messages Web
 *   reminder-agent resume    Resume the previous run from the last processed item
 *   reminder-agent status    Print the last saved progress and exit
 *
 * The admin approves messages in the ERP review queue ("Start Sending" marks
 * them approved), then launches this agent — it does the rest with no manual
 * Send clicks.
 */
import { logger } from './logger.js';
import { runQueue } from './queueEngine.js';
import { loadProgress } from './progressStore.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';

  switch (command) {
    case 'run':
      await runQueue({ resume: false });
      break;
    case 'resume':
      await runQueue({ resume: true });
      break;
    case 'status': {
      const p = loadProgress();
      if (!p) {
        logger.info('No saved progress.');
      } else {
        const sent = p.results.filter((r) => r.status === 'sent').length;
        logger.info(
          `Run ${p.runId} — ${p.status}. ${p.processedIds.length}/${p.total} processed, ${sent} sent, updated ${p.updatedAt}.`,
        );
      }
      break;
    }
    default:
      logger.error(`Unknown command "${command}". Use: run | resume | status`);
      process.exit(1);
  }
}

main().catch((e) => {
  logger.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
