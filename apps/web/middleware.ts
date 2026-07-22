import { NextRequest, NextResponse } from "next/server";

const MOBILE_DASHBOARD_PATH = /^\/(teacher|portal|parent|admin|principal|accountant)(?:\/|$)/;

// Device detection is done server-side (here) rather than client-side, so a
// phone is served the mobile app from the very first byte — it never receives
// the desktop HTML, so there is no "old UI" flash before a client reload.
const MOBILE_UA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i;
// iPad/Android tablets report a desktop-class UA; they intentionally get the
// desktop site (the mobile app targets phones).
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

  // The exported Expo bundle requests its runtime assets from the site root
  // (/assets/*), but they are deployed under /__mobile. Without this the mobile
  // UI loads with broken icons and fonts. Handled first, before the
  // static-extension short-circuit below.
  if (pathname.startsWith("/assets/")) {
    return NextResponse.rewrite(new URL(`/__mobile${pathname}`, request.url));
  }

  if (
    request.method !== "GET" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__mobile/") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Cache the mobile and desktop variants of a URL separately at the CDN so a
  // cached desktop page is never handed to a phone (or vice-versa).
  const vary = "Sec-CH-UA-Mobile, User-Agent";

  if (isMobileDevice(request)) {
    // A hard-loaded dashboard URL must enter through the Expo app's session
    // guard so the authenticated role — not the pathname — selects a workspace.
    // In-app navigation stays client-side and never reaches middleware.
    if (MOBILE_DASHBOARD_PATH.test(pathname)) {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      redirect.headers.set("Vary", vary);
      return redirect;
    }

    if (pathname === "/" || pathname === "/login") {
      const rewrite = NextResponse.rewrite(new URL("/__mobile/index.html", request.url));
      rewrite.headers.set("Vary", vary);
      return rewrite;
    }
  }

  const next = NextResponse.next();
  next.headers.set("Vary", vary);
  return next;
}

export const config = {
  matcher: "/:path*"
};
