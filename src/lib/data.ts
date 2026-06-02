import { getServiceClient } from "./supabase";
import type { Contact, Group, Session, Settings, Signup } from "./types";

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const db = getServiceClient();
  const { data, error } = await db.from("settings").select("*").eq("id", true).single();
  if (error) throw error;
  return data as Settings;
}

export async function getActiveSession(): Promise<Session | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Session) ?? null;
}

export async function getSessions(): Promise<Session[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data as Session[]) ?? [];
}

export interface GroupWithMembers extends Group {
  members: Contact[];
}

export async function getGroupsWithMembers(): Promise<GroupWithMembers[]> {
  const db = getServiceClient();

  const [groupsRes, membersRes] = await Promise.all([
    db.from("groups").select("*").order("position", { ascending: true }),
    db
      .from("group_members")
      .select("group_id, position, contact:contacts(*)")
      .order("position", { ascending: true }),
  ]);

  if (groupsRes.error) throw groupsRes.error;
  if (membersRes.error) throw membersRes.error;

  const byGroup = new Map<string, Contact[]>();
  for (const row of membersRes.data as unknown as {
    group_id: string;
    contact: Contact;
  }[]) {
    if (!row.contact) continue;
    const arr = byGroup.get(row.group_id) ?? [];
    arr.push(row.contact);
    byGroup.set(row.group_id, arr);
  }

  return (groupsRes.data as Group[]).map((g) => ({
    ...g,
    members: byGroup.get(g.id) ?? [],
  }));
}

export async function getUngroupedContacts(): Promise<Contact[]> {
  const db = getServiceClient();
  const { data: membered, error: e1 } = await db
    .from("group_members")
    .select("contact_id");
  if (e1) throw e1;
  const memberedIds = new Set((membered ?? []).map((r) => r.contact_id as string));

  const { data: all, error: e2 } = await db
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (e2) throw e2;

  return (all as Contact[]).filter((c) => !memberedIds.has(c.id));
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Contact[]) ?? [];
}

export interface SignupWithContact extends Signup {
  contact: Contact;
  group: Group | null;
}

export async function getSessionSignups(
  sessionId: string,
): Promise<SignupWithContact[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("signups")
    .select("*, contact:contacts(*), group:groups(*)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as SignupWithContact[]) ?? [];
}

export async function getSignupByToken(
  token: string,
): Promise<(Signup & { session: Session }) | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("signups")
    .select("*, session:sessions(*)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as (Signup & { session: Session })) ?? null;
}
