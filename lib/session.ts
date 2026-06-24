import { cookies } from "next/headers";

export type SessionUser = { username: string; name: string; role: string };
export const COOKIE = "ps_user";

export function encodeUser(u: SessionUser): string {
  return Buffer.from(JSON.stringify(u), "utf8").toString("base64");
}

export async function getUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
