"use client";

import { useActionState } from "react";
import { runDispatchNowAction, type DispatchState } from "@/app/a/[secret]/actions";

const initial: DispatchState = { done: false, message: "" };

export default function DispatchButton({ basePath }: { basePath: string }) {
  const [state, action, pending] = useActionState(runDispatchNowAction, initial);
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="basePath" value={basePath} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-stone-50 disabled:opacity-50"
      >
        {pending ? "Running…" : "Run scheduler now"}
      </button>
      {state.message && <span className="text-sm text-stone-500">{state.message}</span>}
    </form>
  );
}
