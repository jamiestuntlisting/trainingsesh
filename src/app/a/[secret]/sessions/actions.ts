"use server";

import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getActiveSession } from "@/lib/data";
import { syncCalendarForSession } from "@/lib/sending";
import { revalidatePath } from "next/cache";
import type { Session } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export async function createSession(
  basePath: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();

  const event_date = str(formData.get("event_date"));
  if (!event_date) throw new Error("A date is required.");

  const capacityRaw = str(formData.get("capacity"));
  const makeActive = formData.get("make_active") === "on";

  const { data, error } = await db
    .from("sessions")
    .insert({
      title: str(formData.get("title")) ?? "Stunt Training",
      event_date,
      event_time: str(formData.get("event_time")),
      location: str(formData.get("location")),
      capacity: capacityRaw ? Number(capacityRaw) : null,
      notes: str(formData.get("notes")),
      is_active: false,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (makeActive) await activate(db, data as Session);

  revalidatePath(`${basePath}/sessions`);
}

async function activate(
  db: ReturnType<typeof getServiceClient>,
  session: Session,
): Promise<void> {
  // Only one active session at a time.
  await db.from("sessions").update({ is_active: false }).neq("id", session.id);
  await db.from("sessions").update({ is_active: true }).eq("id", session.id);
  // Put it on the calendar (no-op if calendar isn't configured).
  try {
    await syncCalendarForSession({ ...session, is_active: true });
  } catch (e) {
    console.error("[sessions] calendar sync on activate failed:", e);
  }
}

export async function setActive(
  basePath: string,
  id: string,
  active: boolean,
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  if (active) {
    const { data } = await db.from("sessions").select("*").eq("id", id).single();
    if (data) await activate(db, data as Session);
  } else {
    await db.from("sessions").update({ is_active: false }).eq("id", id);
  }
  revalidatePath(`${basePath}/sessions`);
}

export async function deleteSession(basePath: string, id: string): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const { error } = await db.from("sessions").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`${basePath}/sessions`);
}

export async function syncCalendarNow(basePath: string): Promise<void> {
  await requireAdmin();
  const session = await getActiveSession();
  if (session) await syncCalendarForSession(session);
  revalidatePath(`${basePath}/sessions`);
}
