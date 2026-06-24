import { NextRequest, NextResponse } from "next/server";
import { admin, today, nextDeficiencyId, nextMalfunctionId, nextNoticeNo } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json();
  const { equipmentId, result, issue, malfunctionDetail, immediate } = body;
  const inspectionTypes: string[] = body.inspectionTypes?.length ? body.inspectionTypes : ["임시소방시설"];
  const db = admin();
  const t = today();
  const inspector = user.name;

  const { data: eq } = await db.from("equipment").select("*").eq("equipment_id", equipmentId).maybeSingle();
  if (!eq) return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });

  if (result === "양호") {
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector,
      floor: eq.floor, zone: eq.zone, inspection_types: inspectionTypes,
      issue: "양호", resolution: "완료", confirmer: inspector,
      notice_no: null, action_done: true, action_at: t, action_note: "",
    });
    await db.from("equipment").update({ health_status: "PASS", last_inspection: t }).eq("equipment_id", equipmentId);
    return NextResponse.json({ ok: true, result, deficiencyId: id });
  }

  if (result === "불량") {
    if (!issue?.trim()) return NextResponse.json({ error: "지적사항을 입력해 주세요." }, { status: 400 });
    const done = Boolean(immediate?.note?.trim());
    const noticeNo = await nextNoticeNo(t);
    await db.from("notices").insert({
      notice_no: noticeNo, inspection_date: t, floor: eq.floor, zone: eq.zone,
      inspection_type: inspectionTypes[0], issue, photo_path: null,
      submitter: inspector, confirmer: done ? immediate.confirmer || inspector : inspector,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector,
      floor: eq.floor, zone: eq.zone, inspection_types: inspectionTypes,
      issue, resolution: done ? "완료" : "불가",
      confirmer: done ? immediate.confirmer || inspector : null, notice_no: noticeNo,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    await db.from("equipment").update({ health_status: "FAIL", last_inspection: t }).eq("equipment_id", equipmentId);
    return NextResponse.json({ ok: true, result, deficiencyId: id, noticeNo });
  }

  if (result === "오동작") {
    if (!malfunctionDetail?.trim()) return NextResponse.json({ error: "오동작 내용을 입력해 주세요." }, { status: 400 });
    const id = await nextMalfunctionId();
    await db.from("malfunctions").insert({
      malfunction_id: id, category: eq.category, occurred_on: t,
      detail: malfunctionDetail, action: "", confirmer: inspector, action_done: false,
    });
    await db.from("equipment").update({ last_inspection: t }).eq("equipment_id", equipmentId);
    return NextResponse.json({ ok: true, result, malfunctionId: id });
  }

  return NextResponse.json({ error: "알 수 없는 결과 유형입니다." }, { status: 400 });
}
