"use server";

import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getActiveSession, getGroupsWithMembers, getSettings } from "@/lib/data";
import { inviteGroupForSession, sendReminderForSession } from "@/lib/sending";
import { zonedNow } from "@/lib/time";
import { revalidatePath } from "next/cache";

// Fire invites for every non-empty group of the active session right now,
// ignoring the weekday schedule and the once-a-day guard. In dry-run/test mode
// the emails land in the Outbox with clickable signup links.
export async function sendTestInvites(basePath: string): Promise<void> {
  await requireAdmin();
  const session = await getActiveSession();
  if (!session) {
    throw new Error("No active session — create one on the Sessions tab and mark it active.");
  }
  const settings = await getSettings();
  const today = zonedNow(settings.timezone).ymd;
  const groups = await getGroupsWithMembers();
  for (const g of groups) {
    if (g.members.length === 0) continue;
    await inviteGroupForSession(session, g, today, true);
  }
  revalidatePath(`${basePath}/outbox`);
  revalidatePath(`${basePath}/sessions`);
  revalidatePath(`${basePath}`);
}

// Send yourself the weekly roster reminder right now (forced).
export async function sendTestReminder(basePath: string): Promise<void> {
  await requireAdmin();
  const session = await getActiveSession();
  if (!session) throw new Error("No active session to summarize.");
  const settings = await getSettings();
  const today = zonedNow(settings.timezone).ymd;
  await sendReminderForSession(session, today, true);
  revalidatePath(`${basePath}/outbox`);
}

export async function clearOutbox(basePath: string): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const { error } = await db.from("sent_emails").delete().not("id", "is", null);
  if (error) throw error;
  revalidatePath(`${basePath}/outbox`);
}
