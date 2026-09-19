import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/auth/types";

/** Only allow same-origin relative paths, so `next` can't open-redirect. */
export function safeNext(request: NextRequest): string | null {
  const candidate = request.nextUrl.searchParams.get("next");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }
  return candidate;
}

/** Pages a signed-out visitor is allowed to open. */
const PUBLIC_PATHS = ["/login", "/invite", "/how-it-works"];

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isPublic) {
    // Signed-in visitors to the sign-in screen go straight to their wallet.
    if (session && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL(safeNext(request) ?? "/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    // Remember where an invite or payment link was heading.
    if (pathname !== "/") {
      login.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
