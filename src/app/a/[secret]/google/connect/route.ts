import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { consentUrl, googleConfigured } from "@/lib/google";

// Starts the Google OAuth flow. Reachable only via the secret admin URL (the
// middleware gates /a/<secret>/*), and sets a CSRF state cookie the callback
// verifies.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!googleConfigured()) {
    return new NextResponse(
      "Google OAuth isn't configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy.",
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(consentUrl(state));
  res.cookies.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
