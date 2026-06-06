import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, storeGoogleConnection } from "@/lib/google";
import { appUrl } from "@/lib/app-url";

// OAuth redirect target (register this exact URL in Google Cloud:
// <app-url>/api/google/callback). Verifies the CSRF state cookie, exchanges the
// code for a refresh token, stores it, and bounces back to the Schedule tab.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const secret = process.env.ADMIN_SECRET || "";
  const back = (status: string) =>
    NextResponse.redirect(`${appUrl()}/a/${secret}/schedule?google=${status}`);

  if (url.searchParams.get("error")) return back("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("g_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("error");
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    if (!refreshToken) return back("notoken");
    await storeGoogleConnection(refreshToken, email);
  } catch (e) {
    console.error("[google callback]", e);
    return back("error");
  }

  const res = back("connected");
  res.cookies.set("g_state", "", { path: "/", maxAge: 0 });
  return res;
}
