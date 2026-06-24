import { NextRequest, NextResponse } from "next/server";
import { admin, today, nextDeficiencyId, nextMalfunctionId, nextNoticeNo } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json();
  const { equipmentId, taskId, result, issue, malfunctionDetail, immediate } = body;
  const inspectionTypes: string[] = body.inspectionTypes?.length ? body.inspectionTypes : ["임시소방시설"];
  const db = admin();
  const t = today();
  const inspector = user.name;

  // 컨텍스트 결정: Task 모드 | 장비 모드
  let floor: string, zone: string, category: string;
  if (taskId) {
    const { data: task } = await db.from("inspection_tasks").select("*").eq("task_id", taskId).maybeSingle();
    if (!task) return NextResponse.json({ error: "점검 대상을 찾을 수 없습니다." }, { status: 404 });
    floor = task.floor; zone = task.zone; category = task.equipment_label;
  } else {
    const { data: eq } = await db.from("equipment").select("*").eq("equipment_id", equipmentId).maybeSingle();
    if (!eq) return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
    floor = eq.floor; zone = eq.zone; category = eq.category;
  }

  async function afterSave(health?: "PASS" | "FAIL") {
    if (taskId) {
      await db.from("inspection_tasks").update({ status: "Completed" }).eq("task_id", taskId);
    } else if (equipmentId) {
      const patch: Record<string, unknown> = { last_inspection: t };
      if (health) patch.health_status = health;
      await db.from("equipment").update(patch).eq("equipment_id", equipmentId);
    }
  }

  if (result === "양호") {
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector, floor, zone, inspection_types: inspectionTypes,
      issue: "양호", resolution: "완료", confirmer: inspector, notice_no: null,
      task_id: taskId ?? null, action_done: true, action_at: t, action_note: "",
    });
    await afterSave("PASS");
    return NextResponse.json({ ok: true, result, deficiencyId: id });
  }

  if (result === "불량") {
    if (!issue?.trim()) return NextResponse.json({ error: "지적사항을 입력해 주세요." }, { status: 400 });
    const done = Boolean(immediate?.note?.trim());
    const noticeNo = await nextNoticeNo(t);
    await db.from("notices").insert({
      notice_no: noticeNo, inspection_date: t, floor, zone, inspection_type: inspectionTypes[0], issue,
      photo_path: null, submitter: inspector, confirmer: done ? immediate.confirmer || inspector : inspector,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector, floor, zone, inspection_types: inspectionTypes,
      issue, resolution: done ? "완료" : "불가", confirmer: done ? immediate.confirmer || inspector : null,
      notice_no: noticeNo, task_id: taskId ?? null,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    await afterSave("FAIL");
    return NextResponse.json({ ok: true, result, deficiencyId: id, noticeNo });
  }

  if (result === "오동작") {
    if (!malfunctionDetail?.trim()) return NextResponse.json({ error: "오동작 내용을 입력해 주세요." }, { status: 400 });
    const id = await nextMalfunctionId();
    await db.from("malfunctions").insert({
      malfunction_id: id, category, occurred_on: t, detail: malfunctionDetail,
      action: "", confirmer: inspector, task_id: taskId ?? null, action_done: false,
    });
    await afterSave();
    return NextResponse.json({ ok: true, result, malfunctionId: id });
  }

  return NextResponse.json({ error: "알 수 없는 결과 유형입니다." }, { status: 400 });
}
