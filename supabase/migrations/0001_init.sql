-- ───────────────────────────────────────────────────────────────────────────
-- Stunt training scheduler — initial schema
-- Weekday convention everywhere: 0=Sunday, 1=Monday, ... 6=Saturday (JS getDay)
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Contacts ────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  name       text,
  source     text not null default 'paste',   -- 'paste' | 'stuntlisting' | 'manual'
  created_at timestamptz not null default now()
);

-- ── Groups (ordered waterfall tiers) ────────────────────────────────────────
create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  position     int not null default 0,          -- lower = invited earlier
  send_weekday smallint,                         -- 0..6, day this group is invited
  send_time    time not null default '09:00',
  created_at   timestamptz not null default now()
);

-- ── Group membership (a contact sits in at most one group) ───────────────────
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  position   int not null default 0,             -- order within the group
  created_at timestamptz not null default now(),
  unique (contact_id)
);
create index if not exists group_members_group_idx on public.group_members(group_id, position);

-- ── Sessions (each has the single date you set) ──────────────────────────────
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default 'Stunt Training',
  event_date      date not null,
  event_time      time,
  location        text,
  capacity        int,
  notes           text,
  is_active       boolean not null default false, -- the one currently taking signups
  google_event_id text,
  created_at      timestamptz not null default now()
);
create index if not exists sessions_active_idx on public.sessions(is_active);

-- ── Signups (one unique token per contact per session) ───────────────────────
create table if not exists public.signups (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  group_id     uuid references public.groups(id) on delete set null,
  token        text not null unique,
  status       text not null default 'invited',  -- 'invited' | 'yes' | 'no'
  invited_at   timestamptz,
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (session_id, contact_id)
);
create index if not exists signups_session_idx on public.signups(session_id);
create index if not exists signups_token_idx on public.signups(token);

-- ── Send log (idempotency guard so the cron never double-sends) ──────────────
create table if not exists public.send_log (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  kind       text not null,                       -- 'reminder' | 'group_invite'
  group_id   uuid references public.groups(id) on delete cascade,
  sent_on    date not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (session_id, kind, group_id, sent_on)
);

-- ── Settings (single row) ────────────────────────────────────────────────────
create table if not exists public.settings (
  id               boolean primary key default true,
  reminder_weekday smallint not null default 2,    -- Tuesday
  reminder_time    time not null default '09:00',
  admin_email      text,                            -- where your Tuesday reminder goes
  timezone         text not null default 'America/Los_Angeles',
  updated_at       timestamptz not null default now(),
  constraint settings_singleton check (id)
);

-- ── Seed defaults ────────────────────────────────────────────────────────────
insert into public.settings (id) values (true) on conflict (id) do nothing;

insert into public.groups (name, position, send_weekday)
values
  ('Group 1', 0, 3),   -- Wednesday
  ('Group 2', 1, 4),   -- Thursday
  ('Group 3', 2, 5)    -- Friday
on conflict do nothing;

-- ── Lock everything down. All app access goes through the service role,
--    which bypasses RLS. With RLS on and no policies, the anon/public key
--    can read or write nothing. ────────────────────────────────────────────
alter table public.contacts      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.sessions      enable row level security;
alter table public.signups       enable row level security;
alter table public.send_log      enable row level security;
alter table public.settings      enable row level security;
