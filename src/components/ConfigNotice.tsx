// Shown on admin pages when Supabase isn't wired up yet, so the dashboard
// renders something useful instead of crashing during local setup.
export default function ConfigNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Database not configured yet</p>
      <p className="mt-1">
        Set <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> in your
        environment, then run the migration in{" "}
        <code className="rounded bg-amber-100 px-1">supabase/migrations</code>. See the README for
        step-by-step setup.
      </p>
    </div>
  );
}
