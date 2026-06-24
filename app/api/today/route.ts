import { NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

const isGood = (d: any) => (d.issue ?? "").trim().startsWith("양호");

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = admin();
  const t = today();
  const [defs, mals] = await Promise.all([
    db.from("deficiencies").select("*").order("inspection_date", { ascending: false }).limit(200),
    db.from("malfunctions").select("*").order("occurred_on", { ascending: false }).limit(200),
  ]);
  const D = (defs.data ?? []).filter((d) => String(d.inspection_date).slice(0, 10) === t);
  const M = (mals.data ?? []).filter((m) => String(m.occurred_on).slice(0, 10) === t);
  const items = [
    ...D.map((d) => ({
      kind: "def", id: d.deficiency_id, ts: String(d.inspection_date),
      title: isGood(d) ? `${d.floor}/${d.zone} 점검` : d.issue,
      sub: `${d.floor}/${d.zone}`, result: isGood(d) ? "양호" : "불량",
      date: String(d.inspection_date).slice(0, 10),
    })),
    ...M.map((m) => ({
      kind: "mal", id: m.malfunction_id, ts: String(m.occurred_on),
      title: m.detail, sub: m.category, result: "오동작",
      date: String(m.occurred_on).slice(0, 10),
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return NextResponse.json({ items });
}
