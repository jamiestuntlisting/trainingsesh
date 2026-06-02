import { getServiceClient } from "./supabase";
import { generateToken } from "./tokens";
import { sendBatch, sendEmail } from "./email";
import { inviteEmail, reminderEmail, type ReminderGroupLine } from "./email-templates";
import {
  createCalendarEvent,
  updateCalendarEvent,
  type CalendarEventInput,
} from "./calendar";
import {
  getGroupsWithMembers,
  getSessionSignups,
  getSettings,
  getUngroupedContacts,
} from "./data";
import type { Group, Session } from "./types";

function appUrl(): string {
  // Prefer an explicitly-configured URL, but only if it's actually a URL (a
  // pasted placeholder shouldn't end up in signup links). Otherwise fall back
  // to Vercel's built-in production URL, which is injected automatically — so
  // links work even if NEXT_PUBLIC_APP_URL was never set correctly.
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (/^https?:\/\/.+/i.test(explicit)) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

// ── Invite one group for a session ───────────────────────────────────────────
// Idempotent: a send_log row (session, 'group_invite', group, today) prevents a
// second run on the same day, and signups are unique per (session, contact) so
// re-invites never duplicate a token.
export async function inviteGroupForSession(
  session: Session,
  group: Group,
  sentOn: string,
  force = false,
): Promise<{ invited: number; skipped: boolean; failed: { to: string; error: string }[] }> {
  const db = getServiceClient();

  // Claim the day's send slot first (idempotency guard). In force/test mode we
  // skip this so you can re-trigger invites on demand.
  if (!force) {
    const claim = await db
      .from("send_log")
      .insert({ session_id: session.id, kind: "group_invite", group_id: group.id, sent_on: sentOn });
    if (claim.error) {
      // Unique violation → already sent today. Anything else → surface it.
      if (claim.error.code === "23505") return { invited: 0, skipped: true, failed: [] };
      throw claim.error;
    }
  }

  // Members of this group.
  const { data: members, error: mErr } = await db
    .from("group_members")
    .select("position, contact:contacts(*)")
    .eq("group_id", group.id)
    .order("position", { ascending: true });
  if (mErr) throw mErr;

  const contacts = (members ?? [])
    .map((m) => (m as unknown as { contact: { id: string; email: string; name: string | null } }).contact)
    .filter(Boolean);

  const messages = [];
  for (const c of contacts) {
    // Create the signup row (and token) if it doesn't already exist.
    const token = generateToken();
    const { data: upserted, error: sErr } = await db
      .from("signups")
      .upsert(
        {
          session_id: session.id,
          contact_id: c.id,
          group_id: group.id,
          token,
          status: "invited",
          invited_at: new Date().toISOString(),
        },
        { onConflict: "session_id,contact_id", ignoreDuplicates: true },
      )
      .select("token")
      .maybeSingle();
    if (sErr) throw sErr;

    // If it already existed, fetch the existing token.
    let liveToken = upserted?.token as string | undefined;
    if (!liveToken) {
      const { data: existing } = await db
        .from("signups")
        .select("token")
        .eq("session_id", session.id)
        .eq("contact_id", c.id)
        .single();
      liveToken = existing?.token as string;
    }

    const m = inviteEmail({
      toEmail: c.email,
      toName: c.name,
      signupUrl: `${appUrl()}/rsvp/${liveToken}`,
      title: session.title,
      eventDate: session.event_date,
      eventTime: session.event_time,
      location: session.location,
    });
    m.sessionId = session.id;
    messages.push(m);
  }

  const { sent, failed } = await sendBatch(messages);
  return { invited: sent, skipped: false, failed };
}

// ── Tuesday reminder to yourself ─────────────────────────────────────────────
export async function sendReminderForSession(
  session: Session,
  sentOn: string,
  force = false,
): Promise<{ sent: boolean; skipped: boolean }> {
  const db = getServiceClient();
  const settings = await getSettings();
  const to = settings.admin_email;
  if (!to) {
    throw new Error("No admin_email set in Settings — that's where reminders go.");
  }

  if (!force) {
    const claim = await db
      .from("send_log")
      .insert({ session_id: session.id, kind: "reminder", group_id: null, sent_on: sentOn });
    if (claim.error) {
      if (claim.error.code === "23505") return { sent: false, skipped: true };
      throw claim.error;
    }
  }

  const groups = await getGroupsWithMembers();
  const ungrouped = await getUngroupedContacts();

  const groupLines: ReminderGroupLine[] = groups.map((g) => ({
    groupName: g.name,
    sendWeekday: g.send_weekday,
    members: g.members.map((m) => ({ name: m.name, email: m.email })),
  }));

  const reminder = reminderEmail({
    toEmail: to,
    title: session.title,
    eventDate: session.event_date,
    groups: groupLines,
    ungrouped: ungrouped.map((c) => ({ name: c.name, email: c.email })),
  });
  reminder.sessionId = session.id;
  await sendEmail(reminder);

  return { sent: true, skipped: false };
}

// ── Keep the Google Calendar event in sync with confirmed attendees ──────────
export async function syncCalendarForSession(session: Session): Promise<void> {
  const db = getServiceClient();
  const settings = await getSettings();
  const signups = await getSessionSignups(session.id);
  const attendees = signups
    .filter((s) => s.status === "yes")
    .map((s) => ({ name: s.contact.name, email: s.contact.email }));

  const input: CalendarEventInput = {
    title: session.title,
    eventDate: session.event_date,
    eventTime: session.event_time,
    location: session.location,
    timezone: settings.timezone,
    attendees,
    notes: session.notes,
  };

  if (session.google_event_id) {
    await updateCalendarEvent(session.google_event_id, input);
  } else {
    const id = await createCalendarEvent(input);
    if (id) {
      await db.from("sessions").update({ google_event_id: id }).eq("id", session.id);
    }
  }
}
