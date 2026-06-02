import { NextRequest, NextResponse } from "next/server";

// The admin dashboard lives at /a/<ADMIN_SECRET>/... — the URL itself is the
// credential. A wrong (or missing) secret returns 404 so the route's existence
// isn't revealed. On a correct hit we drop an httpOnly cookie that server
// actions check, so mutations can't be invoked without having known the URL.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = pathname.match(/^\/a\/([^/]+)(?:\/.*)?$/);
  if (!match) return NextResponse.next();

  const secret = process.env.ADMIN_SECRET;
  if (!secret || match[1] !== secret) {
    return new NextResponse("Not found", { status: 404 });
  }

  const res = NextResponse.next();
  res.cookies.set("adm", secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export const config = {
  matcher: ["/a/:path*"],
};
