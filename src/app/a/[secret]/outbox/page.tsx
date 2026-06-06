import { isSupabaseConfigured } from "@/lib/supabase";
import { getActiveSession, getSentEmails } from "@/lib/data";
import { emailReady } from "@/lib/email";
import { configDiagnostics, describeError } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import type { SentEmail, Session } from "@/lib/types";
import { clearOutbox, sendTestInvites, sendTestReminder } from "./actions";

export const dynamic = "force-dynamic";

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    invite: "bg-blue-100 text-blue-700",
    reminder: "bg-amber-100 text-amber-700",
    test: "bg-stone-100 text-stone-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${map[kind] ?? "bg-stone-100 text-stone-600"}`}>
      {kind}
    </span>
  );
}

function when(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function OutboxPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  let emails: SentEmail[];
  let active: Session | null;
  try {
    [emails, active] = await Promise.all([getSentEmails(200), getActiveSession()]);
  } catch (e) {
    return <SetupDiagnostics diag={configDiagnostics()} error={describeError(e)} />;
  }

  const dry = !(await emailReady());

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-4 text-sm ${
          dry
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {dry ? (
          <p>
            <strong>Test mode is on.</strong> No real emails are sent — every message is captured
            here so you can review it and click the signup link. (To send for real,{" "}
            <strong>Connect Google</strong> on the Schedule tab and clear{" "}
            <code className="rounded bg-blue-100 px-1">EMAIL_DRY_RUN</code>.)
          </p>
        ) : (
          <p>
            <strong>Live mode.</strong> Emails are really being sent from your Gmail, and also logged
            here. Set <code className="rounded bg-amber-100 px-1">EMAIL_DRY_RUN=true</code> to switch
            to capture-only testing.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Try it out</h2>
        {active ? (
          <p className="mt-1 text-xs text-stone-500">
            Active session: <strong>{active.title}</strong> on {active.event_date}. The buttons below
            fire the real flow immediately (ignoring the weekday schedule), so you can click the
            captured links and watch sign-ups land on the dashboard.
          </p>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            No active session yet — create one on the{" "}
            <a className="underline" href={`${base}/sessions`}>
              Sessions
            </a>{" "}
            tab and mark it active to test invites.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={sendTestInvites.bind(null, base)}>
            <button
              type="submit"
              disabled={!active}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              Send test invites now
            </button>
          </form>
          <form action={sendTestReminder.bind(null, base)}>
            <button
              type="submit"
              disabled={!active}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50 disabled:opacity-40"
            >
              Send test reminder
            </button>
          </form>
          {emails.length > 0 && (
            <form action={clearOutbox.bind(null, base)} className="ml-auto">
              <button
                type="submit"
                className="rounded-lg px-4 py-2 text-sm text-stone-400 transition hover:text-red-600"
              >
                Clear outbox
              </button>
            </form>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-600">
          Captured emails ({emails.length})
        </h2>
        {emails.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
            Nothing here yet. Use “Send test invites now” above, or “Run scheduler now” on the
            dashboard.
          </p>
        ) : (
          <ul className="space-y-3">
            {emails.map((e) => (
              <li key={e.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm">
                    <KindBadge kind={e.kind} />
                    <span className="font-medium">{e.to_name || e.to_email}</span>
                    <span className="truncate text-stone-500">— {e.subject}</span>
                    <span className="ml-auto text-xs text-stone-400">{when(e.created_at)}</span>
                  </summary>
                  <div className="space-y-3 border-t border-stone-100 px-4 py-4">
                    <p className="text-xs text-stone-500">
                      To: {e.to_name ? `${e.to_name} ` : ""}&lt;{e.to_email}&gt; ·{" "}
                      <span className="uppercase">{e.mode}</span>
                    </p>
                    {e.signup_url && (
                      <p className="text-sm">
                        Signup link:{" "}
                        <a
                          href={e.signup_url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-blue-600 underline"
                        >
                          {e.signup_url}
                        </a>
                      </p>
                    )}
                    <iframe
                      srcDoc={e.html}
                      sandbox=""
                      title={e.subject}
                      className="h-80 w-full rounded-lg border border-stone-200 bg-white"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
