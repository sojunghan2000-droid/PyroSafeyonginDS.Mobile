import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/session";

// 로그인 안 된 사용자는 /login 으로. /login 과 /api/auth/* 는 통과.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = Boolean(req.cookies.get(COOKIE)?.value);

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    if (authed && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }
  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
