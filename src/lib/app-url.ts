// The app's public base URL, used for signup links and OAuth redirects.
// Prefers an explicitly-set NEXT_PUBLIC_APP_URL (only if it's a real URL),
// otherwise falls back to Vercel's injected production URL.
export function appUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (/^https?:\/\/.+/i.test(explicit)) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");

  return "http://localhost:3000";
}
