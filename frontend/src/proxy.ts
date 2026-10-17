import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sd_session";
const AUTH_PAGES = new Set(["/login", "/register"]);

/**
 * Optimistic auth guard: only checks that the session cookie exists. The API is the real
 * authority; the client redirects to /login on any 401 (see lib/api.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (AUTH_PAGES.has(pathname)) {
    if (searchParams.get("session") === "expired") {
      // The API rejected the cookie: clear it so we don't bounce between /login and /.
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    if (hasSession) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API rewrite, Next internals and static files.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
