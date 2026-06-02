"use server";

import { requireAdmin } from "@/lib/auth";
import { runDispatch } from "@/lib/dispatch";
import { revalidatePath } from "next/cache";

export interface DispatchState {
  done: boolean;
  message: string;
}

// Manually run the same logic the cron runs — handy for testing sends without
// waiting for the scheduled time. Still idempotent, so it won't double-send.
export async function runDispatchNowAction(
  _prev: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  await requireAdmin();
  const basePath = String(formData.get("basePath") || "");
  const result = await runDispatch();
  revalidatePath(`${basePath}`);
  if (!result.ran) return { done: true, message: result.reason || "Nothing to do." };
  return {
    done: true,
    message: result.actions.length
      ? result.actions.join(" · ")
      : "Checked — nothing is due to send right now.",
  };
}
