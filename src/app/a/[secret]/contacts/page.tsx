import { isSupabaseConfigured } from "@/lib/supabase";
import { getAllContacts } from "@/lib/data";
import { configDiagnostics } from "@/lib/diagnostics";
import ConfigNotice from "@/components/ConfigNotice";
import SetupDiagnostics from "@/components/SetupDiagnostics";
import { PasteImport, StuntlistingSync } from "@/components/ImportForms";
import { deleteContact } from "./actions";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const base = `/a/${secret}`;

  if (!isSupabaseConfigured()) return <ConfigNotice />;

  let contacts: Contact[];
  try {
    contacts = await getAllContacts();
  } catch (e) {
    return (
      <SetupDiagnostics diag={configDiagnostics()} error={e instanceof Error ? e.message : String(e)} />
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <PasteImport basePath={base} />
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-medium">Sync from stuntlisting</h2>
          <p className="mb-3 mt-1 text-xs text-stone-500">
            Pulls contacts from the stuntlisting API (configure
            <code className="mx-1 rounded bg-stone-100 px-1">STUNTLISTING_API_URL</code>
            first).
          </p>
          <StuntlistingSync basePath={base} />
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-stone-600">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {contacts.length === 0 ? (
            <p className="p-5 text-sm text-stone-500">
              No contacts yet. Paste some emails above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.name || c.email}
                    </p>
                    {c.name && (
                      <p className="truncate text-xs text-stone-500">{c.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                      {c.source}
                    </span>
                    <form action={deleteContact.bind(null, base, c.id)}>
                      <button
                        type="submit"
                        className="text-xs text-stone-400 transition hover:text-red-600"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
