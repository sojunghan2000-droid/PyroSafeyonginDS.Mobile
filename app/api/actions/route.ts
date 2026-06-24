import { NextRequest, NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  const db = admin();
  const items: any[] = [];

  if (filter === "all" || filter === "def") {
    const { data } = await db.from("deficiencies").select("*").not("notice_no", "is", null)
      .order("inspection_date", { ascending: false });
    for (const d of data ?? []) {
      items.push({
        kind: "def", id: d.deficiency_id,
        title: `${d.floor}/${d.zone} · ${d.issue}`,
        sub: `통보서 ${d.notice_no} · ${String(d.inspection_date).slice(0, 10)}`,
        status: d.action_done ? "조치 완료" : "조치 대기",
        pending: !d.action_done,
        badgeType: d.action_done ? "ok" : "bad",
      });
    }
  }
  if (filter === "all" || filter === "mal") {
    const { data } = await db.from("malfunctions").select("*").order("occurred_on", { ascending: false });
    for (const m of data ?? []) {
      items.push({
        kind: "mal", id: m.malfunction_id,
        title: m.detail,
        sub: `${m.malfunction_id} · ${m.category} · ${String(m.occurred_on).slice(0, 10)}`,
        status: m.action_done ? "조치 완료" : "오동작",
        pending: !m.action_done,
        badgeType: m.action_done ? "ok" : "warn",
      });
    }
  }
  items.sort((a, b) => (a.pending === b.pending ? 0 : a.pending ? -1 : 1));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { kind, id, note, confirmer } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "조치 내용을 입력해 주세요." }, { status: 400 });
  const db = admin();
  const t = today();
  const who = confirmer?.trim() || user.name;

  if (kind === "def") {
    const { data: d } = await db.from("deficiencies").select("notice_no").eq("deficiency_id", id).maybeSingle();
    await db.from("deficiencies").update({
      action_done: true, action_at: t, action_note: note, confirmer: who, resolution: "완료",
    }).eq("deficiency_id", id);
    if (d?.notice_no) {
      await db.from("notices").update({
        action_done: true, action_at: t, action_note: note, confirmer: who,
      }).eq("notice_no", d.notice_no);
    }
  } else if (kind === "mal") {
    await db.from("malfunctions").update({
      action_done: true, action_at: t, action_note: note, action: note, confirmer: who,
    }).eq("malfunction_id", id);
  } else {
    return NextResponse.json({ error: "알 수 없는 항목." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
