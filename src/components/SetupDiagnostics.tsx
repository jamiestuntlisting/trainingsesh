import type { ConfigDiagnostics } from "@/lib/diagnostics";

// Rendered (behind the secret admin URL) when a database call fails, instead of
// crashing with a 500. Shows exactly which piece of configuration is off.
function Row({ ok, label, value }: { ok: boolean; label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
        />
        {label}
      </span>
      {value !== undefined && (
        <code className="truncate rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
          {value}
        </code>
      )}
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
          The checklist below shows what&apos;s configured. Fix any red item in your
          Vercel project&apos;s environment variables, then redeploy.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <Row ok={diag.hasSupabaseUrl} label="NEXT_PUBLIC_SUPABASE_URL is set" />
        <Row
          ok={diag.supabaseUrlValid}
          label="…and is a valid URL"
          value={diag.supabaseHost}
        />
        <Row ok={diag.hasServiceKey} label="SUPABASE_SERVICE_ROLE_KEY is set" />
        <Row ok={diag.hasAdminSecret} label="ADMIN_SECRET is set" />
        <Row ok={diag.hasCronSecret} label="CRON_SECRET is set" />
        <Row
          ok={diag.hasAppUrl}
          label="NEXT_PUBLIC_APP_URL is set"
          value={diag.appUrl || undefined}
        />
        <Row ok={diag.emailReady} label="Email (SendGrid) ready — optional" />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-medium text-stone-500">Expected Supabase host</p>
        <code className="text-xs">ukkiukzudlbfauraqgeu.supabase.co</code>
        {error && (
          <>
            <p className="mt-3 text-xs font-medium text-stone-500">Technical detail</p>
            <pre className="mt-1 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
              {error}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
