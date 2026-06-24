import { NextRequest, NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const filter = req.nextUrl.searchParams.get("filter") ?? "all"; // all|def|mal|pending
  const sort = req.nextUrl.searchParams.get("sort") ?? "newest"; // newest|oldest
  const db = admin();

  // KPI는 항상 전체 모집단 기준으로 계산 (필터와 무관)
  const [defsRes, malsRes] = await Promise.all([
    db.from("deficiencies").select("*").not("notice_no", "is", null),
    db.from("malfunctions").select("*"),
  ]);
  const defs = defsRes.data ?? [];
  const mals = malsRes.data ?? [];

  const doneCount = defs.filter((d) => d.action_done).length + mals.filter((m) => m.action_done).length;
  const total = defs.length + mals.length;
  const kpis = {
    total,
    jijeok: defs.length, // 지적사항(통보서 발급)
    pending: defs.filter((d) => !d.action_done).length, // 통보서 발급(조치 대기)
    malfunction: mals.length, // 오동작
    actionRate: total ? Math.round((doneCount / total) * 100) : 0, // 작업 조치율 %
  };

  let items = [
    ...defs.map((d) => ({
      kind: "def" as const, id: d.deficiency_id,
      title: `${d.floor}/${d.zone} · ${d.issue}`,
      date: String(d.inspection_date).slice(0, 10),
      sub: `통보서 ${d.notice_no}`,
      status: d.action_done ? "조치 완료" : "조치 대기",
      pending: !d.action_done,
      hasPhoto: Boolean(d.action_photo_path),
    })),
    ...mals.map((m) => ({
      kind: "mal" as const, id: m.malfunction_id,
      title: m.detail,
      date: String(m.occurred_on).slice(0, 10),
      sub: `${m.malfunction_id} · ${m.category}`,
      status: m.action_done ? "조치 완료" : "오동작",
      pending: !m.action_done,
      hasPhoto: false,
    })),
  ];

  if (filter === "def") items = items.filter((i) => i.kind === "def");
  else if (filter === "mal") items = items.filter((i) => i.kind === "mal");
  else if (filter === "pending") items = items.filter((i) => i.pending);

  items.sort((a, b) => (sort === "oldest" ? (a.date < b.date ? -1 : 1) : a.date < b.date ? 1 : -1));

  return NextResponse.json({ items, kpis });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { kind, id, note, confirmer, actionDate, photoPath } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "조치 내용을 입력해 주세요." }, { status: 400 });
  const db = admin();
  const at = (actionDate && String(actionDate).slice(0, 10)) || today();
  const who = confirmer?.trim() || user.name;

  if (kind === "def") {
    const payload: Record<string, unknown> = {
      action_done: true, action_at: at, action_note: note, confirmer: who, resolution: "완료",
    };
    if (photoPath) payload.action_photo_path = photoPath;
    await db.from("deficiencies").update(payload).eq("deficiency_id", id);
    const { data: d } = await db.from("deficiencies").select("notice_no").eq("deficiency_id", id).maybeSingle();
    if (d?.notice_no) {
      const np: Record<string, unknown> = { action_done: true, action_at: at, action_note: note, confirmer: who };
      if (photoPath) np.action_photo_path = photoPath;
      await db.from("notices").update(np).eq("notice_no", d.notice_no);
    }
  } else if (kind === "mal") {
    // 별지9 오동작 테이블에는 action_photo_path 컬럼이 없음 → 사진 미적용
    await db.from("malfunctions").update({
      action_done: true, action_at: at, action_note: note, action: note, confirmer: who,
    }).eq("malfunction_id", id);
  } else {
    return NextResponse.json({ error: "알 수 없는 항목." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
