import { isSupabaseConfigured } from "@/lib/supabase";
import { getGroupsWithMembers, getUngroupedContacts } from "@/lib/data";
import ConfigNotice from "@/components/ConfigNotice";
import GroupBoard, { type GroupMeta } from "@/components/GroupBoard";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  const groups = await getGroupsWithMembers();
  const ungrouped = await getUngroupedContacts();

  const groupMeta: GroupMeta[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    send_weekday: g.send_weekday,
  }));

  const initialItems: Record<string, Contact[]> = { __ungrouped__: ungrouped };
  for (const g of groups) initialItems[g.id] = g.members;

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        No groups yet. Add some on the{" "}
        <a className="underline" href={`${base}/schedule`}>
          Schedule
        </a>{" "}
        page, then come back to arrange people.
      </div>
    );
  }

  return (
    <GroupBoard basePath={base} groups={groupMeta} initialItems={initialItems} />
  );
}
