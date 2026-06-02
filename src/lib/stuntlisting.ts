// Stuntlisting import adapter.
//
// ⚠️  PLACEHOLDER until you share the real API details (base URL, auth scheme,
// and response shape). Right now it assumes a simple authenticated GET that
// returns a JSON array of objects, and maps two configurable fields onto
// {email, name}. Tell me the real contract and I'll wire it up exactly.
//
// Configure via env:
//   STUNTLISTING_API_URL      full endpoint returning JSON
//   STUNTLISTING_API_KEY      sent as `Authorization: Bearer <key>`
//   STUNTLISTING_EMAIL_FIELD  field name to read the email from (default "email")
//   STUNTLISTING_NAME_FIELD   field name to read the name from  (default "name")

export interface ImportedContact {
  email: string;
  name: string | null;
}

export function stuntlistingConfigured(): boolean {
  return Boolean(process.env.STUNTLISTING_API_URL);
}

export async function fetchStuntlistingContacts(): Promise<ImportedContact[]> {
  const url = process.env.STUNTLISTING_API_URL;
  if (!url) {
    throw new Error(
      "Stuntlisting API not configured. Set STUNTLISTING_API_URL (and key).",
    );
  }

  const emailField = process.env.STUNTLISTING_EMAIL_FIELD || "email";
  const nameField = process.env.STUNTLISTING_NAME_FIELD || "name";

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.STUNTLISTING_API_KEY) {
    headers.Authorization = `Bearer ${process.env.STUNTLISTING_API_KEY}`;
  }

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Stuntlisting API responded ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  // Accept either a bare array or { data: [...] } / { results: [...] }.
  const rows: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] })?.data)
      ? (data as { data: unknown[] }).data
      : Array.isArray((data as { results?: unknown[] })?.results)
        ? (data as { results: unknown[] }).results
        : [];

  const out: ImportedContact[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const email = String(r[emailField] ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const rawName = r[nameField];
    const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
    out.push({ email, name });
  }
  return out;
}
