// Safe, secret-free snapshot of the runtime configuration. Used to turn opaque
// 500s into actionable setup guidance. Never returns secret VALUES — only
// whether they're present, plus the non-sensitive Supabase host (which ships to
// the browser via NEXT_PUBLIC anyway).

export interface ConfigDiagnostics {
  hasSupabaseUrl: boolean;
  hasServiceKey: boolean;
  supabaseUrlValid: boolean;
  supabaseHost: string;
  hasAppUrl: boolean;
  appUrl: string;
  hasCronSecret: boolean;
  hasAdminSecret: boolean;
  emailReady: boolean;
}

export function configDiagnostics(): ConfigDiagnostics {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let supabaseHost = "";
  let supabaseUrlValid = false;
  try {
    supabaseHost = new URL(rawUrl).host;
    supabaseUrlValid = true;
  } catch {
    // Show a hint of what's there without leaking anything sensitive.
    supabaseHost = rawUrl ? `(unparseable: "${rawUrl.slice(0, 40)}")` : "(empty)";
  }

  return {
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrlValid,
    supabaseHost,
    hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasAdminSecret: Boolean(process.env.ADMIN_SECRET),
    emailReady: Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM),
  };
}
