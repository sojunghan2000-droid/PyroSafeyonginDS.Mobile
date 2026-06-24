import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

const BUCKET = "action-photos";
const isGood = (issue: string | null) => (issue ?? "").trim().startsWith("양호");

export async function GET(_req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { kind, id } = await ctx.params;
  const db = admin();

  if (kind === "def") {
    const { data: d } = await db.from("deficiencies").select("*").eq("deficiency_id", id).maybeSingle();
    if (!d) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    const good = isGood(d.issue);
    const status = good ? "완료" : d.resolution === "불가" ? "불가" : d.action_done ? "조치 완료" : "조치 대기";
    let photoUrl: string | null = null;
    if (d.action_photo_path) {
      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(d.action_photo_path, 600);
      photoUrl = signed?.signedUrl ?? null;
    }
    return NextResponse.json({
      kind: "def", id: d.deficiency_id, result: good ? "양호" : "불량", status,
      date: String(d.inspection_date).slice(0, 10), location: `${d.floor}/${d.zone}`,
      inspector: d.inspector ?? null, confirmer: d.confirmer ?? null,
      inspectionTypes: d.inspection_types ?? [], content: d.issue ?? "",
      noticeNo: d.notice_no ?? null, taskId: d.task_id ?? null,
      action: { done: Boolean(d.action_done), at: d.action_at ? String(d.action_at).slice(0, 10) : null, note: d.action_note ?? null, photoUrl },
    });
  }

  if (kind === "mal") {
    const { data: m } = await db.from("malfunctions").select("*").eq("malfunction_id", id).maybeSingle();
    if (!m) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      kind: "mal", id: m.malfunction_id, result: "오동작",
      status: m.action_done ? "조치 완료" : "조치 대기",
      date: String(m.occurred_on).slice(0, 10), location: m.category ?? "",
      inspector: m.confirmer ?? null, confirmer: m.confirmer ?? null,
      inspectionTypes: [], content: m.detail ?? "", noticeNo: null, taskId: m.task_id ?? null,
      action: { done: Boolean(m.action_done), at: m.action_at ? String(m.action_at).slice(0, 10) : null, note: m.action_note ?? null, photoUrl: null },
    });
  }

  return NextResponse.json({ error: "알 수 없는 유형." }, { status: 400 });
}
