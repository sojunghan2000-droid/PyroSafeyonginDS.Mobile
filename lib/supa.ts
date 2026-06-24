import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

// service_role — 서버 전용. 절대 브라우저로 노출하지 않는다 (Route Handler 안에서만 사용).
export function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// anon — 로그인(비밀번호 검증)용.
export function anon() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export const ID_DOMAIN = "pyrosafe.local";
export function usernameToEmail(u: string) {
  return `${u.trim().toLowerCase()}@${ID_DOMAIN}`;
}

// 'YYYY-MM-DD' (KST 기준 오늘)
export function today(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function maxSeq(ids: string[], prefix: string): number {
  let m = 0;
  for (const id of ids) {
    if (!id?.startsWith(prefix)) continue;
    const n = parseInt(id.slice(prefix.length).replace(/[-_ ]/g, ""), 10);
    if (!isNaN(n) && n > m) m = n;
  }
  return m;
}

export async function nextDeficiencyId(): Promise<string> {
  const db = admin();
  const prefix = `D-${new Date().getFullYear()}-`;
  const { data } = await db.from("deficiencies").select("deficiency_id");
  const ids = (data ?? []).map((r) => r.deficiency_id as string);
  return `${prefix}${String(maxSeq(ids, prefix) + 1).padStart(2, "0")}`;
}

export async function nextMalfunctionId(): Promise<string> {
  const db = admin();
  const { data } = await db.from("malfunctions").select("malfunction_id");
  const ids = (data ?? []).map((r) => r.malfunction_id as string);
  return `M-${String(maxSeq(ids, "M-") + 1).padStart(3, "0")}`;
}

export async function nextNoticeNo(date: string): Promise<string> {
  const db = admin();
  const { data } = await db.from("notices").select("notice_no").like("notice_no", `${date}%`);
  const n = (data ?? []).length + 1;
  return `${date}-${String(n).padStart(2, "0")}`;
}
