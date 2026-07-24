/**
 * Tiny HTTP control server so the ERP/desktop UI (or curl) can pause/resume/stop
 * a running queue and read live progress. Optional — the engine runs fine
 * without it. No external deps: uses node:http.
 */
import { createServer, type Server } from 'node:http';
import { config } from './config.js';
import { logger } from './logger.js';
import type { ControlCommand, ProgressState } from './types.js';

export interface Controller {
  isPaused: () => boolean;
  isStopped: () => boolean;
  setProgress: (p: ProgressState) => void;
  server: Server;
  close: () => void;
}

export function startControlServer(): Controller {
  let paused = false;
  let stopped = false;
  let progress: ProgressState | null = null;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.controlPort}`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.pathname === '/progress') {
      res.end(JSON.stringify(progress ?? { status: 'idle' }));
      return;
    }
    if (url.pathname === '/control') {
      const cmd = url.searchParams.get('cmd') as ControlCommand | null;
      if (cmd === 'pause') paused = true;
      else if (cmd === 'resume') paused = false;
      else if (cmd === 'stop') stopped = true;
      else {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: 'cmd must be pause|resume|stop' }));
        return;
      }
      logger.info(`Control command: ${cmd}`);
      res.end(JSON.stringify({ ok: true, paused, stopped }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
  });

  server.listen(config.controlPort, () => {
    logger.info(`Control server on http://localhost:${config.controlPort} (/progress, /control?cmd=)`);
  });
  server.on('error', (e) => logger.warn(`Control server unavailable: ${e.message}`));

  return {
    isPaused: () => paused,
    isStopped: () => stopped,
    setProgress: (p) => (progress = p),
    server,
    close: () => server.close(),
  };
}
