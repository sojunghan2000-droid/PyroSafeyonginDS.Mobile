import { NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";

export async function GET() {
  const db = admin();
  const t = today();

  const [defs, mals] = await Promise.all([
    db.from("deficiencies").select("*").order("inspection_date", { ascending: false }).limit(50),
    db.from("malfunctions").select("*").order("occurred_on", { ascending: false }).limit(50),
  ]);
  const D = defs.data ?? [];
  const M = mals.data ?? [];

  const inspectedToday =
    D.filter((d) => String(d.inspection_date).slice(0, 10) === t).length +
    M.filter((m) => String(m.occurred_on).slice(0, 10) === t).length;

  const pending =
    D.filter((d) => d.notice_no && !d.action_done).length +
    M.filter((m) => !m.action_done).length;

  const isGood = (d: any) => (d.issue ?? "").trim().startsWith("양호");
  const recent = [
    ...D.map((d) => ({
      ts: String(d.inspection_date),
      title: isGood(d) ? `${d.floor}/${d.zone} 점검` : d.issue,
      sub: `${d.floor}/${d.zone} · ${String(d.inspection_date).slice(0, 10)}`,
      result: isGood(d) ? "양호" : "불량",
    })),
    ...M.map((m) => ({
      ts: String(m.occurred_on),
      title: m.detail,
      sub: `${m.category} · ${String(m.occurred_on).slice(0, 10)}`,
      result: "오동작",
    })),
  ]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 6);

  return NextResponse.json({ kpis: { inspectedToday, pending }, recent });
}
