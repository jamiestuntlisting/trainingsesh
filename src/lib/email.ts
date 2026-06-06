import { google } from "googleapis";
import { getServiceClient } from "./supabase";
import { authorizedClient, getConnectedEmail, googleConnected } from "./google";

// Email is sent through the Gmail API using the account connected via the
// in-app "Connect Google" flow. If Google isn't connected (or EMAIL_DRY_RUN is
// set), we run in TEST mode: nothing is sent and the message is captured in the
// Outbox so you can review it and click the signup link.

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  kind?: string; // 'invite' | 'reminder' | 'test' | 'other'
  signupUrl?: string | null;
  sessionId?: string | null;
}

function forcedDryRun(): boolean {
  const v = (process.env.EMAIL_DRY_RUN || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

// True when a real send will happen (Google connected and not forced to test).
export async function emailReady(): Promise<boolean> {
  if (forcedDryRun()) return false;
  return googleConnected();
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
    console.error("[outbox] failed to record email:", e);
  }
}

// ── MIME assembly for the Gmail API ──────────────────────────────────────────
function encodeHeaderValue(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value; // plain ASCII
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function address(email: string, name?: string | null): string {
  return name ? `${encodeHeaderValue(name)} <${email}>` : email;
}

function b64Body(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n");
}

function buildRawMessage(
  msg: OutgoingEmail,
  from: string | null,
  fromName: string,
): string {
  const boundary = `b_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const headers = [
    `To: ${address(msg.to, msg.toName ?? undefined)}`,
    `Subject: ${encodeHeaderValue(msg.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (from) headers.unshift(`From: ${address(from, fromName)}`);

  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Body(msg.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Body(msg.html),
    `--${boundary}--`,
    "",
  ];

  const raw = [...headers, "", ...body].join("\r\n");
  return Buffer.from(raw, "utf-8").toString("base64url");
}

export async function sendEmail(msg: OutgoingEmail): Promise<void> {
  if (!(await emailReady())) {
    console.log(`[email:dry-run] → ${msg.to} | ${msg.subject}`);
    await recordOutbox(msg, "dry-run");
    return;
  }

  const fromEmail = (process.env.EMAIL_FROM || (await getConnectedEmail()) || "").trim();
  const fromName = process.env.EMAIL_FROM_NAME || "Stunt Training";

  const client = await authorizedClient();
  const gmail = google.gmail({ version: "v1", auth: client });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMessage(msg, fromEmail || null, fromName) },
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
