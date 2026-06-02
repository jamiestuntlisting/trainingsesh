import { isSupabaseConfigured } from "@/lib/supabase";
import { getSessions, getSessionSignups, type SignupWithContact } from "@/lib/data";
import { calendarConfigured } from "@/lib/calendar";
import { configDiagnostics, describeError } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import { createSession, deleteSession, setActive, syncCalendarNow } from "./actions";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmt(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  let sessions: Session[];
  let active: Session | null;
  let signups: SignupWithContact[];
  try {
    sessions = await getSessions();
    active = sessions.find((s) => s.is_active) ?? null;
    signups = active ? await getSessionSignups(active.id) : [];
  } catch (e) {
    return <SetupDiagnostics diag={configDiagnostics()} error={describeError(e)} />;
  }
  const yes = signups.filter((s) => s.status === "yes");
  const no = signups.filter((s) => s.status === "no");
  const pending = signups.filter((s) => s.status === "invited");

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">New session</h2>
        <form action={createSession.bind(null, base)} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Title</span>
            <input
              name="title"
              defaultValue="Stunt Training"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Date *</span>
            <input
              type="date"
              name="event_date"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Time</span>
            <input
              type="time"
              name="event_time"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Location</span>
            <input
              name="location"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Capacity (optional)</span>
            <input
              type="number"
              name="capacity"
              min="1"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Notes (shown to invitees)</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="make_active" defaultChecked className="h-4 w-4" />
            <span>Make this the active session</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Create session
            </button>
          </div>
        </form>
      </section>

      {active && (
        <section className="rounded-xl border border-green-200 bg-green-50/40 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                Active
              </span>
              <h2 className="mt-2 text-base font-semibold">{active.title}</h2>
              <p className="text-sm text-stone-600">
                {fmt(active.event_date)}
                {active.location ? ` · ${active.location}` : ""}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-2xl font-semibold text-green-700">
                {yes.length}
                {active.capacity ? (
                  <span className="text-base text-stone-400"> / {active.capacity}</span>
                ) : null}
              </p>
              <p className="text-xs text-stone-500">confirmed</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Roster title={`In (${yes.length})`} rows={yes} tone="green" />
            <Roster title={`No response (${pending.length})`} rows={pending} tone="stone" />
            <Roster title={`Out (${no.length})`} rows={no} tone="stone" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={syncCalendarNow.bind(null, base)}>
              <button
                type="submit"
                disabled={!calendarConfigured()}
                title={calendarConfigured() ? "" : "Set GOOGLE_* env vars to enable"}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm transition hover:bg-white disabled:opacity-40"
              >
                Sync calendar now
              </button>
            </form>
            <form action={setActive.bind(null, base, active.id, false)}>
              <button
                type="submit"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm transition hover:bg-white"
              >
                Close sign-ups
              </button>
            </form>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-600">All sessions</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {sessions.length === 0 ? (
            <p className="p-5 text-sm text-stone-500">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.title}{" "}
                      {s.is_active && (
                        <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">
                          active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-500">{fmt(s.event_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!s.is_active && (
                      <form action={setActive.bind(null, base, s.id, true)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs transition hover:bg-stone-50"
                        >
                          Make active
                        </button>
                      </form>
                    )}
                    <form action={deleteSession.bind(null, base, s.id)}>
                      <button
                        type="submit"
                        className="text-xs text-stone-400 transition hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Roster({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { contact: { name: string | null; email: string }; group: { name: string } | null }[];
  tone: "green" | "stone";
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p
        className={`mb-2 text-xs font-semibold ${
          tone === "green" ? "text-green-700" : "text-stone-500"
        }`}
      >
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-stone-400">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="truncate text-xs">
              {r.contact.name || r.contact.email}
              {r.group ? (
                <span className="ml-1 text-stone-400">· {r.group.name}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
