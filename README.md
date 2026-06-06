# Training Scheduler

A private tool for organizing training sessions: keep contacts, sort them into
ordered groups, and invite each group on its own day in the lead-up to a session.
People confirm with a one-tap link that's unique to them and to a single date.
Confirmed attendees show up on your Google Calendar.

It's a personal tool — no external branding anywhere.

## How it works

- **Contacts** — paste any text (a list, a forwarded email, `Name <email>` pairs)
  and it extracts the addresses, skipping duplicates. Or sync from the
  stuntlisting API.
- **Groups** — ordered tiers. Drag people between groups on the Groups tab.
  Each group has a send day (e.g. Group 1 → Wednesday, Group 2 → Thursday,
  Group 3 → Friday). Fully adjustable on the Schedule tab.
- **Sessions** — each has the single date you set. Mark one "active" and it
  starts taking sign-ups.
- **The schedule** — on your chosen reminder day you get an email listing
  who's in each group. Then each group is emailed its invite on its day.
  All times are evaluated in your configured timezone, and every send is
  idempotent (it never double-sends).
- **Sign-up links** — each invite contains a link unique to that person and
  that one session. Nobody can sign up early or for a future week, because a
  token only exists once you've invited them for a specific date.
- **Calendar** — the active session is mirrored to your Google Calendar with
  the confirmed attendee list in the event description. (Google doesn't email
  anyone — your app is the only thing that contacts people.)

## Stack

Next.js (App Router) · Supabase (Postgres) · SendGrid · Google Calendar ·
Vercel Cron. Drag-and-drop via `@dnd-kit`.

## Local setup

```bash
npm install
cp .env.example .env.local      # then fill it in (see below)
npm run dev
```

- Admin dashboard: `http://localhost:3000/a/<ADMIN_SECRET>`
- A wrong secret returns 404, so the dashboard's existence isn't revealed.

## Testing without sending real email

Without `SENDGRID_API_KEY` (or with `EMAIL_DRY_RUN=true`), the app runs in
**test mode**: nothing is actually sent. Instead, every email is captured in the
**Outbox** tab, where you can read the rendered message and click the unique
signup link. The **“Send test invites now”** button there fires the whole invite
flow for the active session immediately — ignoring the weekday schedule — so you
can click a link, RSVP, and watch the count update on the dashboard. It's a full
end-to-end test loop with zero real emails.

## Environment variables

See `.env.example` for the full annotated list. The essentials:

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build sign-up links |
| `ADMIN_SECRET` | The secret path that gates the dashboard (`/a/<secret>`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database |
| `SENDGRID_API_KEY`, `EMAIL_FROM` | Sending email |
| `CRON_SECRET` | Protects the `/api/cron` endpoint |
| `GOOGLE_*` | Optional — Google Calendar sync |
| `STUNTLISTING_*` | Optional — stuntlisting contact sync |

Generate secrets with `openssl rand -hex 24`.

## Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in `supabase/migrations/0001_init.sql` — paste it into the
   Supabase **SQL Editor** and run, or use the Supabase CLI.
3. Copy the project URL and **service role** key (Settings → API) into your env.

Every table has Row Level Security on with no policies, so the only way in is
the server-side service role key. Never expose that key to the browser.

## Email + Calendar (Google) setup

Email is sent through **Gmail** (free, from your own address, no domain), and
Calendar sync uses the **same** Google connection. The refresh token is obtained
with a one-click in-app **Connect Google** button and stored in the database —
you never paste a token into env.

One-time setup in [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project and **enable the Gmail API and the Google Calendar API**.
2. Configure the **OAuth consent screen** (External). Add your Google address as
   a test user, then **Publish** the app ("In production") — important, because
   apps left in "Testing" issue refresh tokens that expire after 7 days.
3. Create an **OAuth client ID** → *Web application*. Add this Authorized
   redirect URI (your deployment URL + `/api/google/callback`):

   ```
   https://trainingsesh.vercel.app/api/google/callback
   ```

4. Put the client id/secret in your env as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then redeploy.
5. In the app: **Schedule → Connect Google** → approve. Done — email sends from
   your Gmail and Calendar sync is live.

Until Google is connected, email runs in **test mode** (captured in the Outbox,
see below). `GOOGLE_CALENDAR_ID` defaults to `primary`. There's also a CLI
fallback (`npm run google-auth`) that mints a `GOOGLE_REFRESH_TOKEN` if you'd
rather not use the in-app flow.

## Stuntlisting sync (optional)

`src/lib/stuntlisting.ts` reads contacts directly from the stuntlisting MySQL
database. It is **strictly read-only** — it only runs `SELECT`s, and the
configurable query is validated to reject anything that isn't a single SELECT.

Configure with `STUNTLISTING_DB_*` (see `.env.example`). The query must return
columns aliased `email` and (optionally) `name`; override it with
`STUNTLISTING_QUERY` if the default `users`-table query doesn't match the schema.

On the Contacts tab, **Preview schema** lists tables that have an email column
and previews the query (handy for finding the right table/columns), and **Sync
from stuntlisting** imports them.

Networking notes:
- The database must be reachable from the app's host. On Vercel that means the
  RDS security group has to allow the function's egress. Vercel serverless IPs
  are dynamic, so prefer a static-egress option (Vercel Secure Compute, an RDS
  Proxy, or a bastion) over opening the group to the world.
- Credentials are secrets — keep them in env vars only, and prefer a
  least-privilege read-only DB user.

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Add all the env vars from `.env.example` in the Vercel project settings.
   Set `NEXT_PUBLIC_APP_URL` to your deployment URL.
3. `vercel.json` registers a daily cron hitting `/api/cron`. On the Hobby plan
   crons run once per day; the dispatcher figures out what's due. On Pro you can
   change the schedule in `vercel.json` to hourly (`0 * * * *`) for minute-level
   send-time precision.

The cron is protected by `CRON_SECRET`. You can trigger a run manually with the
**Run scheduler now** button on the dashboard.
