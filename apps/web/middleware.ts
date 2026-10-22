import { NextRequest, NextResponse } from "next/server";

// NarayanaOS web is built for computers. Phones are shown a notice pointing to
// the mobile app instead of the dashboard. Public share links (receipts, report
// cards, admission forms, etc.) are never intercepted, so WhatsApp links keep
// working for parents on their phones.
const APP_PATH = /^\/(teacher|portal|parent|admin|principal|accountant|login)(?:\/|$)/;

const MOBILE_UA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i;
// iPad/Android tablets report a desktop-class UA; they intentionally get the
// desktop site.
const TABLET_UA = /iPad|Tablet/i;

function isMobileDevice(request: NextRequest): boolean {
  // `Sec-CH-UA-Mobile` is a low-entropy client hint Chromium sends by default
  // and is authoritative when present; fall back to UA sniffing (Safari/iOS).
  const hint = request.headers.get("sec-ch-ua-mobile");
  if (hint === "?1") return true;
  if (hint === "?0") return false;
  const ua = request.headers.get("user-agent") ?? "";
  if (TABLET_UA.test(ua)) return false;
  return MOBILE_UA.test(ua);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    request.method !== "GET" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/use-mobile-app" ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Cache the notice and desktop variants of a URL separately at the CDN so a
  // cached desktop page is never handed to a phone (or vice-versa).
  const vary = "Sec-CH-UA-Mobile, User-Agent";
  const isAppEntry = pathname === "/" || APP_PATH.test(pathname);

  if (isAppEntry && isMobileDevice(request)) {
    const notice = NextResponse.rewrite(new URL("/use-mobile-app", request.url));
    notice.headers.set("Vary", vary);
    return notice;
  }

  const next = NextResponse.next();
  if (isAppEntry) next.headers.set("Vary", vary);
  return next;
}

export const config = {
  matcher: "/:path*"
};
