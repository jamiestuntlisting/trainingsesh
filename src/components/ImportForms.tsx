"use client";

import { useActionState } from "react";
import {
  importPastedAction,
  syncStuntlistingAction,
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

export function StuntlistingSync({ basePath }: { basePath: string }) {
  const [state, action, pending] = useActionState(syncStuntlistingAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="basePath" value={basePath} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync from stuntlisting"}
      </button>
      <Result state={state} />
    </form>
  );
}
