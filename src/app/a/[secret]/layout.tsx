import type { ReactNode } from "react";
import AdminNav, { type NavItem } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;
  const items: NavItem[] = [
    { href: base, label: "Dashboard" },
    { href: `${base}/contacts`, label: "Contacts" },
    { href: `${base}/groups`, label: "Groups" },
    { href: `${base}/sessions`, label: "Sessions" },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/outbox`, label: "Outbox" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Training Scheduler</h1>
        <AdminNav items={items} />
      </header>
      <main>{children}</main>
    </div>
  );
}
