import { isSupabaseConfigured } from "@/lib/supabase";
import { getGroupsWithMembers, getSettings, type GroupWithMembers } from "@/lib/data";
import { WEEKDAYS, type Settings } from "@/lib/types";
import { configDiagnostics, describeError } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import {
  addGroup,
  deleteGroup,
  disconnectGoogleAction,
  moveGroup,
  updateGroup,
  updateSettings,
} from "./actions";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google connected — email sending and calendar sync are now live. 🎬",
  denied: "Google connection was cancelled.",
  notoken:
    "Google didn't return a refresh token. Remove this app at myaccount.google.com/permissions, then Connect again.",
  error: "Couldn't complete the Google connection. Please try again.",
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500";

function WeekdayOptions() {
  return (
    <>
      <option value="">— none —</option>
      {WEEKDAYS.map((w, i) => (
        <option key={i} value={i}>
          {w}
        </option>
      ))}
    </>
  );
}

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ secret: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const { secret } = await params;
  const { google: googleStatus } = await searchParams;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  let settings: Settings;
  let groups: GroupWithMembers[];
  try {
    settings = await getSettings();
    groups = await getGroupsWithMembers();
  } catch (e) {
    return <SetupDiagnostics diag={configDiagnostics()} error={describeError(e)} />;
  }

  const gConfigured = googleConfigured();
  const gConnected = gConfigured && Boolean(settings.google_refresh_token);

  return (
    <div className="space-y-8">
      {googleStatus && GOOGLE_MESSAGES[googleStatus] && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            googleStatus === "connected"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {GOOGLE_MESSAGES[googleStatus]}
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Google connection (email + calendar)</h2>
        <p className="mb-3 mt-1 text-xs text-stone-500">
          Sends invites from your Gmail and can mirror sessions to your calendar — one connection.
        </p>
        {!gConfigured ? (
          <p className="text-sm text-amber-700">
            First set <code className="rounded bg-stone-100 px-1">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="rounded bg-stone-100 px-1">GOOGLE_CLIENT_SECRET</code> in Vercel (see the
            README), redeploy, then connect.
          </p>
        ) : gConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              Connected{settings.google_email ? ` as ${settings.google_email}` : ""}
            </span>
            <a
              href={`${base}/google/connect`}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium transition hover:bg-stone-50"
            >
              Reconnect
            </a>
            <form action={disconnectGoogleAction.bind(null, base)}>
              <button type="submit" className="text-xs text-stone-400 transition hover:text-red-600">
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <a
            href={`${base}/google/connect`}
            className="inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            Connect Google
          </a>
        )}
      </section>
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Weekly reminder to you</h2>
        <p className="mb-4 mt-1 text-xs text-stone-500">
          A summary of who&apos;s on each list, sent to your inbox before invites go out.
        </p>
        <form action={updateSettings.bind(null, base)} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Send on</span>
            <select name="reminder_weekday" className={inputCls} defaultValue={String(settings.reminder_weekday)}>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">At</span>
            <input
              type="time"
              name="reminder_time"
              defaultValue={settings.reminder_time.slice(0, 5)}
              className={inputCls}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Your email (where reminders go)</span>
            <input
              type="email"
              name="admin_email"
              defaultValue={settings.admin_email ?? ""}
              placeholder="you@example.com"
              className={inputCls}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Timezone</span>
            <input
              name="timezone"
              defaultValue={settings.timezone}
              list="tz-list"
              className={inputCls}
            />
            <datalist id="tz-list">
              <option value="America/Los_Angeles" />
              <option value="America/Denver" />
              <option value="America/Chicago" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Save reminder settings
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-stone-600">Groups & send days</h2>
        <p className="mb-3 text-xs text-stone-500">
          Order = invite priority. Each group is emailed on its day in the lead-up to the active
          session. Arrange <em>who</em> is in each group on the Groups tab.
        </p>

        <div className="space-y-3">
          {groups.map((g, idx) => (
            <div key={g.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <form
                action={updateGroup.bind(null, base, g.id)}
                className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <label className="text-sm">
                  <span className="mb-1 block text-stone-500">
                    Name <span className="text-stone-400">({g.members.length} people)</span>
                  </span>
                  <input name="name" defaultValue={g.name} className={inputCls} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-stone-500">Emails on</span>
                  <select
                    name="send_weekday"
                    className={inputCls}
                    defaultValue={g.send_weekday == null ? "" : String(g.send_weekday)}
                  >
                    <WeekdayOptions />
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-stone-500">At</span>
                  <input
                    type="time"
                    name="send_time"
                    defaultValue={g.send_time.slice(0, 5)}
                    className={inputCls}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
                >
                  Save
                </button>
              </form>

              <div className="mt-3 flex items-center gap-3 text-xs text-stone-400">
                <form action={moveGroup.bind(null, base, g.id, "up")}>
                  <button type="submit" disabled={idx === 0} className="disabled:opacity-30 hover:text-stone-700">
                    ↑ earlier
                  </button>
                </form>
                <form action={moveGroup.bind(null, base, g.id, "down")}>
                  <button
                    type="submit"
                    disabled={idx === groups.length - 1}
                    className="disabled:opacity-30 hover:text-stone-700"
                  >
                    ↓ later
                  </button>
                </form>
                <form action={deleteGroup.bind(null, base, g.id)} className="ml-auto">
                  <button type="submit" className="hover:text-red-600">
                    Delete group
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Add a group</h2>
        <form
          action={addGroup.bind(null, base)}
          className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Name</span>
            <input name="name" placeholder="Group 4" className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Emails on</span>
            <select name="send_weekday" className={inputCls} defaultValue="">
              <WeekdayOptions />
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">At</span>
            <input type="time" name="send_time" defaultValue="09:00" className={inputCls} />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium transition hover:bg-stone-50"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
