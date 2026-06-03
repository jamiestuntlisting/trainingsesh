"use server";

import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { extractContacts } from "@/lib/extract-emails";
import {
  fetchStuntlistingContacts,
  introspectStuntlisting,
  stuntlistingConfigured,
} from "@/lib/stuntlisting";
import { revalidatePath } from "next/cache";

export interface ActionState {
  ok: boolean;
  message: string;
}

async function insertNew(
  rows: { email: string; name: string | null }[],
  source: "paste" | "stuntlisting",
): Promise<{ added: number; existing: number }> {
  if (rows.length === 0) return { added: 0, existing: 0 };
  const db = getServiceClient();
  const emails = rows.map((r) => r.email);
  const { data: have, error: e1 } = await db
    .from("contacts")
    .select("email")
    .in("email", emails);
  if (e1) throw e1;
  const haveSet = new Set((have ?? []).map((r) => String(r.email).toLowerCase()));
  const fresh = rows.filter((r) => !haveSet.has(r.email));
  if (fresh.length) {
    const { error: e2 } = await db
      .from("contacts")
      .insert(fresh.map((r) => ({ email: r.email, name: r.name, source })));
    if (e2) throw e2;
  }
  return { added: fresh.length, existing: rows.length - fresh.length };
}

// Paste a blob of text → extract & store new emails.
export async function importPastedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const text = String(formData.get("text") || "");
  const basePath = String(formData.get("basePath") || "");
  const extracted = extractContacts(text);
  if (extracted.length === 0) {
    return { ok: false, message: "No email addresses found in that text." };
  }
  const { added, existing } = await insertNew(extracted, "paste");
  revalidatePath(`${basePath}/contacts`);
  return {
    ok: true,
    message: `Added ${added} new contact${added === 1 ? "" : "s"}${
      existing ? ` (${existing} already existed)` : ""
    }.`,
  };
}

// Pull contacts from the stuntlisting API.
export async function syncStuntlistingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const basePath = String(formData.get("basePath") || "");
  if (!stuntlistingConfigured()) {
    return {
      ok: false,
      message: "Stuntlisting API isn't configured yet — set STUNTLISTING_API_URL.",
    };
  }
  try {
    const imported = await fetchStuntlistingContacts();
    const { added, existing } = await insertNew(imported, "stuntlisting");
    revalidatePath(`${basePath}/contacts`);
    return {
      ok: true,
      message: `Synced ${imported.length} from stuntlisting — ${added} new${
        existing ? `, ${existing} already had` : ""
      }.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}

// Inspect the stuntlisting schema (through the deployed app, which can reach
// the DB) to discover the right table/columns and preview the configured query.
export async function previewStuntlistingAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!stuntlistingConfigured()) {
    return { ok: false, message: "Stuntlisting DB isn't configured — set STUNTLISTING_DB_* env vars." };
  }
  try {
    const s = await introspectStuntlisting();
    const tables = s.tablesWithEmail.length
      ? s.tablesWithEmail.map((t) => `${t.table}(${t.columns.join(", ")})`).join("  ·  ")
      : "no email-like columns found";
    const preview = s.sample.length
      ? `Preview query returns e.g. ${s.sample.map((r) => r.email).join(", ")}`
      : s.sampleError
        ? `Preview query error: ${s.sampleError}`
        : "Preview query returned 0 rows.";
    return { ok: true, message: `DB "${s.database}". Email columns → ${tables}. ${preview}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Introspection failed." };
  }
}

export async function deleteContact(basePath: string, id: string): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const { error } = await db.from("contacts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`${basePath}/contacts`);
}
