"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addStuntlistingContactAction,
  importPastedAction,
  searchStuntlistingAction,
  type ActionState,
} from "@/app/a/[secret]/contacts/actions";

const initial: ActionState = { ok: false, message: "" };

function Result({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`mt-2 text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
      {state.message}
    </p>
  );
}

export function PasteImport({ basePath }: { basePath: string }) {
  const [state, action, pending] = useActionState(importPastedAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="basePath" value={basePath} />
      <label className="mb-1 block text-sm font-medium">Paste emails</label>
      <p className="mb-2 text-xs text-stone-500">
        Drop in any text — a list, a forwarded email, &quot;Name &lt;email&gt;&quot; pairs.
        I&apos;ll pull out every address and skip duplicates.
      </p>
      <textarea
        name="text"
        rows={5}
        placeholder="jane@example.com, John Doe <john@example.com> ..."
        className="w-full resize-y rounded-lg border border-stone-300 p-3 text-sm outline-none focus:border-stone-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
      >
        {pending ? "Extracting…" : "Extract & add"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function StuntlistingSearch({ basePath }: { basePath: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{ email: string; name: string | null }[]>([]);
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState<Record<string, "adding" | "added" | "error">>({});
  const [pending, start] = useTransition();

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await searchStuntlistingAction(term);
      setResults(r.results);
      setSearched(true);
      setMessage(r.ok ? "" : r.message);
    });
  }

  async function add(email: string, name: string | null) {
    setStatus((s) => ({ ...s, [email]: "adding" }));
    const r = await addStuntlistingContactAction(basePath, email, name);
    setStatus((s) => ({ ...s, [email]: r.ok ? "added" : "error" }));
  }

  return (
    <div>
      <form onSubmit={doSearch} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search stuntlisting by name or email…"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
        />
        <button
          type="submit"
          disabled={pending || term.trim().length < 2}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
      {searched && !message && results.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">No matches in stuntlisting.</p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200">
          {results.map((r) => {
            const st = status[r.email];
            return (
              <li key={r.email} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name || r.email}</p>
                  {r.name && <p className="truncate text-xs text-stone-500">{r.email}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => add(r.email, r.name)}
                  disabled={st === "adding" || st === "added"}
                  className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    st === "added"
                      ? "bg-green-100 text-green-700"
                      : "border border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {st === "added" ? "Added ✓" : st === "adding" ? "Adding…" : st === "error" ? "Retry" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
