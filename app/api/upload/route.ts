import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

const BUCKET = "action-photos"; // 기존 Streamlit과 동일 버킷

// 조치 사진 업로드 → service_role 로 Storage 저장, 경로 반환 (키는 서버에만)
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const id = String(form.get("id") || "").trim();
  if (!file || !id) return NextResponse.json({ error: "파일과 대상 ID가 필요합니다." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (file.type || "").includes("png") ? "png" : "jpg";
  const path = `${id.replace(/\//g, "-")}.${ext}`;

  const { error } = await admin().storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path });
}
