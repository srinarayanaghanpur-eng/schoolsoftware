"use client";

/**
 * Desktop capability bridge.
 *
 * The Electron preload exposes `window.narayana` only inside the desktop app.
 * The web app stays the baseline: every helper here degrades to normal browser
 * behaviour when the bridge is absent, so the same UI works in both places.
 */

export type DesktopPrintResult = {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
};

export type DesktopNotificationOptions = {
  title: string;
  body?: string;
  route?: string;
};

export type DesktopNotificationResult = {
  ok: boolean;
  error?: string;
};

export type DesktopCapabilities = {
  nativePrint: boolean;
  pdfExport: boolean;
  offlineAttendance: boolean;
  biometric: boolean;
  updater: boolean;
  hostedMode: boolean;
};

type DesktopInfo = {
  version?: string;
  platform?: string;
  isPackaged?: boolean;
  mode?: "hosted" | "local";
};

type DesktopBridge = {
  isDesktop?: boolean;
  platform?: string;
  app?: {
    info: () => Promise<DesktopInfo>;
    capabilities: () => Promise<DesktopCapabilities>;
  };
  print?: {
    current: (options?: { silent?: boolean }) => Promise<DesktopPrintResult>;
    pdf: (options?: { defaultName?: string }) => Promise<DesktopPrintResult>;
  };
  notify?: {
    show: (options: DesktopNotificationOptions) => Promise<DesktopNotificationResult>;
    onNavigate: (callback: (route: string) => void) => () => void;
  };
};

declare global {
  interface Window {
    narayana?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.narayana ?? null;
}

export function isDesktopApp(): boolean {
  return Boolean(getDesktopBridge()?.isDesktop);
}

export async function getDesktopCapabilities(): Promise<DesktopCapabilities | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.app?.capabilities) return null;
  try {
    return await bridge.app.capabilities();
  } catch {
    return null;
  }
}

/**
 * Print the current page. Uses the native Electron print dialog when available,
 * otherwise falls back to the browser print dialog. `native` tells the caller
 * whether it must close the window itself (Electron does not always fire
 * `afterprint` for native prints).
 */
export async function printCurrentPage(): Promise<{ native: boolean; result?: DesktopPrintResult }> {
  const bridge = getDesktopBridge();
  if (bridge?.print?.current) {
    return { native: true, result: await bridge.print.current() };
  }
  window.print();
  return { native: false };
}

/** Save the current page as a PDF. Returns null outside the desktop app. */
export async function savePagePdf(defaultName?: string): Promise<DesktopPrintResult | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.print?.pdf) return null;
  return bridge.print.pdf({ defaultName });
}

/**
 * Open an internal print/preview route. Inside the desktop app the current
 * window is reused so the authenticated session is preserved; in a browser a
 * new tab is opened. Opening `target="_blank"` from Electron would otherwise
 * hand the URL to the external browser, which has no login session.
 */
export function openInternalRoute(url: string): void {
  if (isDesktopApp()) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Show a native desktop notification with the system notification sound.
 * Returns null outside the desktop app or when notifications are unavailable.
 */
export async function showDesktopNotification(
  options: DesktopNotificationOptions
): Promise<DesktopNotificationResult | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.notify?.show) return null;
  try {
    return await bridge.notify.show(options);
  } catch {
    return { ok: false, error: "Notification failed" };
  }
}

/** Handle clicks on desktop notifications. Returns a cleanup function. */
export function onDesktopNotificationNavigate(callback: (route: string) => void): () => void {
  const bridge = getDesktopBridge();
  if (!bridge?.notify?.onNavigate) return () => undefined;
  return bridge.notify.onNavigate(callback);
}
