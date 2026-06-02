"use server";

import { getServiceClient } from "@/lib/supabase";
import { getSignupByToken, getSettings } from "@/lib/data";
import { syncCalendarForSession } from "@/lib/sending";
import { zonedNow } from "@/lib/time";
import { revalidatePath } from "next/cache";

// Record a yes/no for a single session via its unique token. The token is the
// only credential — it maps to exactly one (session, person), so it can't be
// used to respond for any other date.
export async function respond(token: string, status: "yes" | "no"): Promise<void> {
  const signup = await getSignupByToken(token);
  if (!signup) throw new Error("Invalid link");

  const session = signup.session;
  const settings = await getSettings();
  const today = zonedNow(settings.timezone).ymd;

  // Reject responses to a closed or past session.
  if (!session.is_active || session.event_date < today) return;

  const db = getServiceClient();
  await db
    .from("signups")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("token", token);

  // Keep the calendar attendee list current. Never let a calendar hiccup break
  // the user's RSVP.
  try {
    await syncCalendarForSession(session);
  } catch (e) {
    console.error("[rsvp] calendar sync failed:", e);
  }

  revalidatePath(`/rsvp/${token}`);
}
