import { NextResponse } from "next/server";
import {
  discoverStuntlistingSchema,
  introspectStuntlisting,
  stuntlistingConfigured,
} from "@/lib/stuntlisting";

// Admin-gated (by the secret URL via middleware) health check for the
// stuntlisting database: confirms connectivity, lists the real databases and
// email-bearing tables, and previews the configured query — so the right
// STUNTLISTING_DB_NAME / STUNTLISTING_QUERY can be chosen without guessing.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function GET() {
  if (!stuntlistingConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "STUNTLISTING_DB_* env vars are not set.",
    });
  }

  const out: Record<string, unknown> = { configured: true };

  // What databases/tables actually exist (connects without a fixed schema).
  try {
    out.discovery = await discoverStuntlistingSchema();
  } catch (e) {
    out.discoveryError = msg(e);
  }

  // Does the currently-configured database + query work?
  try {
    out.introspect = await introspectStuntlisting();
    out.ok = true;
  } catch (e) {
    out.introspectError = msg(e);
    out.ok = false;
  }

  return NextResponse.json(out);
}
