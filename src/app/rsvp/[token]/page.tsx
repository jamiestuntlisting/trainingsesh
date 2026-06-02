import { getSignupByToken, getSettings } from "@/lib/data";
import { zonedNow } from "@/lib/time";
import { respond } from "./actions";

export const dynamic = "force-dynamic";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">{children}</div>
    </main>
  );
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let signup: Awaited<ReturnType<typeof getSignupByToken>> = null;
  try {
    signup = await getSignupByToken(token);
  } catch {
    signup = null;
  }

  if (!signup) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-stone-500">
          Double-check the link, or ask whoever invited you to resend it.
        </p>
      </Card>
    );
  }

  const session = signup.session;
  const settings = await getSettings();
  const today = zonedNow(settings.timezone).ymd;
  const closed = !session.is_active || session.event_date < today;

  const when = `${formatDate(session.event_date)}${
    formatTime(session.event_time) ? ` · ${formatTime(session.event_time)}` : ""
  }`;

  if (closed) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Sign-ups are closed</h1>
        <p className="mt-2 text-sm text-stone-500">
          This date ({when}) is no longer taking responses.
        </p>
      </Card>
    );
  }

  const answered = signup.status === "yes" || signup.status === "no";

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        You&apos;re invited
      </p>
      <h1 className="mt-1 text-xl font-semibold">{session.title}</h1>
      <p className="mt-3 text-base">{when}</p>
      {session.location && (
        <p className="mt-1 text-sm text-stone-500">{session.location}</p>
      )}
      {session.notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-stone-600">{session.notes}</p>
      )}

      {answered && (
        <div
          className={`mt-5 rounded-lg px-4 py-3 text-sm ${
            signup.status === "yes"
              ? "bg-green-50 text-green-800"
              : "bg-stone-100 text-stone-600"
          }`}
        >
          {signup.status === "yes"
            ? "You're in. 🎬 Change of plans? Update below."
            : "You're marked as not attending. Changed your mind?"}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <form action={respond.bind(null, token, "yes")} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white transition hover:bg-stone-700"
          >
            I&apos;m in
          </button>
        </form>
        <form action={respond.bind(null, token, "no")} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Can&apos;t make it
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-stone-400">
        This link is just for you and just for this date.
      </p>
    </Card>
  );
}
