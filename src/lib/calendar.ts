import { google } from "googleapis";

// Google Calendar adapter. Writes the session to your calendar and lists the
// confirmed attendees in the event DESCRIPTION (Google does not email them —
// your app is the only thing that contacts people). If the GOOGLE_* env vars
// are unset, every function no-ops so the rest of the app keeps working.

export function calendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
  );
}

function client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2 });
}

export interface CalendarEventInput {
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:MM[:SS]
  location: string | null;
  timezone: string;
  attendees: { name: string | null; email: string }[];
  notes: string | null;
}

function buildBody(input: CalendarEventInput) {
  const list = input.attendees.length
    ? input.attendees
        .map((a, i) => `${i + 1}. ${a.name ? `${a.name} ` : ""}<${a.email}>`)
        .join("\n")
    : "(no signups yet)";

  const description =
    `${input.notes ? input.notes + "\n\n" : ""}` +
    `Attending (${input.attendees.length}):\n${list}\n\n` +
    `— updated by the training scheduler`;

  // All-day vs timed event.
  const start = input.eventTime
    ? { dateTime: `${input.eventDate}T${pad(input.eventTime)}`, timeZone: input.timezone }
    : { date: input.eventDate };
  const end = input.eventTime
    ? { dateTime: `${input.eventDate}T${addHour(input.eventTime)}`, timeZone: input.timezone }
    : { date: input.eventDate };

  return {
    summary: input.title,
    location: input.location || undefined,
    description,
    start,
    end,
  };
}

// Create the event, returning its id (or null if calendar isn't configured).
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<string | null> {
  if (!calendarConfigured()) return null;
  const cal = client();
  const res = await cal.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    requestBody: buildBody(input),
  });
  return res.data.id ?? null;
}

// Update an existing event (e.g. when someone new signs up).
export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  if (!calendarConfigured()) return;
  const cal = client();
  await cal.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    eventId,
    requestBody: buildBody(input),
  });
}

function pad(t: string): string {
  // ensure HH:MM:SS
  const parts = t.split(":");
  while (parts.length < 3) parts.push("00");
  return parts.map((p) => p.padStart(2, "0")).join(":");
}

function addHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hh = (h + 1) % 24;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
