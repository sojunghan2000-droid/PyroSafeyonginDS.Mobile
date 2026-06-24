import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  const { data: t } = await admin().from("inspection_tasks").select("*").eq("task_id", id).maybeSingle();
  if (!t) return NextResponse.json({ error: "점검 대상을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({
    id: t.task_id, label: t.equipment_label, taskType: t.task_type,
    floor: t.floor, zone: t.zone, roundId: t.round_id, status: t.status, note: t.note,
  });
}
