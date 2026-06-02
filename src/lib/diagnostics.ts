// Safe, secret-free snapshot of the runtime configuration. Used to turn opaque
// 500s into actionable setup guidance. Never returns secret VALUES — only
// whether they're present/well-formed, plus the non-sensitive Supabase host
// (which ships to the browser via NEXT_PUBLIC anyway).

export interface ConfigDiagnostics {
  hasSupabaseUrl: boolean;
  supabaseUrlValid: boolean;
  supabaseHost: string;
  hasServiceKey: boolean;
  serviceKeyLooksValid: boolean;
  hasAdminSecret: boolean;
  hasCronSecret: boolean;
  hasAppUrl: boolean;
  appUrlValid: boolean;
  appUrl: string;
  emailReady: boolean;
}

export function configDiagnostics(): ConfigDiagnostics {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  let supabaseHost = "";
  let supabaseUrlValid = false;
  try {
    const u = new URL(rawUrl);
    supabaseHost = u.host;
    supabaseUrlValid = u.protocol === "https:" || u.protocol === "http:";
  } catch {
    supabaseHost = rawUrl ? `(unparseable: "${rawUrl.slice(0, 40)}")` : "(empty)";
  }

  const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  // A real privileged key is either a legacy service_role JWT (eyJ…) or a
  // modern secret key (sb_secret_…). Anything else — including a pasted
  // placeholder or a publishable/anon key — is wrong for server use.
  const serviceKeyLooksValid =
    rawKey.startsWith("eyJ") || rawKey.startsWith("sb_secret_");

  const rawAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const appUrlValid = /^https?:\/\/.+/i.test(rawAppUrl);

  return {
    hasSupabaseUrl: Boolean(rawUrl),
    supabaseUrlValid,
    supabaseHost,
    hasServiceKey: Boolean(rawKey),
    serviceKeyLooksValid,
    hasAdminSecret: Boolean(process.env.ADMIN_SECRET),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasAppUrl: Boolean(rawAppUrl),
    appUrlValid,
    appUrl: rawAppUrl,
    emailReady: Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM),
  };
}

// Turn any thrown value (Error, Supabase error object, string) into a readable
// message — Supabase client errors are plain objects, which otherwise stringify
// to a useless "[object Object]".
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
