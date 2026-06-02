import type { ConfigDiagnostics } from "@/lib/diagnostics";

// Rendered (behind the secret admin URL) when a database call fails, instead of
// crashing with a 500. Shows exactly which piece of configuration is off.
function Row({
  ok,
  label,
  value,
  hint,
}: {
  ok: boolean;
  label: string;
  value?: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-stone-100 py-2 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              ok ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {label}
        </span>
        {value !== undefined && (
          <code className="max-w-[55%] truncate rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
            {value}
          </code>
        )}
      </div>
      {!ok && hint && <p className="mt-1 pl-4 text-xs text-red-600">{hint}</p>}
    </div>
  );
}

export default function SetupDiagnostics({
  diag,
  error,
}: {
  diag: ConfigDiagnostics;
  error?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-sm font-semibold text-red-800">
          Couldn&apos;t reach the database
        </h2>
        <p className="mt-1 text-sm text-red-700">
          The app is deployed and the admin URL works, but a database call failed.
          Fix any red item below in your Vercel project&apos;s Environment Variables,
          then redeploy.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white px-5 py-3">
        <Row
          ok={diag.hasSupabaseUrl && diag.supabaseUrlValid}
          label="NEXT_PUBLIC_SUPABASE_URL"
          value={diag.supabaseHost}
          hint="Should be https://ukkiukzudlbfauraqgeu.supabase.co"
        />
        <Row
          ok={diag.serviceKeyLooksValid}
          label="SUPABASE_SERVICE_ROLE_KEY"
          hint="Doesn't look like a key. Paste the service_role secret (starts with eyJ…) from Supabase → Settings → API."
        />
        <Row ok={diag.hasAdminSecret} label="ADMIN_SECRET" />
        <Row ok={diag.hasCronSecret} label="CRON_SECRET" />
        <Row
          ok={diag.appUrlValid}
          label="NEXT_PUBLIC_APP_URL"
          value={diag.appUrl || "(empty)"}
          hint="Set this to https://trainingsesh.vercel.app (it must start with https://)."
        />
        <Row ok={diag.emailReady} label="Email (SendGrid) — optional" />
      </div>

      {error && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium text-stone-500">Technical detail</p>
          <pre className="mt-1 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}
