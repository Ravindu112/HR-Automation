import { NextResponse, type NextRequest } from "next/server";
import { EXPIRES_COOKIE, ROLE_COOKIE, SESSION_COOKIE } from "@/lib/session";

/**
 * Routing-only guard. It reads three lightweight cookies (session token,
 * role, expiry) so the edge layer needs no database call — this keeps
 * every navigation fast. Actual authentication is re-validated against
 * the database on every portal render via /api/auth/me and the layouts'
 * useAuth guard, so a forged/expired cookie can never access data.
 */
export async function updateSession(request: NextRequest) {
  // API routes handle auth themselves – never redirect them.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const expiresRaw = request.cookies.get(EXPIRES_COOKIE)?.value;
  const validRole = role === "hr_manager" || role === "employee";
  const notExpired = Boolean(expiresRaw) && new Date(expiresRaw!).getTime() > Date.now();
  const signedIn = Boolean(token) && validRole && notExpired;

  const home = role === "hr_manager" ? "/portal/hr" : "/portal/employee";
  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Signed-in users visiting /login or /register go straight to their portal.
  if (isAuthPage && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Any portal page requires a valid-looking session.
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");
  if (isPortal && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/portal") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Bare /portal: send the user to their own portal.
  if (pathname === "/portal" && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isHr = pathname === "/portal/hr" || pathname.startsWith("/portal/hr/");
  const isEmp = pathname === "/portal/employee" || pathname.startsWith("/portal/employee/");

  if (isHr && signedIn && role !== "hr_manager") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/employee";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isEmp && signedIn && role !== "employee") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/hr";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}