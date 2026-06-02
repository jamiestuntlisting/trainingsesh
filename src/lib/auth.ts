import { cookies } from "next/headers";

// Server-action guard. The middleware sets the `adm` cookie only after a
// request arrives at the correct secret URL, so checking it here keeps
// mutations locked to whoever knows that URL.
export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const store = await cookies();
  return store.get("adm")?.value === secret;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}

export function adminBase(): string {
  return `/a/${process.env.ADMIN_SECRET ?? ""}`;
}
