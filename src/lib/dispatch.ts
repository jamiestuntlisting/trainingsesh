import { getActiveSession, getGroupsWithMembers, getSettings } from "./data";
import { inviteGroupForSession, sendReminderForSession } from "./sending";
import { zonedNow, timeToMinutes } from "./time";

export interface DispatchResult {
  ran: boolean;
  reason?: string;
  actions: string[];
}

// Evaluated by the cron route. Decides — based on the configured weekdays/times
// in the active session's settings — what (if anything) should go out right now.
// Everything is idempotent, so running this hourly (or once a day) is safe.
export async function runDispatch(now: Date = new Date()): Promise<DispatchResult> {
  const actions: string[] = [];

  const session = await getActiveSession();
  if (!session) return { ran: false, reason: "No active session", actions };

  const settings = await getSettings();
  const z = zonedNow(settings.timezone, now);

  // Don't send anything on/after the event date.
  if (z.ymd > session.event_date) {
    return { ran: false, reason: "Active session date has passed", actions };
  }

  // Tuesday-style reminder to yourself.
  if (
    z.weekday === settings.reminder_weekday &&
    z.minutes >= timeToMinutes(settings.reminder_time)
  ) {
    const r = await sendReminderForSession(session, z.ymd);
    if (r.sent) actions.push("Sent roster reminder");
  }

  // Per-group invites on their configured weekday/time.
  const groups = await getGroupsWithMembers();
  for (const g of groups) {
    if (g.send_weekday == null) continue;
    if (g.members.length === 0) continue;
    if (z.weekday === g.send_weekday && z.minutes >= timeToMinutes(g.send_time)) {
      const r = await inviteGroupForSession(session, g, z.ymd);
      if (!r.skipped) {
        actions.push(`Invited ${g.name}: ${r.invited} sent${r.failed.length ? `, ${r.failed.length} failed` : ""}`);
      }
    }
  }

  return { ran: true, actions };
}
