/**
 * Operator confirmation for review_each mode. Prints the recipient (masked) and
 * message, then waits for the admin to press Enter (send) or type 's'+Enter to
 * skip. Reads a single stdin line without extra deps.
 */
import { logger, maskPhone } from '../logger.js';

export async function confirmEachSend(phone: string, message: string): Promise<boolean> {
  logger.info('──────── REVIEW ────────');
  logger.info(`To: ${maskPhone(phone)}`);
  // The full message is shown to the operator on their own screen only (not logged to files).
  process.stdout.write(`Message:\n${message}\n`);
  process.stdout.write('Press Enter to SEND, or type "s" then Enter to SKIP: ');

  return new Promise<boolean>((resolve) => {
    const onData = (buf: Buffer) => {
      process.stdin.off('data', onData);
      process.stdin.pause();
      const answer = buf.toString().trim().toLowerCase();
      resolve(answer !== 's' && answer !== 'skip');
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });
}
