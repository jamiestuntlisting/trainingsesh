import { isSupabaseConfigured } from "@/lib/supabase";
import { getGroupsWithMembers, getSettings, type GroupWithMembers } from "@/lib/data";
import { WEEKDAYS, type Settings } from "@/lib/types";
import { configDiagnostics } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import { addGroup, deleteGroup, moveGroup, updateGroup, updateSettings } from "./actions";

export const dynamic = "force-dynamic";

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
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  let settings: Settings;
  let groups: GroupWithMembers[];
  try {
    settings = await getSettings();
    groups = await getGroupsWithMembers();
  } catch (e) {
    return (
      <SetupDiagnostics diag={configDiagnostics()} error={e instanceof Error ? e.message : String(e)} />
    );
  }

  return (
    <div className="space-y-8">
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
