import sgMail from "@sendgrid/mail";

// SendGrid adapter. If SENDGRID_API_KEY is unset, we run in DRY-RUN mode and
// log to the console instead of sending — so local development works with no
// account. Use SendGrid "Single Sender Verification" to send from your Gmail
// without owning a domain.

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: OutgoingEmail): Promise<void> {
  const from = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Stunt Training";
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey || !from) {
    // DRY RUN
    console.log(
      `[email:dry-run] → ${msg.to} | ${msg.subject}\n${msg.text}\n`,
    );
    return;
  }

  sgMail.setApiKey(apiKey);
  await sgMail.send({
    to: msg.toName ? { email: msg.to, name: msg.toName } : msg.to,
    from: { email: from, name: fromName },
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
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
