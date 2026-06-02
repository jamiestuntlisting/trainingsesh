-- ───────────────────────────────────────────────────────────────────────────
-- Test "Outbox": every email the app sends (or pretend-sends in dry-run/test
-- mode) is captured here so it can be reviewed in the admin UI without a real
-- email provider. Locked down like everything else (service-role only).
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.sent_emails (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  to_name    text,
  subject    text not null,
  html       text not null,
  body_text  text not null,
  kind       text not null default 'other',   -- 'invite' | 'reminder' | 'test' | 'other'
  signup_url text,
  session_id uuid references public.sessions(id) on delete set null,
  mode       text not null default 'dry-run',  -- 'dry-run' | 'live'
  created_at timestamptz not null default now()
);
create index if not exists sent_emails_created_idx on public.sent_emails(created_at desc);
alter table public.sent_emails enable row level security;
