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

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) {
    if (session) {
      return NextResponse.redirect(new URL(safeNext(request) ?? "/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    // Remember where an invite link was heading so login can return there.
    if (pathname !== "/") {
      login.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
