import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { routeRoles } from "@/lib/permissions";

export default withAuth(
  function proxy(request) {
    const pathname = request.nextUrl.pathname;
    const token = request.nextauth.token;
    if (token?.mustChangePin && pathname !== "/change-pin") {
      return NextResponse.redirect(new URL("/change-pin", request.url));
    }
    const entry = Object.entries(routeRoles).find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
    const role = token?.role;
    if (entry && (!role || !entry[1].includes(role))) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/print/:path*",
    "/menu/:path*",
    "/categories/:path*",
    "/inventory/:path*",
    "/purchases/:path*",
    "/suppliers/:path*",
    "/expenses/:path*",
    "/returns/:path*",
    "/reports/:path*",
    "/employees/:path*",
    "/change-pin/:path*",
    "/account/:path*",
    "/audit/:path*",
    "/settings/:path*",
  ],
};
