import { NextResponse } from "next/server";
import { introspectStuntlisting, stuntlistingConfigured } from "@/lib/stuntlisting";

// Admin-gated (by the secret URL via middleware) health check for the
// stuntlisting database: confirms connectivity and surfaces the tables that
// have an email column, plus a preview of the configured query — so the right
// STUNTLISTING_QUERY can be chosen without guessing.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  if (!stuntlistingConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "STUNTLISTING_DB_* env vars are not set.",
    });
  }
  try {
    const schema = await introspectStuntlisting();
    return NextResponse.json({ ok: true, configured: true, ...schema });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
