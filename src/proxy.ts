import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessPath, isPublicPath, normalizePath, ROLE_HOME } from "@/lib/auth/roles";
import { expireSessionCookie, readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const pathname = normalizePath(request.nextUrl.pathname);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    if (token && !session) {
      expireSessionCookie(response.cookies);
    }
    return response;
  }

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) {
      expireSessionCookie(response.cookies);
    }
    return response;
  }

  if (!canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
