"use server";

import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface GroupAssignment {
  groupId: string;
  contactIds: string[];
}

// Persist the whole board in one shot: wipe membership, then re-insert each
// group's ordered contacts. A contact appears in at most one group's list, so
// the unique(contact_id) constraint always holds. Contacts left out of every
// list become "ungrouped". Cheap and correct at personal scale.
export async function saveMembership(
  basePath: string,
  assignments: GroupAssignment[],
): Promise<void> {
  await requireAdmin();
  const db = getServiceClient();

  const { error: delErr } = await db
    .from("group_members")
    .delete()
    .not("id", "is", null);
  if (delErr) throw delErr;

  const rows: { group_id: string; contact_id: string; position: number }[] = [];
  for (const a of assignments) {
    a.contactIds.forEach((contactId, i) => {
      rows.push({ group_id: a.groupId, contact_id: contactId, position: i });
    });
  }

  if (rows.length) {
    const { error: insErr } = await db.from("group_members").insert(rows);
    if (insErr) throw insErr;
  }

  revalidatePath(`${basePath}/groups`);
}
