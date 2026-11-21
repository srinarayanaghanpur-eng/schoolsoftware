import { json } from "@/lib/apiUtils";

/** The Electron preload/agent adds this header; the browser build never does. */
export function isDesktopRequest(req: Request): boolean {
  return req.headers.get("x-erp-desktop") === "1";
}

export function desktopOnly(req: Request) {
  if (isDesktopRequest(req)) return null;
  return json(
    { ok: false, error: "Gateway settings and auto-send are available in the desktop app only." },
    { status: 403 }
  );
}
