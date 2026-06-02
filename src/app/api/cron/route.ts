import { NextRequest, NextResponse } from "next/server";
import { runDispatch } from "@/lib/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hit on a schedule by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>`. You can also trigger it by hand with
// ?key=<CRON_SECRET> to test. The dispatch itself is idempotent.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");

  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runDispatch();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron] dispatch error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
