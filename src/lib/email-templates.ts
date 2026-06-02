import type { OutgoingEmail } from "./email";
import { WEEKDAYS } from "./types";

// Plain, unbranded email templates. No external branding anywhere.

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
      ${body}
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${escapeHtml(
    label,
  )}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ymd: string): string {
  // ymd is 'YYYY-MM-DD'; render without timezone drift.
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface InviteData {
  toEmail: string;
  toName: string | null;
  signupUrl: string;
  title: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
}

export function inviteEmail(d: InviteData): OutgoingEmail {
  const when = `${formatDate(d.eventDate)}${d.eventTime ? ` at ${formatTime(d.eventTime)}` : ""}`;
  const where = d.location ? `<p style="margin:0 0 16px;color:#57534e">Where: ${escapeHtml(d.location)}</p>` : "";
  const text = `${d.title}\n\nWhen: ${when}\n${d.location ? `Where: ${d.location}\n` : ""}\nYou're invited. Tap to let me know if you're in:\n${d.signupUrl}\n\nThis link is just for you and just for this date.`;
  const html = layout(d.title, `
    <p style="margin:0 0 8px;font-size:16px">When: <strong>${when}</strong></p>
    ${where}
    <p style="margin:0 0 20px;color:#57534e">You're invited. Tap below to let me know if you can make it.</p>
    <p style="margin:0 0 20px">${button(d.signupUrl, "I'm in")}</p>
    <p style="margin:0;color:#a8a29e;font-size:13px">This link is just for you and just for this date.</p>
  `);
  return { to: d.toEmail, toName: d.toName, subject: `${d.title} — ${formatDate(d.eventDate)}`, html, text };
}

export interface ReminderGroupLine {
  groupName: string;
  sendWeekday: number | null;
  members: { name: string | null; email: string }[];
}

export interface ReminderData {
  toEmail: string;
  title: string;
  eventDate: string;
  groups: ReminderGroupLine[];
  ungrouped: { name: string | null; email: string }[];
}

export function reminderEmail(d: ReminderData): OutgoingEmail {
  const renderMember = (m: { name: string | null; email: string }) =>
    `${m.name ? `${escapeHtml(m.name)} ` : ""}&lt;${escapeHtml(m.email)}&gt;`;

  const sections = d.groups
    .map((g) => {
      const day = g.sendWeekday != null ? ` — emails ${WEEKDAYS[g.sendWeekday]}` : "";
      const rows = g.members.length
        ? g.members.map((m) => `<li style="margin:2px 0">${renderMember(m)}</li>`).join("")
        : `<li style="color:#a8a29e">(empty)</li>`;
      return `<h3 style="margin:18px 0 6px;font-size:15px">${escapeHtml(g.groupName)} <span style="color:#a8a29e;font-weight:400">(${g.members.length})${day}</span></h3><ul style="margin:0;padding-left:18px">${rows}</ul>`;
    })
    .join("");

  const ungroupedSection = d.ungrouped.length
    ? `<h3 style="margin:18px 0 6px;font-size:15px">Ungrouped <span style="color:#a8a29e;font-weight:400">(${d.ungrouped.length})</span></h3><ul style="margin:0;padding-left:18px">${d.ungrouped
        .map((m) => `<li style="margin:2px 0">${renderMember(m)}</li>`)
        .join("")}</ul>`
    : "";

  const html = layout(
    `This week: ${d.title}`,
    `<p style="margin:0 0 4px;color:#57534e">Event date: <strong>${formatDate(d.eventDate)}</strong></p>
     <p style="margin:0 0 8px;color:#57534e">Here's who's on each list and when they'll be invited.</p>
     ${sections}${ungroupedSection}`,
  );

  const textGroups = d.groups
    .map((g) => {
      const day = g.sendWeekday != null ? ` (emails ${WEEKDAYS[g.sendWeekday]})` : "";
      const lines = g.members.length
        ? g.members.map((m) => `  - ${m.name ? m.name + " " : ""}<${m.email}>`).join("\n")
        : "  (empty)";
      return `${g.groupName} [${g.members.length}]${day}\n${lines}`;
    })
    .join("\n\n");
  const text = `This week: ${d.title}\nEvent date: ${formatDate(d.eventDate)}\n\n${textGroups}${
    d.ungrouped.length ? `\n\nUngrouped [${d.ungrouped.length}]\n${d.ungrouped.map((m) => `  - <${m.email}>`).join("\n")}` : ""
  }`;

  return { to: d.toEmail, subject: `Training this week — ${formatDate(d.eventDate)}`, html, text };
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
