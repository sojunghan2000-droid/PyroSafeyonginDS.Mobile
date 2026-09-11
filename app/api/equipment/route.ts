import { NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

// QR 없이 장비를 검색·선택해 점검을 시작할 때 쓰는 목록 (Streamlit 신규 점검 추가 드롭다운과 동일 용도).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const db = admin();
  const { data, error } = await db
    .from("equipment")
    .select("equipment_id, location_id, category, equipment_name, floor, zone, qr_status, health_status")
    .order("equipment_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
