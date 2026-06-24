import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";

// 장비 조회 + QR 첫 스캔 시 PENDING → ASSIGNED 자동 전환 (부착 검증 신호).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = admin();
  const { data, error } = await db.from("equipment").select("*").eq("equipment_id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: `장비 ${id} 를 찾을 수 없습니다.` }, { status: 404 });

  let justAssigned = false;
  if (data.qr_status === "PENDING") {
    await db.from("equipment").update({ qr_status: "ASSIGNED" }).eq("equipment_id", id);
    data.qr_status = "ASSIGNED";
    justAssigned = true;
  }
  return NextResponse.json({ equipment: data, justAssigned });
}
