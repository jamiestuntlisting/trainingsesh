import { isSupabaseConfigured } from "@/lib/supabase";
import { emailConfigured } from "@/lib/email";
import { calendarConfigured } from "@/lib/calendar";
import { stuntlistingConfigured } from "@/lib/stuntlisting";
import { getActiveSession, getSessionSignups, getSettings } from "@/lib/data";
import { WEEKDAYS, type Session } from "@/lib/types";
import { configDiagnostics, describeError } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import DispatchButton from "@/components/DispatchButton";
import type { SignupWithContact } from "@/lib/data";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmt(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Health({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3">
      <span
        className={`mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
          ok ? "bg-green-500" : "bg-stone-300"
        }`}
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-stone-500">{ok ? "Ready" : hint}</p>
      </div>
    </div>
  );
}

export default async function Dashboard({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <ConfigNotice />
      </div>
    );
  }

  let settings: Settings;
  let active: Session | null;
  let signups: SignupWithContact[];
  try {
    [settings, active] = await Promise.all([getSettings(), getActiveSession()]);
    signups = active ? await getSessionSignups(active.id) : [];
  } catch (e) {
    return <SetupDiagnostics diag={configDiagnostics()} error={describeError(e)} />;
  }
  const confirmed = signups.filter((s) => s.status === "yes").length;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        {active ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                Active session
              </p>
              <h2 className="mt-1 text-xl font-semibold">{active.title}</h2>
              <p className="text-stone-600">{fmt(active.event_date)}</p>
              {active.location && (
                <p className="text-sm text-stone-500">{active.location}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-green-700">
                {confirmed}
                {active.capacity ? (
                  <span className="text-lg text-stone-400"> / {active.capacity}</span>
                ) : null}
              </p>
              <p className="text-xs text-stone-500">confirmed of {signups.length} invited</p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">No active session</h2>
            <p className="mt-1 text-sm text-stone-500">
              Create one on the{" "}
              <a className="underline" href={`${base}/sessions`}>
                Sessions
              </a>{" "}
              tab and mark it active to start inviting people.
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-600">Scheduler</h2>
          <DispatchButton basePath={base} />
        </div>
        <p className="text-sm text-stone-500">
          Reminder to you on <strong>{WEEKDAYS[settings.reminder_weekday]}</strong>, then each
          group is invited on its configured day in the lead-up to the active session
          (timezone {settings.timezone}). The button above runs that check immediately.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-600">Integration status</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Health
            ok={emailConfigured()}
            label="Email (SendGrid)"
            hint="Set SENDGRID_API_KEY + EMAIL_FROM. Until then, emails are logged, not sent."
          />
          <Health
            ok={Boolean(settings.admin_email)}
            label="Reminder recipient"
            hint="Set your email on the Schedule tab so reminders have somewhere to go."
          />
          <Health
            ok={calendarConfigured()}
            label="Google Calendar"
            hint="Optional. Set GOOGLE_* env vars to mirror sessions to your calendar."
          />
          <Health
            ok={stuntlistingConfigured()}
            label="Stuntlisting sync"
            hint="Optional. Set STUNTLISTING_API_URL once you share the API details."
          />
        </div>
      </section>
    </div>
  );
}
