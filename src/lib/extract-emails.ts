// Pull email addresses (and best-effort names) out of an arbitrary pasted blob.
// Handles bare addresses, "Name <email>", comma/space/newline separated lists,
// and quoted display names like "Doe, Jane" <jane@x.com>.

export interface ExtractedContact {
  email: string;
  name: string | null;
}

const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

export function extractContacts(input: string): ExtractedContact[] {
  if (!input) return [];

  const byEmail = new Map<string, ExtractedContact>();

  // First pass: "Display Name <email>" patterns capture a name.
  const namedRe = /"?([^"<>\n,]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(input)) !== null) {
    const email = normalizeEmail(m[2]);
    if (!email) continue;
    const name = cleanName(m[1]);
    if (!byEmail.has(email)) byEmail.set(email, { email, name });
  }

  // Second pass: every bare address not already captured.
  const found = input.match(EMAIL_RE) ?? [];
  for (const raw of found) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, { email, name: null });
  }

  return [...byEmail.values()];
}

function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase().replace(/[.,;]+$/, "");
  // basic sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function cleanName(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, " ");
  if (!n) return null;
  // Skip values that are actually just the email or junk.
  if (n.includes("@")) return null;
  return n;
}
