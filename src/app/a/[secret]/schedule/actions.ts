"use server";

import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { Group } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export async function updateSettings(
  basePath: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const { error } = await db
    .from("settings")
    .update({
      reminder_weekday: Number(formData.get("reminder_weekday") ?? 2),
      reminder_time: str(formData.get("reminder_time")) ?? "09:00",
      admin_email: str(formData.get("admin_email")),
      timezone: str(formData.get("timezone")) ?? "America/Los_Angeles",
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
  revalidatePath(`${basePath}/schedule`);
}

export async function addGroup(basePath: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const name = str(formData.get("name"));
  if (!name) throw new Error("Group name is required.");

  const { data: existing } = await db
    .from("groups")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = ((existing?.[0]?.position as number) ?? -1) + 1;

  const weekday = str(formData.get("send_weekday"));
  const { error } = await db.from("groups").insert({
    name,
    position: nextPos,
    send_weekday: weekday ? Number(weekday) : null,
    send_time: str(formData.get("send_time")) ?? "09:00",
  });
  if (error) throw error;
  revalidatePath(`${basePath}/schedule`);
}

export async function updateGroup(
  basePath: string,
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const weekday = str(formData.get("send_weekday"));
  const { error } = await db
    .from("groups")
    .update({
      name: str(formData.get("name")) ?? "Group",
      send_weekday: weekday ? Number(weekday) : null,
      send_time: str(formData.get("send_time")) ?? "09:00",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`${basePath}/schedule`);
}

export async function deleteGroup(basePath: string, id: string): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  // Membership rows cascade-delete; those people simply become ungrouped.
  const { error } = await db.from("groups").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`${basePath}/schedule`);
}

export async function moveGroup(
  basePath: string,
  id: string,
  dir: "up" | "down",
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();
  const { data } = await db
    .from("groups")
    .select("*")
    .order("position", { ascending: true });
  const groups = (data as Group[]) ?? [];
  const i = groups.findIndex((g) => g.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= groups.length) return;

  // Swap their position values.
  await db.from("groups").update({ position: groups[j].position }).eq("id", groups[i].id);
  await db.from("groups").update({ position: groups[i].position }).eq("id", groups[j].id);
  revalidatePath(`${basePath}/schedule`);
}
