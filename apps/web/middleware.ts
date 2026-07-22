import { NextRequest, NextResponse } from "next/server";

const MOBILE_UI_COOKIE = "erp_mobile_ui";
const MOBILE_DASHBOARD_PATH = /^\/(teacher|portal|parent|admin|principal|accountant)(?:\/|$)/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    request.method !== "GET" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__mobile/") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (request.cookies.get(MOBILE_UI_COOKIE)?.value === "1") {
    // A hard-loaded dashboard URL must enter through Expo's existing session
    // guard so the authenticated role, not the pathname, selects a workspace.
    // Expo's in-app navigation remains client-side and does not hit middleware.
    if (MOBILE_DASHBOARD_PATH.test(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname !== "/" && pathname !== "/login") {
      return NextResponse.next();
    }

    return NextResponse.rewrite(new URL("/__mobile/index.html", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*"
};
