import sgMail from "@sendgrid/mail";
import { getServiceClient } from "./supabase";

// SendGrid adapter with a built-in TEST/dry-run mode. When dry-run is active,
// nothing is actually sent — the message is recorded in the "Outbox" table so
// you can review it (and click the signup link) in the admin UI. Dry-run is on
// whenever SendGrid isn't configured, or can be forced with EMAIL_DRY_RUN=true.

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  // Optional metadata for the Outbox.
  kind?: string; // 'invite' | 'reminder' | 'test' | 'other'
  signupUrl?: string | null;
  sessionId?: string | null;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

// True when we should pretend to send instead of really sending.
export function isDryRun(): boolean {
  const forced = (process.env.EMAIL_DRY_RUN || "").toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes") return true;
  return !emailConfigured();
}

async function recordOutbox(msg: OutgoingEmail, mode: "dry-run" | "live") {
  try {
    const db = getServiceClient();
    await db.from("sent_emails").insert({
      to_email: msg.to,
      to_name: msg.toName ?? null,
      subject: msg.subject,
      html: msg.html,
      body_text: msg.text,
      kind: msg.kind ?? "other",
      signup_url: msg.signupUrl ?? null,
      session_id: msg.sessionId ?? null,
      mode,
    });
  } catch (e) {
    // Never let Outbox bookkeeping break a send.
    console.error("[outbox] failed to record email:", e);
  }
}

export async function sendEmail(msg: OutgoingEmail): Promise<void> {
  if (isDryRun()) {
    console.log(`[email:dry-run] → ${msg.to} | ${msg.subject}`);
    await recordOutbox(msg, "dry-run");
    return;
  }

  const from = process.env.EMAIL_FROM as string;
  const fromName = process.env.EMAIL_FROM_NAME || "Stunt Training";
  sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
  await sgMail.send({
    to: msg.toName ? { email: msg.to, name: msg.toName } : msg.to,
    from: { email: from, name: fromName },
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
  await recordOutbox(msg, "live");
}

// Send many, isolating failures so one bad address doesn't abort the batch.
export async function sendBatch(
  messages: OutgoingEmail[],
): Promise<{ sent: number; failed: { to: string; error: string }[] }> {
  let sent = 0;
  const failed: { to: string; error: string }[] = [];
  for (const m of messages) {
    try {
      await sendEmail(m);
      sent++;
    } catch (e) {
      failed.push({ to: m.to, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { sent, failed };
}
