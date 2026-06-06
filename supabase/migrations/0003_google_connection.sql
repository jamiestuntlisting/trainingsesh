-- Stores the Google connection (Gmail send + Calendar) obtained via the in-app
-- "Connect Google" OAuth flow, so no refresh token lives in an env var.
alter table public.settings
  add column if not exists google_refresh_token text,
  add column if not exists google_email text;
