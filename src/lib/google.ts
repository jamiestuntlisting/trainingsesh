import { google } from "googleapis";
import { getServiceClient, isSupabaseConfigured } from "./supabase";
import { appUrl } from "./app-url";

// Shared Google OAuth used for both sending email (Gmail) and Calendar sync.
// The refresh token is obtained via the in-app "Connect Google" flow and stored
// in the database — no token in an env var. The OAuth client id/secret DO come
// from env (you create them once in Google Cloud Console).

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// The redirect URI you must register on the OAuth client in Google Cloud.
export function googleRedirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

export function oauthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

async function readGoogleSettings(): Promise<{ token: string | null; email: string | null }> {
  if (!isSupabaseConfigured()) return { token: null, email: null };
  try {
    const db = getServiceClient();
    const { data } = await db
      .from("settings")
      .select("google_refresh_token, google_email")
      .eq("id", true)
      .maybeSingle();
    return {
      token: (data?.google_refresh_token as string) ?? null,
      email: (data?.google_email as string) ?? null,
    };
  } catch {
    return { token: null, email: null };
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const { token } = await readGoogleSettings();
  return token ?? (process.env.GOOGLE_REFRESH_TOKEN || null);
}

export async function getConnectedEmail(): Promise<string | null> {
  const { email } = await readGoogleSettings();
  return email;
}

export async function googleConnected(): Promise<boolean> {
  if (!googleConfigured()) return false;
  return Boolean(await getStoredRefreshToken());
}

// An OAuth2 client primed with the stored refresh token, ready to call APIs.
export async function authorizedClient() {
  const refreshToken = await getStoredRefreshToken();
  if (!googleConfigured() || !refreshToken) {
    throw new Error("Google isn't connected. Use “Connect Google” on the Schedule tab.");
  }
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function consentUrl(state: string): string {
  return oauthClient(googleRedirectUri()).generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

function emailFromIdToken(idToken?: string | null): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  code: string,
): Promise<{ refreshToken: string | null; email: string | null }> {
  const client = oauthClient(googleRedirectUri());
  const { tokens } = await client.getToken(code);
  return {
    refreshToken: tokens.refresh_token ?? null,
    email: emailFromIdToken(tokens.id_token),
  };
}

export async function storeGoogleConnection(
  refreshToken: string,
  email: string | null,
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("settings")
    .update({
      google_refresh_token: refreshToken,
      google_email: email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
}

export async function disconnectGoogle(): Promise<void> {
  const db = getServiceClient();
  await db
    .from("settings")
    .update({ google_refresh_token: null, google_email: null, updated_at: new Date().toISOString() })
    .eq("id", true);
}
